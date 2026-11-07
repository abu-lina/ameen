import { getSupabaseServer } from '@/lib/supabase/server'
import { anonymizeDua } from './privacy'

export async function getFeed(limit = 20) {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .rpc('get_feed', { p_user_id: user?.id, p_limit: limit })

  if (error) throw error
  return (data ?? []).map(anonymizeDua)
}
