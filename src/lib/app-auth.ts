import 'server-only'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

const appSessionCookieOptions = { httpOnly: true, secure: true, sameSite: 'none', path: '/' } as const

export function createAppAuth(collection: 'users') {
  async function authenticate(email: string, password: string) {
    const payload = await getPayload({ config })
    const result = await payload.login({ collection, data: { email, password } })
    if (!result.token || !result.user) throw new Error('Unable to sign in.')
    return { token: result.token, user: result.user }
  }
  return {
    async verify(email: string, password: string) {
      return (await authenticate(email, password)).user
    },
    async currentUser() {
      const token = (await cookies()).get('app-session')?.value
      if (!token) return null
      const payload = await getPayload({ config })
      const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
      return user?.collection === collection ? user : null
    },
    async login(email: string, password: string) {
      const result = await authenticate(email, password)
      ;(await cookies()).set('app-session', result.token, { ...appSessionCookieOptions, maxAge: 7200 })
      return result.user
    },
    async logout() { (await cookies()).set('app-session', '', { ...appSessionCookieOptions, maxAge: 0 }) },
  }
}
export const appAuth = createAppAuth('users')
