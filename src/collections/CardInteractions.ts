import { APIError, type CollectionConfig } from 'payload'
import { validKey } from '../lib/card-keys'
import { INTERACTION_ACTIONS } from '../lib/interaction-state'

export const CardInteractions: CollectionConfig = {
  slug: 'card-interactions',
  admin: { hidden: true },
  access: {
    create: ({ req }) => req.context?.interactionWrite === true,
    read: ({ req }) => req.context?.interactionRead === true || req.context?.interactionWrite === true,
    update: () => false,
    delete: ({ req }) => req.context?.interactionWrite === true,
  },
  hooks: { beforeValidate: [async ({ data, req }) => {
    if (!data || req.context?.interactionWrite !== true) throw new APIError('Counter access denied.', 403)
    const card = await req.payload.findByID({
      collection: 'cards', id: data.card, overrideAccess: false, user: req.user, req,
      select: { reviewStatus: true },
    })
    if (card.reviewStatus !== 'approved') throw new APIError('Only approved cards can receive interactions.', 400)
    if (!Number.isSafeInteger(data.revision) || data.revision < 1 ||
      !INTERACTION_ACTIONS.every(action => Number.isSafeInteger(data[action]) && data[action] >= 0) ||
      !Array.isArray(data.receipts) || data.receipts.length > 2000 ||
      !data.receipts.every((receipt: { hash?: unknown; action?: unknown; undone?: unknown; expiresAt?: unknown }) =>
        validKey(receipt.hash) && INTERACTION_ACTIONS.includes(receipt.action as typeof INTERACTION_ACTIONS[number]) &&
        typeof receipt.undone === 'boolean' && typeof receipt.expiresAt === 'number' && Number.isFinite(receipt.expiresAt))) {
      throw new APIError('Invalid counter checkpoint.', 400)
    }
    return data
  }] },
  fields: [
    { name: 'card', type: 'relationship', relationTo: 'cards', required: true, index: true },
    { name: 'checkpointKey', type: 'text', required: true, unique: true, index: true },
    { name: 'revision', type: 'number', required: true, index: true },
    { name: 'pass', type: 'number', required: true, defaultValue: 0 },
    { name: 'save', type: 'number', required: true, defaultValue: 0 },
    { name: 'resonate', type: 'number', required: true, defaultValue: 0 },
    { name: 'receipts', type: 'json', required: true, defaultValue: [] },
  ],
}
