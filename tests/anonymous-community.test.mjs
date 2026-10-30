import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'
import { advanceInteraction, emptyInteractions, UNDO_WINDOW_MS } from '../src/lib/interaction-state.ts'
import { emptyLibrary, parseLibrary, newDeviceKey } from '../src/lib/device-library.ts'
import { canManageCard, hashKey } from '../src/lib/card-keys.ts'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context) }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context)
      throw error
    }
  },
})
const { Cards } = await import('../src/collections/Cards.ts')
const { CardInteractions } = await import('../src/collections/CardInteractions.ts')
const { CardKeys } = await import('../src/collections/CardKeys.ts')
const { Users } = await import('../src/collections/Users.ts')
const { recordInteraction, pruneInteractionReceipts } = await import('../src/lib/card-interactions.ts')
const key = 'a'.repeat(64)

for (const action of ['pass', 'save', 'resonate']) {
  test(`${action} totals are idempotent, undoable once, and contain no visitor identity`, () => {
    const intent = { hash: hashKey(key), action }
    const initial = emptyInteractions()
    const first = advanceInteraction(initial, intent, 100)
    assert.equal(first.state[action], 1)
    assert.equal(advanceInteraction(first.state, intent, 101).changed, false)
    const undone = advanceInteraction(first.state, { ...intent, undo: true }, 102)
    assert.equal(undone.state[action], 0)
    assert.equal(advanceInteraction(undone.state, { ...intent, undo: true }, 103).changed, false)
    assert.equal(advanceInteraction(undone.state, intent, 104).changed, false)
    assert.deepEqual(Object.keys(first.state.receipts[0]), ['hash', 'action', 'undone', 'expiresAt'])
    assert.equal(JSON.stringify(first.state).includes(key), false)
  })
}

test('an unknown, mismatched, or expired receipt cannot decrement a count', () => {
  const intent = { hash: hashKey(key), action: 'resonate' }
  assert.throws(() => advanceInteraction(emptyInteractions(), { ...intent, undo: true }, 100), /window has ended/)
  const first = advanceInteraction(emptyInteractions(), intent, 100).state
  assert.throws(() => advanceInteraction(first, { ...intent, action: 'save', undo: true }, 101), /different action/)
  assert.throws(() => advanceInteraction(first, { ...intent, undo: true }, 100 + UNDO_WINDOW_MS), /window has ended/)
})

test('browser library round-trips without account fields and retains drafts and private keys', () => {
  const library = emptyLibrary()
  library.keys.push(newDeviceKey())
  library.draft = { text: 'My father taught me kindness.', topic: 'Life', key: library.keys[0] }
  assert.match(library.keys[0], /^[a-f0-9]{64}$/)
  assert.deepEqual(parseLibrary(JSON.stringify(library)), library)
  assert.deepEqual(parseLibrary(null), emptyLibrary())
  for (const field of ['user', 'email', 'password', 'name', 'deviceId']) assert.equal(field in library, false)
})

test('corrupt browser storage is rejected rather than silently reset', () => {
  assert.throws(() => parseLibrary('not-json'))
  assert.throws(() => parseLibrary('{"version":2}'), /not been overwritten/)
  assert.throws(() => parseLibrary(JSON.stringify({ ...emptyLibrary(), keys: ['not-a-key'] })), /not been overwritten/)
})

test('anonymous management requires verified resource ownership, not a caller-supplied author', () => {
  assert.equal(canManageCard({ user: null, context: {} }, { id: 'card', author: 'reader' }), false)
  assert.equal(canManageCard({ user: null, context: { ownedCardIDs: ['card'] } }, { id: 'card' }), true)
  assert.equal(canManageCard({ user: null, context: { ownedCardIDs: ['other'] } }, { id: 'card' }), false)
})

test('anonymous creation never stores a visitor name and always starts in review', () => {
  const req = { context: { newCardKeyHash: hashKey(key) }, user: null }
  const data = Cards.hooks.beforeValidate[0]({
    operation: 'create', data: { text: 'My father taught me kindness.', author: 'forged', authorName: 'forged' }, req,
  })
  assert.equal(data.author, null)
  assert.equal(data.authorName, null)
  assert.equal(data.managementKeyHash, hashKey(key))
  const moderated = Cards.hooks.beforeChange[0]({ operation: 'create', data: { ...data, reviewStatus: 'approved', reviewedBy: 'forged' }, req })
  assert.equal(moderated.reviewStatus, 'pending')
  assert.equal(moderated.reviewedBy, null)
  assert.equal(Cards.access.create({ req: { user: null, context: {} } }), false)
})

test('managed editing returns a card to review and unrelated browsers cannot edit', () => {
  const originalDoc = { id: 'card', text: 'My father taught me kindness.', topic: 'Life', reviewStatus: 'approved' }
  const args = { operation: 'update', originalDoc, data: { text: 'My brother is always there for me.' } }
  assert.throws(() => Cards.hooks.beforeChange[0]({ ...args, req: { user: null, context: {} } }), /Only the author/)
  const updated = Cards.hooks.beforeChange[0]({ ...args, req: { user: null, context: { ownedCardIDs: ['card'] } } })
  assert.equal(updated.reviewStatus, 'pending')
})

test('reviewers cannot approve cards managed in their known browser', () => {
  assert.throws(() => Cards.hooks.beforeChange[0]({
    operation: 'update', originalDoc: { id: 'card', text: 'My father taught me kindness.', reviewStatus: 'pending' },
    data: { reviewStatus: 'approved' },
    req: { user: { id: 'staff', collection: 'users', role: 'reviewer' }, context: { ownedCardIDs: ['card'] } },
  }), /independent reviewer/)
})

test('new private collections and visitor signup are closed to direct public writes', () => {
  const req = { user: null, context: {} }
  assert.equal(CardKeys.access.create({ req }), false)
  assert.equal(CardKeys.access.read({ req }), false)
  assert.equal(CardInteractions.access.create({ req }), false)
  assert.equal(CardInteractions.access.read({ req }), false)
  assert.equal(CardInteractions.access.update({ req }), false)
  assert.equal(CardInteractions.access.delete({ req }), false)
  assert.equal(Users.access.create({ req }), false)
})

function counterStore(beforeCreate = async () => {}) {
  const docs = []
  const payload = {
    async find(options) {
      assert.equal(options.overrideAccess, false)
      await new Promise(resolve => setImmediate(resolve))
      return { docs: structuredClone(docs.filter(doc => doc.card === options.where.card.equals).sort((a, b) => b.revision - a.revision).slice(0, 1)) }
    },
    async create(options) {
      assert.equal(options.overrideAccess, false)
      await beforeCreate(options.data)
      if (docs.some(doc => doc.checkpointKey === options.data.checkpointKey)) throw new Error('Duplicate checkpoint')
      const doc = { id: newDeviceKey(), ...structuredClone(options.data) }
      docs.push(doc)
      return doc
    },
    async delete(options) {
      assert.equal(options.overrideAccess, false)
      const [card, revision] = options.where.and
      for (let i = docs.length - 1; i >= 0; i--) if (docs[i].card === card.card.equals && docs[i].revision < revision.revision.less_than) docs.splice(i, 1)
      return { docs: [] }
    },
  }
  return { payload, docs }
}

test('concurrent counter updates and duplicate deliveries retain every distinct interaction', async () => {
  const store = counterStore()
  const keys = Array.from({ length: 6 }, () => newDeviceKey())
  await Promise.all(keys.flatMap(key => [recordInteraction(store, 'card', key, 'resonate'), recordInteraction(store, 'card', key, 'resonate')]))
  const latest = store.docs.sort((a, b) => b.revision - a.revision)[0]
  assert.equal(latest.resonate, keys.length)
  await Promise.all(keys.map(key => recordInteraction(store, 'card', key, 'resonate', true)))
  assert.equal(store.docs.sort((a, b) => b.revision - a.revision)[0].resonate, 0)
})

test('a delayed writer cannot lose its action when an older checkpoint was compacted', async () => {
  const delayedKey = newDeviceKey()
  let release, entered
  const blocked = new Promise(resolve => { entered = resolve })
  const barrier = new Promise(resolve => { release = resolve })
  const store = counterStore(async data => {
    if (data.revision === 1 && data.receipts.some(receipt => receipt.hash === hashKey(delayedKey))) { entered(); await barrier }
  })
  const delayed = recordInteraction(store, 'card', delayedKey, 'resonate')
  await blocked
  await recordInteraction(store, 'card', newDeviceKey(), 'resonate')
  await recordInteraction(store, 'card', newDeviceKey(), 'resonate')
  release()
  await delayed
  assert.equal(store.docs.sort((a, b) => b.revision - a.revision)[0].resonate, 3)
  assert.equal(store.docs.length, 1)
})

test('receipt compaction preserves aggregate totals while removing expired proof', async () => {
  const store = counterStore()
  store.docs.push({ id: 'old', card: 'card', checkpointKey: 'old', revision: 1, pass: 3, save: 2, resonate: 4, receipts: [{ hash: hashKey(key), action: 'resonate', undone: false, expiresAt: 1 }] })
  await pruneInteractionReceipts(store, 'card')
  assert.equal(store.docs.length, 1)
  assert.deepEqual(store.docs[0].receipts, [])
  assert.equal(store.docs[0].resonate, 4)
})
