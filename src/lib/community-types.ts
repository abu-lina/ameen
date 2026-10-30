import type { Card as StoredCard } from '@/payload-types'

export type CardID = StoredCard['id']
export type Topic = StoredCard['topic']
export type CommunityCard = Pick<StoredCard, 'id' | 'text' | 'topic' | 'reviewStatus' | 'rejectionReason' | 'resonateCount'>
export type LocalChoice = { key: string; card: CommunityCard; action: 'pass' | 'save' | 'resonate'; createdAt: number; imported?: boolean }
export type CounterEvent = { key: string; card: CardID; action: LocalChoice['action']; undo: boolean; createdAt: number }
export type DeviceLibrary = {
  version: 1
  keys: string[]
  history: LocalChoice[]
  outbox: CounterEvent[]
  draft: { text: string; topic: Topic; key?: string }
}
