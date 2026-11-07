import type { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'user' | 'reviewer'

export async function getUserRole(supabase: SupabaseClient): Promise<UserRole> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'user'
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (data?.role as UserRole) ?? 'user'
}

export async function isReviewer(supabase: SupabaseClient): Promise<boolean> {
  return (await getUserRole(supabase)) === 'reviewer'
}
