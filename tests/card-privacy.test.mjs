import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'
import { anonymousCard } from '../src/lib/card-privacy.ts'

// Match the app's extensionless TS imports without introducing a test-runner dependency.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context) }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context)
      }
      throw error
    }
  },
})
const { Cards } = await import('../src/collections/Cards.ts')

for (const id of ['card-id', 42]) {
  test(`card ${id} exposes content without poster or reviewer identities`, () => {
    const source = {
      id, text: 'A little kindness goes a long way.', topic: 'Life',
      resonateCount: 3, reviewStatus: 'approved', rejectionReason: null,
      author: { id: 'private-user', name: 'Private name', email: 'private@example.com' },
      authorName: 'Private name', reviewedBy: 'private-reviewer', privateFutureField: 'private',
    }
    const card = anonymousCard(source)
    assert.deepEqual(card, {
      id, text: source.text, topic: 'Life', resonateCount: 3,
      reviewStatus: 'approved', rejectionReason: null,
    })
    assert.equal(source.authorName, 'Private name', 'stored ownership is not mutated')
    assert.equal(JSON.stringify({ id: 'swipe', action: 'save', card }).includes('private'), false)
  })
}

test('author and reviewer views retain status and rejection guidance without attribution', () => {
  const card = anonymousCard({
    id: 'submission', text: 'A little kindness goes a long way.', topic: 'Life',
    reviewStatus: 'rejected', rejectionReason: 'Please leave out identifying details.',
    authorName: 'Private name',
  })
  assert.equal(card.reviewStatus, 'rejected')
  assert.equal(card.rejectionReason, 'Please leave out identifying details.')
  assert.equal('authorName' in card, false)
})

const authorField = Cards.fields.find(field => field.name === 'author')
const nameField = Cards.fields.find(field => field.name === 'authorName')
for (const user of [null, { collection: 'users', id: 'reader', role: 'user' }, { collection: 'users', id: 'reviewer', role: 'reviewer' }]) {
  test(`direct card reads hide the poster from ${user?.role || 'anonymous visitors'}`, () => {
    const args = { req: { user }, doc: { author: 'owner', authorName: 'Private name' } }
    assert.equal(authorField.access.read(args), false)
    assert.equal(nameField.access.read(args), false)
  })
}

test('ownership remains readable to its owner and CMS staff for permission checks', () => {
  assert.equal(authorField.access.read({ req: { user: { collection: 'users', id: 'owner' } }, doc: { author: 'owner' } }), true)
  assert.equal(authorField.access.read({ req: { user: { collection: 'admins', id: 'admin' } }, doc: { author: 'owner' } }), true)
  assert.equal(nameField.access.read({ req: { user: { collection: 'users', id: 'owner' } } }), false)
})

for (const role of ['user', 'reviewer']) {
  test(`${role} can validate ownership filters during signed-in loading without exposing other authors`, () => {
    const req = { user: { collection: 'users', id: 'reader', role } }
    // Payload validates query-field permissions before a document is available.
    assert.equal(authorField.access.read({ req }), true)
    assert.equal(authorField.access.read({ req, doc: { author: 'someone-else' } }), false)
    assert.equal(nameField.access.read({ req }), false)
  })
}

test('anonymous visitors cannot query private ownership fields', () => {
  assert.equal(authorField.access.read({ req: { user: null } }), false)
})

const beforeChange = Cards.hooks.beforeChange[0]
const originalDoc = { id: 'card', author: 'owner', text: 'A little kindness goes a long way.', topic: 'Life', reviewStatus: 'pending' }

test('reviewers still cannot approve their own anonymous cards', () => {
  assert.throws(() => beforeChange({
    operation: 'update', data: { reviewStatus: 'approved' }, originalDoc,
    req: { user: { collection: 'users', id: 'owner', role: 'reviewer' } },
  }), /independent reviewer/)
})

test('an independent reviewer can approve an anonymous card', () => {
  const result = beforeChange({
    operation: 'update', data: { reviewStatus: 'approved' }, originalDoc,
    req: { user: { collection: 'users', id: 'reviewer', role: 'reviewer' } },
  })
  assert.equal(result.reviewStatus, 'approved')
  assert.equal(result.reviewedBy, 'reviewer')
})

test('authors can still edit their cards and send them back for review', () => {
  const result = beforeChange({
    operation: 'update', data: { text: 'My father taught me kindness.' },
    originalDoc: { ...originalDoc, reviewStatus: 'approved' },
    req: { user: { collection: 'users', id: 'owner', role: 'user' } },
  })
  assert.equal(result.reviewStatus, 'pending')
})
