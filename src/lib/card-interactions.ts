import type { Payload, PayloadRequest } from 'payload'
import type { CardID } from './community-types'
import { hashKey } from './card-keys'
import { advanceInteraction, emptyInteractions, InteractionError, type InteractionAction, type Receipt } from './interaction-state'

type Reader = { payload: Payload; req?: Partial<PayloadRequest>; user?: PayloadRequest['user'] }
export async function readInteractions({ payload, req, user }: Reader, card: CardID) {
  const result = await payload.find({
    collection: 'card-interactions', overrideAccess: false, user, req,
    context: { interactionRead: true }, where: { card: { equals: card } }, sort: '-revision', limit: 1, depth: 0,
  })
  const latest = result.docs[0]
  return {
    revision: latest?.revision || 0,
    state: latest ? { pass: latest.pass, save: latest.save, resonate: latest.resonate, receipts: latest.receipts as Receipt[] } : emptyInteractions(),
  }
}

// Unique checkpoint revisions provide cross-instance compare-and-retry without raw DB access.
// Every writer verifies its receipt in the newest snapshot, including after compaction races.
export async function recordInteraction(reader: Reader, card: CardID, key: string, action: InteractionAction, undo = false) {
  const hash = hashKey(key)
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const current = await readInteractions(reader, card)
    const next = advanceInteraction(current.state, { hash, action, undo })
    if (!next.changed) return current.state
    const revision = current.revision + 1
    let created = false
    try {
      await reader.payload.create({
        collection: 'card-interactions', overrideAccess: false, user: reader.user,
        context: { interactionWrite: true }, disableTransaction: true,
        data: { card, revision, checkpointKey: hashKey(JSON.stringify([card, revision])), ...next.state },
      })
      created = true
    } catch (error) {
      const latest = await readInteractions(reader, card)
      if (latest.revision <= current.revision) throw error
    }
    const latest = await readInteractions(reader, card)
    const receipt = latest.state.receipts.find(item => item.hash === hash)
    if (receipt && receipt.undone === undo) {
      // Old snapshots contain no identity; keep just the aggregate and live Undo receipts.
      if (created) await compactInteractions(reader, card, latest.revision)
      return latest.state
    }
  }
  throw new InteractionError('This thought is receiving a lot of attention. Please try again.')
}

async function compactInteractions(reader: Reader, card: CardID, revision: number) {
  await reader.payload.delete({
    collection: 'card-interactions', overrideAccess: false, user: reader.user,
    context: { interactionWrite: true },
    where: { and: [{ card: { equals: card } }, { revision: { less_than: revision } }] },
  }).catch(() => undefined)
}

export async function pruneInteractionReceipts(reader: Reader, card: CardID) {
  const current = await readInteractions(reader, card)
  const receipts = current.state.receipts.filter(item => item.expiresAt > Date.now())
  if (receipts.length === current.state.receipts.length) return
  const revision = current.revision + 1
  try {
    await reader.payload.create({
      collection: 'card-interactions', overrideAccess: false, user: reader.user, disableTransaction: true,
      context: { interactionWrite: true },
      data: { card, revision, checkpointKey: hashKey(JSON.stringify([card, revision])), ...current.state, receipts },
    })
    await compactInteractions(reader, card, revision)
  } catch { /* A concurrent interaction owns the newer checkpoint; a later read can prune. */ }
}
