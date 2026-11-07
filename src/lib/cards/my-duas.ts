import { getSupabaseServer } from '@/lib/supabase/server'

export async function getMyDuas() {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('duas')
    .select('id, text, category, status, created_at, updated_at')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error

  const duaIds = (data ?? []).map(d => d.id)
  if (duaIds.length === 0) return []

  const { data: stats } = await supabase
    .from('dua_stats')
    .select('dua_id, ameen_count')
    .in('dua_id', duaIds)

  const countMap = new Map((stats ?? []).map(s => [s.dua_id, s.ameen_count]))
  return (data ?? []).map(d => ({ ...d, ameenCount: countMap.get(d.id) ?? 0 }))
}
