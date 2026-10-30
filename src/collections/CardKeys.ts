import { APIError, type CollectionConfig } from 'payload'
import { isCMSAdmin } from '../lib/review-access'
import { canManageCard, validKey } from '../lib/card-keys'

// Additional resource keys let verified legacy owners import without changing old cards.
export const CardKeys: CollectionConfig = {
  slug: 'card-keys',
  admin: { hidden: true },
  access: {
    create: ({ req }) => req.context?.legacyKeyGrant === true && req.user?.collection === 'users',
    read: ({ req }) => req.context?.keyLookup === true || isCMSAdmin(req),
    update: () => false,
    delete: () => false,
  },
  hooks: { beforeValidate: [async ({ data, req, operation }) => {
    if (operation !== 'create' || !data || !validKey(data.keyHash)) throw new APIError('Invalid management key.', 400)
    const card = await req.payload.findByID({ collection: 'cards', id: data.card, overrideAccess: false, user: req.user, req })
    if (!canManageCard({ user: req.user, context: {} }, card)) throw new APIError('Only the previous account owner can import this card.', 403)
    return data
  }] },
  fields: [
    { name: 'keyHash', type: 'text', required: true, unique: true, index: true },
    { name: 'card', type: 'relationship', relationTo: 'cards', required: true, index: true },
  ],
}
