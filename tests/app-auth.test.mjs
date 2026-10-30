import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'

const cookieValues = new Map()
const writes = []
let payloadCalls = 0
let authHeaders
globalThis.__stillAuthTest = {
  cookies: {
    get: name => cookieValues.has(name) ? { name, value: cookieValues.get(name) } : undefined,
    set: (name, value, options) => {
      writes.push({ name, value, options })
      if (options.maxAge === 0) cookieValues.delete(name)
      else cookieValues.set(name, value)
    },
  },
  getPayload: async () => {
    payloadCalls += 1
    return {
      login: async () => ({ token: 'test-app-token', user: { id: 'reader', collection: 'users' } }),
      auth: async ({ headers }) => { authHeaders = headers; return { user: { id: 'reader', collection: 'users' } } },
    }
  },
}

const modules = {
  'server-only': '',
  'next/headers': 'export const cookies = async () => globalThis.__stillAuthTest.cookies',
  payload: 'export const getPayload = (...args) => globalThis.__stillAuthTest.getPayload(...args)',
  '@payload-config': 'export default {}',
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(modules, specifier)) return { url: `still-auth-test:${specifier}`, shortCircuit: true }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.startsWith('still-auth-test:')) {
      return { format: 'module', source: modules[url.slice('still-auth-test:'.length)], shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})
const { createAppAuth } = await import('../src/lib/app-auth.ts')
const auth = createAppAuth('users')

test.beforeEach(() => {
  cookieValues.clear()
  writes.length = 0
  payloadCalls = 0
  authHeaders = undefined
})

test('login and logout use the same secure, iframe-compatible app cookie scope', async () => {
  await auth.login('reader@example.test', 'test-password')
  const login = writes[0]
  assert.equal(login.name, 'app-session')
  assert.equal(login.options.maxAge, 7200)
  await auth.logout()
  assert.deepEqual(writes[1], {
    name: 'app-session', value: '',
    options: { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 0 },
  })
  assert.deepEqual({ ...login.options, maxAge: 0 }, writes[1].options)
})

test('logout clears only the app session and does not initialize Payload', async () => {
  cookieValues.set('app-session', 'test-app-token')
  cookieValues.set('payload-token', 'test-cms-token')
  cookieValues.set('unrelated-preference', 'keep')
  await auth.logout()
  assert.equal(cookieValues.has('app-session'), false)
  assert.equal(cookieValues.get('payload-token'), 'test-cms-token')
  assert.equal(cookieValues.get('unrelated-preference'), 'keep')
  assert.equal(payloadCalls, 0)
})

test('repeating logout is safe when the app session is already gone', async () => {
  await auth.logout()
  await auth.logout()
  assert.equal(cookieValues.has('app-session'), false)
  assert.equal(payloadCalls, 0)
  assert.equal(writes.length, 2)
})

test('legacy ownership verification does not create or replace any browser session', async () => {
  cookieValues.set('app-session', 'existing-reviewer-session')
  cookieValues.set('payload-token', 'existing-cms-session')
  const user = await auth.verify('owner@example.test', 'test-password')
  assert.equal(user.id, 'reader')
  assert.equal(writes.length, 0)
  assert.equal(cookieValues.get('app-session'), 'existing-reviewer-session')
  assert.equal(cookieValues.get('payload-token'), 'existing-cms-session')
})

test('current-user lookup isolates the app token from CMS cookies', async () => {
  cookieValues.set('app-session', 'test-app-token')
  cookieValues.set('payload-token', 'test-cms-token')
  const user = await auth.currentUser()
  assert.equal(user.collection, 'users')
  assert.deepEqual([...authHeaders.entries()], [['authorization', 'JWT test-app-token']])
  await auth.logout()
  assert.equal(await auth.currentUser(), null)
  assert.equal(payloadCalls, 1)
})
