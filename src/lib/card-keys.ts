import { createHash, randomBytes } from 'node:crypto'
import type { PayloadRequest } from 'payload'

export const validKey = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
export const makeKey = () => randomBytes(32).toString('hex')
export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')
export const ownedCardIDs = (req: Pick<PayloadRequest, 'context'>): (string | number)[] =>
  Array.isArray(req.context?.ownedCardIDs) ? req.context.ownedCardIDs : []
export function canManageCard(req: Pick<PayloadRequest, 'context' | 'user'>, card: { id?: string | number; author?: unknown }) {
  const author = typeof card.author === 'object' && card.author ? (card.author as { id?: string | number }).id : card.author
  return (req.user?.collection === 'users' && author != null && String(author) === String(req.user.id)) ||
    (card.id != null && ownedCardIDs(req).some(id => String(id) === String(card.id)))
}
