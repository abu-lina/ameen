import { APIError, type Access, type AccessResult, type CollectionConfig } from 'payload'
import { POST_CHARACTER_LIMIT } from '../lib/post-limits'
import { moderatePost } from '../lib/post-moderation'
import { isCMSAdmin, isReviewer } from '../lib/review-access'
import { canManageCard, ownedCardIDs, validKey } from '../lib/card-keys'
import { readInteractions } from '../lib/card-interactions'
const own: Access = ({ req }) => req.user?.collection === 'users' ? { author: { equals: req.user.id } } : false
const reviewField = {
  create: () => false,
  update: ({ req }: { req: import('payload').PayloadRequest }) => isReviewer(req),
}
export const Cards: CollectionConfig = {
  slug: 'cards', admin: { useAsTitle: 'text' },
  access: {
    read: ({ req }): AccessResult => isCMSAdmin(req) || isReviewer(req) ? true : {
      or: [
        { reviewStatus: { equals: 'approved' } },
        ...(req.user?.collection === 'users' ? [{ author: { equals: req.user.id } }] : []),
        ...(ownedCardIDs(req).length ? [{ id: { in: ownedCardIDs(req) } }] : []),
        ...(Array.isArray(req.context?.managementHashes) && req.context.managementHashes.length ? [{ managementKeyHash: { in: req.context.managementHashes } }] : []),
      ],
    },
    create: ({ req }) => validKey(req.context?.newCardKeyHash) || isCMSAdmin(req),
    update: ({ req }): AccessResult => isReviewer(req) || isCMSAdmin(req) ? true : {
      or: [
        ...(req.user?.collection === 'users' ? [{ author: { equals: req.user.id } }] : []),
        { id: { in: ownedCardIDs(req) } },
      ],
    },
    delete: own,
  },
  hooks: { beforeChange: [({ data, req, operation, originalDoc }) => {
    if (!data) return data
    const contentChanged = operation === 'update' &&
      ((data.text !== undefined && data.text !== originalDoc.text) ||
       (data.topic !== undefined && data.topic !== originalDoc.topic))
    if (contentChanged && !isCMSAdmin(req) && !canManageCard(req, originalDoc)) {
      throw new APIError('Only the author can edit a card.', 403)
    }
    if (operation === 'create' || contentChanged) {
      data.reviewStatus = 'pending'
      data.rejectionReason = null
      data.reviewedAt = null
      data.reviewedBy = null
    } else if (data.reviewStatus && data.reviewStatus !== originalDoc?.reviewStatus) {
      if (!isReviewer(req) || canManageCard(req, originalDoc)) throw new APIError('An independent reviewer must review this card.', 403)
      if (!['approved', 'rejected'].includes(data.reviewStatus)) throw new APIError('Choose approve or reject.', 400)
      if (data.reviewStatus === 'approved') {
        const rejection = moderatePost(originalDoc.text)
        if (rejection) throw new APIError(rejection.message, 400)
      }
      const reason = typeof data.rejectionReason === 'string' ? data.rejectionReason.trim() : ''
      if (data.reviewStatus === 'rejected' && (!reason || reason.length > 500)) throw new APIError('Give a rejection reason of 1–500 characters.', 400)
      data.rejectionReason = data.reviewStatus === 'rejected' ? reason : null
      data.reviewedAt = new Date().toISOString()
      data.reviewedBy = req.user!.id
    }
    return data
  }], beforeValidate: [({ data, req, operation }) => {
    if (typeof data?.text === 'string') {
      const rejection = moderatePost(data.text)
      if (rejection) throw new APIError(rejection.message, 400)
    }
    if (data && operation === 'create' && validKey(req.context?.newCardKeyHash)) {
      data.managementKeyHash = req.context.newCardKeyHash
      data.author = isReviewer(req) ? req.user!.id : null
      data.authorName = null
    }
    return data
  }] },
  fields: [
    { name: 'text', type: 'textarea', required: true, minLength: 10, maxLength: POST_CHARACTER_LIMIT },
    { name: 'topic', type: 'select', required: true, defaultValue: 'Life', options: ['Life', 'Creativity', 'Growth', 'Connection'] },
    { name: 'author', type: 'relationship', relationTo: 'users', access: {
      create: () => false,
      update: () => false,
      read: ({ req, doc }) => {
        if (isCMSAdmin(req)) return true
        // Query permission checks have no document; allow app-user ownership filters,
        // then restrict the actual field value when Payload reads each card.
        if (!doc) return req.user?.collection === 'users'
        const author = doc?.author
        const authorID = typeof author === 'object' && author ? author.id : author
        return req.user?.collection === 'users' && String(authorID) === String(req.user.id)
      },
    } },
    { name: 'authorName', type: 'text', access: { create: () => false, update: () => false, read: ({ req }) => isCMSAdmin(req) } },
    { name: 'managementKeyHash', type: 'text', index: true, unique: true,
      access: { create: () => false, update: () => false, read: ({ req, doc }) => !doc && Array.isArray(req.context?.managementHashes) },
      admin: { hidden: true } },
    { name: 'reviewStatus', type: 'select', defaultValue: 'pending', options: ['pending', 'approved', 'rejected'], access: reviewField, index: true },
    { name: 'rejectionReason', type: 'textarea', maxLength: 500, access: reviewField },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'users', access: { create: () => false, update: () => false } },
    { name: 'reviewedAt', type: 'date', access: { create: () => false, update: () => false } },
    {
      name: 'resonateCount', type: 'number', virtual: true,
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: 'One approval resonate plus current resonate swipes.' },
      hooks: { afterRead: [async ({ siblingData, req }) => {
        if (!siblingData.id) return 0
        // Only the aggregate is public; individual swipe records remain private.
        const { totalDocs } = await req.payload.count({
          collection: 'swipes', overrideAccess: true, req,
          where: { and: [{ card: { equals: siblingData.id } }, { action: { equals: 'resonate' } }] },
        })
        const current = await readInteractions({ payload: req.payload, req, user: req.user }, siblingData.id)
        return totalDocs + current.state.resonate + (siblingData.reviewStatus === 'approved' ? 1 : 0)
      }] },
    },
  ],
}
