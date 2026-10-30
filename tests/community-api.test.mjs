import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'
import { hashKey } from '../src/lib/card-keys.ts'

const realPayload = import.meta.resolve('payload')
const calls = []
let currentUser = null
let matchedKey = false
const publicCard = { id: 'public', text: 'My father taught me kindness.', topic: 'Life', reviewStatus: 'approved', resonateCount: 1, authorName: 'Never expose', managementKeyHash: 'never-expose' }
const privateCard = { ...publicCard, id: 'private', reviewStatus: 'pending' }
const payload = {
  async find(options) {
    assert.equal(options.overrideAccess, false)
    calls.push({ method: 'find', ...options })
    if (options.collection === 'card-interactions' || options.collection === 'card-keys') return { docs: [], hasNextPage: false }
    if (options.collection === 'swipes') return { docs: [], hasNextPage: false }
    if (options.where.author) return { docs: [privateCard], hasNextPage: false }
    if (options.where.managementKeyHash) return { docs: matchedKey ? [privateCard] : [], hasNextPage: false }
    if (options.where.id) return { docs: [privateCard], hasNextPage: false }
    return { docs: [publicCard], hasNextPage: false }
  },
  async create(options) {
    assert.equal(options.overrideAccess, false)
    calls.push({ method: 'create', ...options })
    return { ...privateCard, ...options.data }
  },
  async update(options) {
    assert.equal(options.overrideAccess, false)
    calls.push({ method: 'update', ...options })
    return { ...privateCard, ...options.data }
  },
  async findByID(options) {
    assert.equal(options.overrideAccess, false)
    return privateCard
  },
}
globalThis.__stillApiTest = {
  payload,
  auth: {
    currentUser: async () => currentUser,
    logout: async () => {},
    login: async () => ({ id: 'staff', role: 'reviewer', collection: 'users' }),
    verify: async () => ({ id: 'legacy-owner', role: 'user', name: 'Legacy owner', collection: 'users' }),
  },
}
const virtual = {
  payload: `export { APIError } from ${JSON.stringify(realPayload)}; export const getPayload = async () => globalThis.__stillApiTest.payload`,
  '@payload-config': 'export default {}',
  '@/lib/app-auth': 'export const appAuth = globalThis.__stillApiTest.auth',
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(virtual, specifier)) return { url: `still-api-test:${specifier}`, shortCircuit: true }
    if (specifier.startsWith('@/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context)
    try { return nextResolve(specifier, context) }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context)
      throw error
    }
  },
  load(url, context, nextLoad) {
    if (url.startsWith('still-api-test:')) return { format: 'module', source: virtual[url.slice('still-api-test:'.length)], shortCircuit: true }
    return nextLoad(url, context)
  },
})
const { GET, POST } = await import('../src/app/(frontend)/api/community/route.ts')
const key = 'a'.repeat(64)
const post = data => POST(new Request('http://example.test/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }))
test.beforeEach(() => { calls.length = 0; currentUser = null; matchedKey = false })

test('the public feed contains only approved-card content, never identity or management keys', async () => {
  const response = await GET()
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.user, null)
  assert.equal('authorName' in data.cards[0], false)
  assert.equal('managementKeyHash' in data.cards[0], false)
  assert.equal('submissions' in data, false)
  assert.equal('swipes' in data, false)
  assert.equal('queue' in data, false)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
})

test('anonymous posting allowlists prose and category and hashes the private capability', async () => {
  const response = await post({ operation: 'post', key, text: publicCard.text, topic: 'Life', author: 'forged', authorName: 'forged', reviewStatus: 'approved', resonateCount: 999 })
  assert.equal(response.status, 200)
  const created = calls.find(call => call.method === 'create')
  assert.deepEqual(created.data, { text: publicCard.text, topic: 'Life' })
  assert.equal(created.context.newCardKeyHash, hashKey(key))
  assert.equal(created.user, null)
})

test('unsafe words still fail before any document is created', async () => {
  const response = await post({ operation: 'post', key, text: 'This is fucking awful.', topic: 'Life' })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).field, 'text')
  assert.equal(calls.some(call => call.method === 'create'), false)
})

test('a public card ID without a valid management key cannot grant editing', async () => {
  const response = await post({ operation: 'edit', id: 'private', keys: [], text: publicCard.text, topic: 'Life', owner: 'legacy-owner' })
  assert.equal(response.status, 403)
  assert.equal(calls.some(call => call.method === 'update'), false)
})

test('a verified management key grants only the matching card and returns allowlisted content', async () => {
  matchedKey = true
  const response = await post({ operation: 'edit', id: 'private', keys: [key], text: publicCard.text, topic: 'Growth', reviewStatus: 'approved' })
  assert.equal(response.status, 200)
  const updated = calls.find(call => call.method === 'update')
  assert.deepEqual(updated.context.ownedCardIDs, ['private'])
  assert.deepEqual(updated.data, { text: publicCard.text, topic: 'Growth' })
  assert.equal('authorName' in (await response.json()).card, false)
})

test('empty browser keys never reveal old account submissions', async () => {
  const response = await post({ operation: 'owned', keys: [] })
  assert.deepEqual(await response.json(), { cards: [] })
  assert.equal(calls.length, 0)
})

test('posting retries reuse the original submission instead of making a duplicate', async () => {
  matchedKey = true
  const response = await post({ operation: 'post', key, text: publicCard.text, topic: 'Life' })
  assert.equal(response.status, 200)
  assert.equal(calls.some(call => call.method === 'create'), false)
})

test('anonymous visitors cannot read the review queue, review cards, or create accounts', async () => {
  assert.equal((await post({ operation: 'review-queue' })).status, 403)
  assert.equal((await post({ operation: 'review', id: 'private', status: 'approved' })).status, 403)
  assert.equal((await post({ operation: 'signup', email: 'ignored@example.test' })).status, 410)
  assert.equal(calls.some(call => call.method === 'create' || call.method === 'update'), false)
})

test('staff review includes anonymous cards with no author relationship', async () => {
  currentUser = { id: 'staff', collection: 'users', role: 'reviewer' }
  const response = await post({ operation: 'review-queue' })
  assert.equal(response.status, 200)
  const query = calls.find(call => call.collection === 'cards')
  assert.deepEqual(query.where.and[1], { or: [{ author: { not_equals: 'staff' } }, { author: { exists: false } }] })
})

test('legacy import verifies ownership and adds resource keys without updating old records', async () => {
  const response = await post({ operation: 'import-legacy', email: 'owner@example.test', password: 'test-password' })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.keys.length, 1)
  assert.match(data.keys[0], /^[a-f0-9]{64}$/)
  const read = calls.find(call => call.collection === 'cards')
  assert.deepEqual(read.where, { author: { equals: 'legacy-owner' } })
  assert.equal(read.user.id, 'legacy-owner')
  const created = calls.find(call => call.method === 'create')
  assert.equal(created.collection, 'card-keys')
  assert.deepEqual(Object.keys(created.data), ['card', 'keyHash'])
  assert.equal(created.data.keyHash, hashKey(data.keys[0]))
  assert.equal(calls.some(call => call.method === 'update'), false)
  assert.equal('email' in data, false)
})

test('cross-site and malformed requests are rejected without writing', async () => {
  const blocked = await POST(new Request('http://example.test/api/community', { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: '{"operation":"post"}' }))
  assert.equal(blocked.status, 403)
  assert.equal((await POST(new Request('http://example.test/api/community', { method: 'POST', body: 'not-json' }))).status, 400)
  assert.equal(calls.length, 0)
})
