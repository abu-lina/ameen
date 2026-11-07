'use server'

import { getSupabaseServer } from '@/lib/supabase/server'
import { CATEGORIES, type DuaCategory } from './types'

const MAX_TEXT_LENGTH = 500

export async function postDua(text: string, category: DuaCategory) {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > MAX_TEXT_LENGTH) {
    return { error: 'Text must be 1-500 characters' }
  }
  if (!CATEGORIES.includes(category)) {
    return { error: 'Invalid category' }
  }

  const supabase = await getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('duas')
    .insert({ text: trimmed, category, author_id: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { id: data.id }
}

export async function editDua(id: string, text: string, category: DuaCategory) {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > MAX_TEXT_LENGTH) {
    return { error: 'Text must be 1-500 characters' }
  }
  if (!CATEGORIES.includes(category)) {
    return { error: 'Invalid category' }
  }

  const supabase = await getSupabaseServer()
  const { error } = await supabase
    .from('duas')
    .update({ text: trimmed, category, status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteDua(id: string) {
  const supabase = await getSupabaseServer()
  const { error } = await supabase.from('duas').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}
