'use client'

import { useEffect } from 'react'
import { ensureAnonymousSession } from '@/lib/auth/anonymous-auth'

export function AuthInit() {
  useEffect(() => {
    ensureAnonymousSession()
  }, [])
  return null
}
