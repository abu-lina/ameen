import { APIError, getPayload, type Payload, type User } from 'payload'
import config from '@payload-config'
import { appAuth } from '@/lib/app-auth'
import { POST_CHARACTER_LIMIT } from '@/lib/post-limits'
import { moderatePost } from '@/lib/post-moderation'
import { anonymousCard } from '@/lib/card-privacy'
import { hashKey, makeKey, validKey } from '@/lib/card-keys'
import { recordInteraction, pruneInteractionReceipts } from '@/lib/card-interactions'
import { INTERACTION_ACTIONS, InteractionError, type InteractionAction } from '@/lib/interaction-state'
import type { Card as StoredCard } from '@/payload-types'

const headers = { 'Cache-Control': 'private, no-store' }
class CommunityError extends Error {
  readonly status: number
  readonly field?: string
  constructor(message: string, status = 400, field?: string) { super(message); this.status = status; this.field = field }
}
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers })
function credentials(body: Record<string, unknown>) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
    throw new CommunityError('Enter your previous email and a password of at least 8 characters.')
  }
  return { email, password }
}
async function reviewer() {
  try {
    const user = await appAuth.currentUser()
    if (user?.role === 'reviewer') return user
    if (user) await appAuth.logout()
  } catch {
    // An expired legacy session must not stop anonymous reading.
    await appAuth.logout()
  }
  return null
}
function tokens(body: Record<string, unknown>) {
  if (body.keys === undefined) return []
  if (!Array.isArray(body.keys) || body.keys.length > 1000 || !body.keys.every(validKey)) throw new CommunityError('This browser’s management keys could not be read.')
  return [...new Set(body.keys as string[])]
}
async function ownership(payload: Payload, keys: string[], user: User | null) {
  if (!keys.length) return { ownedCardIDs: [] as string[] }
  const hashes = keys.map(hashKey)
  const primary = await payload.find({
    collection: 'cards', overrideAccess: false, user,
    context: { managementHashes: hashes }, where: { managementKeyHash: { in: hashes } }, select: {}, depth: 0, limit: 1000,
  })
  const additional = await payload.find({
    collection: 'card-keys', overrideAccess: false, user,
    context: { keyLookup: true }, where: { keyHash: { in: hashes } }, select: { card: true }, depth: 0, limit: 1000,
  })
  return { ownedCardIDs: [...new Set([
    ...primary.docs.map(card => card.id),
    ...additional.docs.flatMap(key => typeof key.card === 'string' ? [key.card] : key.card?.id ? [key.card.id] : []),
  ])] }
}
function content(body: Record<string, unknown>): Pick<StoredCard, 'text' | 'topic'> {
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const topic = body.topic
  if (text.length < 10 || text.length > POST_CHARACTER_LIMIT) throw new CommunityError(`Write 10–${POST_CHARACTER_LIMIT} characters.`, 400, 'text')
  if (topic !== 'Life' && topic !== 'Creativity' && topic !== 'Growth' && topic !== 'Connection') throw new CommunityError('Choose a category.', 400, 'topic')
  const rejection = moderatePost(text)
  if (rejection) throw new CommunityError(rejection.message, 400, 'text')
  return { text, topic }
}
function cardID(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 100) throw new CommunityError('Choose a valid card.')
  return value
}

export async function GET() {
  try {
    const payload = await getPayload({ config })
    const user = await reviewer()
    const cards = await payload.find({
      collection: 'cards', overrideAccess: false, user, where: { reviewStatus: { equals: 'approved' } },
      depth: 0, limit: 100, sort: '-createdAt',
    })
    // Receipt expiry is enforced on every write; active card reads also compact expired receipts.
    await Promise.all(cards.docs.map(card => pruneInteractionReceipts({ payload, user }, card.id)))
    return reply({ cards: cards.docs.map(anonymousCard), user: user ? { role: 'reviewer' } : null })
  } catch {
    return reply({ error: 'The shared cards could not be loaded. Your browser’s saved words are still here.' }, 500)
  }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get('sec-fetch-site') === 'cross-site') throw new CommunityError('Request not allowed.', 403)
    if (Number(request.headers.get('content-length') || 0) > 100_000) throw new CommunityError('This request is too large.', 413)
    const raw = await request.text()
    if (raw.length > 100_000) throw new CommunityError('This request is too large.', 413)
    let body: Record<string, unknown>
    try { body = JSON.parse(raw) } catch { throw new CommunityError('This request could not be read.') }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CommunityError('This request could not be read.')
    if (body.operation === 'logout') { await appAuth.logout(); return reply({ success: true }) }
    if (body.operation === 'signup') throw new CommunityError('No account is needed to use still.', 410)
    if (body.operation === 'reviewer-login') {
      const { email, password } = credentials(body)
      let user
      try { user = await appAuth.login(email, password) } catch { throw new CommunityError('Those reviewer details weren’t recognised.', 401) }
      if (user.role !== 'reviewer') {
        await appAuth.logout()
        throw new CommunityError('This entrance is only for authorised reviewers.', 403)
      }
      return reply({ success: true })
    }
    const payload = await getPayload({ config })
    if (body.operation === 'import-legacy') {
      const { email, password } = credentials(body)
      let account
      try { account = await appAuth.verify(email, password) } catch { throw new CommunityError('Those previous account details weren’t recognised.', 401) }
      const user = { ...account, collection: 'users' as const }
      const cards = await payload.find({
        collection: 'cards', overrideAccess: false, user,
        where: { author: { equals: user.id } }, limit: 1000, depth: 0,
      })
      const swipes = await payload.find({ collection: 'swipes', overrideAccess: false, user, limit: 1000, depth: 1, sort: '-createdAt' })
      if (cards.hasNextPage || swipes.hasNextPage) throw new CommunityError('This collection needs a larger import. Nothing has been removed.', 409)
      const keys: string[] = []
      for (const card of cards.docs) {
        const key = makeKey()
        await payload.create({
          collection: 'card-keys', overrideAccess: false, user, context: { legacyKeyGrant: true },
          data: { card: card.id, keyHash: hashKey(key) },
        })
        keys.push(key)
      }
      return reply({
        keys,
        history: swipes.docs.flatMap(swipe => typeof swipe.card === 'object' && swipe.card
          ? [{ key: makeKey(), card: anonymousCard(swipe.card), action: swipe.action, createdAt: Date.parse(swipe.createdAt), imported: true }]
          : []),
      })
    }
    const user = await reviewer()
    if (body.operation === 'interaction') {
      const id = cardID(body.card)
      if (!validKey(body.key) || !INTERACTION_ACTIONS.includes(body.action as InteractionAction) ||
        (body.undo !== undefined && typeof body.undo !== 'boolean')) throw new CommunityError('Choose a valid interaction.')
      const card = await payload.findByID({ collection: 'cards', id, overrideAccess: false, user, select: { reviewStatus: true } })
      if (card.reviewStatus !== 'approved') throw new CommunityError('This card is no longer available for interactions.', 409)
      const state = await recordInteraction({ payload, user }, id, body.key, body.action as InteractionAction, body.undo === true)
      return reply({ success: true, totals: { pass: state.pass, save: state.save, resonate: state.resonate } })
    }
    const keys = tokens(body)
    const context = await ownership(payload, keys, user)
    if (body.operation === 'owned') {
      if (!context.ownedCardIDs.length) return reply({ cards: [] })
      const result = await payload.find({
        collection: 'cards', overrideAccess: false, user, context,
        where: { id: { in: context.ownedCardIDs } }, depth: 0, limit: 1000, sort: '-createdAt',
      })
      return reply({ cards: result.docs.map(anonymousCard) })
    }
    if (body.operation === 'review-queue') {
      if (!user) throw new CommunityError('Reviewer access required.', 403)
      const result = await payload.find({
        collection: 'cards', overrideAccess: false, user, context, depth: 0, limit: 100, sort: 'createdAt',
        where: { and: [
          { or: [{ reviewStatus: { equals: 'pending' } }, { reviewStatus: { exists: false } }] },
          { or: [{ author: { not_equals: user.id } }, { author: { exists: false } }] },
          ...(context.ownedCardIDs.length ? [{ id: { not_in: context.ownedCardIDs } }] : []),
        ] },
      })
      return reply({ cards: result.docs.map(anonymousCard) })
    }
    if (body.operation === 'review') {
      if (!user) throw new CommunityError('Reviewer access required.', 403)
      const id = cardID(body.id)
      if (body.status !== 'approved' && body.status !== 'rejected') throw new CommunityError('Choose approve or reject.')
      const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
      if (body.status === 'rejected' && (!reason || reason.length > 500)) throw new CommunityError('Please give a clear reason of 1–500 characters.', 400, 'reason')
      await payload.update({
        collection: 'cards', id, overrideAccess: false, user, context,
        data: { reviewStatus: body.status, rejectionReason: body.status === 'rejected' ? reason : null },
      })
      return reply({ success: true })
    }
    if (body.operation === 'post') {
      const data = content(body)
      if (!validKey(body.key)) throw new CommunityError('Please allow browser storage before sending a thought.')
      const hash = hashKey(body.key)
      const existing = await payload.find({
        collection: 'cards', overrideAccess: false, user, context: { managementHashes: [hash] },
        where: { managementKeyHash: { equals: hash } }, limit: 1, depth: 0,
      })
      if (existing.docs[0]) return reply({ card: anonymousCard(existing.docs[0]) })
      const card = await payload.create({
        collection: 'cards', overrideAccess: false, user, context: { newCardKeyHash: hash }, data,
      })
      return reply({ card: anonymousCard(card) })
    }
    if (body.operation === 'edit') {
      const id = cardID(body.id)
      if (!context.ownedCardIDs.includes(id)) throw new CommunityError('Only the browser holding this card’s private key can edit it.', 403)
      const card = await payload.update({ collection: 'cards', id, overrideAccess: false, user, context, data: content(body) })
      return reply({ card: anonymousCard(card) })
    }
    throw new CommunityError('Unknown action.')
  } catch (error) {
    if (error instanceof CommunityError) return reply({ error: error.message, field: error.field }, error.status)
    if (error instanceof InteractionError) return reply({ error: error.message }, 409)
    if (error instanceof APIError && error.status >= 400 && error.status < 500) {
      return reply({ error: error.message }, error.status)
    }
    return reply({ error: 'That couldn’t be completed. Your saved words haven’t been removed. Please try again.' }, 500)
  }
}
