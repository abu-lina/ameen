'use server'

import { getSupabaseServer } from '@/lib/supabase/server'

export async function recordInteraction(duaId: string, action: 'ameen' | 'pass') {
  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('ameen_interactions')
    .upsert(
      { dua_id: duaId, user_id: user.id, action },
      { onConflict: 'dua_id,user_id' },
    )

  if (error) return { error: error.message }
  return { success: true }
}

export async function undoPass(duaId: string) {
  const supabase = await getSupabaseServer()
  const { error } = await supabase
    .from('ameen_interactions')
    .delete()
    .eq('dua_id', duaId)
    .eq('action', 'pass')

  if (error) return { error: error.message }
  return { success: true }
}

export async function getAmeenHistory() {
  const supabase = await getSupabaseServer()
  const { data, error } = await supabase
    .from('ameen_interactions')
    .select('dua_id, action, created_at')
    .eq('action', 'ameen')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}
