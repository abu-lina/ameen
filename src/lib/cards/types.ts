export const CATEGORIES = ['health', 'guidance', 'hardship', 'gratitude', 'family', 'general'] as const
export type DuaCategory = (typeof CATEGORIES)[number]
export type DuaStatus = 'pending' | 'approved' | 'rejected'

export interface Dua {
  id: string
  text: string
  category: DuaCategory
  status: DuaStatus
  created_at: string
  updated_at: string
}

export interface DuaWithCount extends Dua {
  ameenCount: number
}

export interface FeedDua {
  id: string
  text: string
  category: DuaCategory
  created_at: string
  ameen_count: number
}
