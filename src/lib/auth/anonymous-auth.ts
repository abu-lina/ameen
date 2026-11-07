import { getSupabaseBrowser } from '@/lib/supabase/client'

export async function ensureAnonymousSession() {
  const supabase = getSupabaseBrowser()
  const { data: { session } } = await supabase.auth.getSession()
  if (session) return session
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.session
}
