export const UNDO_WINDOW_MS = 10 * 60 * 1000
export const INTERACTION_ACTIONS = ['pass', 'save', 'resonate'] as const
export type InteractionAction = typeof INTERACTION_ACTIONS[number]
export type Receipt = { hash: string; action: InteractionAction; undone: boolean; expiresAt: number }
export type InteractionState = { pass: number; save: number; resonate: number; receipts: Receipt[] }
export const emptyInteractions = (): InteractionState => ({ pass: 0, save: 0, resonate: 0, receipts: [] })
export class InteractionError extends Error {}

export function advanceInteraction(state: InteractionState, intent: { hash: string; action: InteractionAction; undo?: boolean }, now = Date.now()) {
  const receipts = state.receipts.filter(receipt => receipt.expiresAt > now)
  const receipt = receipts.find(receipt => receipt.hash === intent.hash)
  if (receipt && receipt.action !== intent.action) throw new InteractionError('This receipt belongs to a different action.')
  if (intent.undo) {
    if (!receipt) throw new InteractionError('The shared-count Undo window has ended. Your local choice can still be undone.')
    if (receipt.undone) return { state, changed: false }
    return {
      state: { ...state, [intent.action]: Math.max(0, state[intent.action] - 1), receipts: receipts.map(item => item.hash === intent.hash ? { ...item, undone: true } : item) },
      changed: true,
    }
  }
  if (receipt) return { state, changed: false }
  if (receipts.length >= 2000) throw new InteractionError('A lot of thoughts are being shared right now. Please try again in a moment.')
  return {
    state: { ...state, [intent.action]: state[intent.action] + 1, receipts: [...receipts, { hash: intent.hash, action: intent.action, undone: false, expiresAt: now + UNDO_WINDOW_MS }] },
    changed: true,
  }
}
