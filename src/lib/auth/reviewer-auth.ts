import { getSupabaseBrowser } from '@/lib/supabase/client'

export async function reviewerLogin(email: string, password: string) {
  const supabase = getSupabaseBrowser()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function reviewerLogout() {
  const supabase = getSupabaseBrowser()
  await supabase.auth.signOut()
  await supabase.auth.signInAnonymously()
}
