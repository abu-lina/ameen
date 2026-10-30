import type { Access, CollectionConfig } from 'payload'
import { isCMSAdmin } from '../lib/review-access'
const own: Access = ({ req }) => isCMSAdmin(req) ? true : req.user?.collection === 'users' ? { id: { equals: req.user.id } } : false
export const Users: CollectionConfig = {
  slug: 'users', auth: true, admin: { useAsTitle: 'name' },
  access: { create: ({ req }) => isCMSAdmin(req), read: own, update: own, delete: own, admin: () => false },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 60 },
    { name: 'role', type: 'select', defaultValue: 'user', options: ['user', 'reviewer'],
      access: { create: ({ req }) => isCMSAdmin(req), update: ({ req }) => isCMSAdmin(req) },
      admin: { description: 'Only CMS admins can assign reviewers. Reviewers cannot approve their own cards.' } },
  ],
}
