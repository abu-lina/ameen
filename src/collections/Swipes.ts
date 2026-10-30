import type { Access, CollectionConfig } from 'payload'
const own: Access = ({ req }) => req.user?.collection === 'users' ? { owner: { equals: req.user.id } } : false
export const Swipes: CollectionConfig = {
  slug: 'swipes',
  access: { create: ({ req }) => req.user?.collection === 'users', read: own, update: () => false, delete: own },
  hooks: { beforeValidate: [async ({ data, req, operation }) => {
    if (data && operation === 'create') {
      if (req.user?.collection !== 'users') throw new Error('Please log in.')
      data.owner = req.user.id
      const card = await req.payload.findByID({ collection: 'cards', id: data.card, overrideAccess: false, user: req.user, req })
      if (card.reviewStatus !== 'approved') throw new Error('Only approved cards can be swiped.')
    }
    return data
  }] },
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'users', access: { create: () => false, update: () => false } },
    { name: 'card', type: 'relationship', relationTo: 'cards', required: true },
    { name: 'action', type: 'select', required: true, options: ['pass', 'save', 'resonate'] },
  ],
}
