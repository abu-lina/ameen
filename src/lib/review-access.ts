import type { PayloadRequest } from 'payload'

export const isCMSAdmin = (req: PayloadRequest) => req.user?.collection === 'admins'
export const isReviewer = (req: PayloadRequest) =>
  req.user?.collection === 'users' && req.user.role === 'reviewer'
