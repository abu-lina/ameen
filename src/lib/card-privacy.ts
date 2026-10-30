type CardContent = {
  id: string | number
  text: string
  topic: string
  resonateCount?: number | null
  reviewStatus?: 'pending' | 'approved' | 'rejected' | null
  rejectionReason?: string | null
}

// Allowlist card content so ownership and moderation identities never reach the app.
export function anonymousCard(card: CardContent) {
  return {
    id: card.id,
    text: card.text,
    topic: card.topic,
    resonateCount: card.resonateCount,
    reviewStatus: card.reviewStatus,
    rejectionReason: card.rejectionReason,
  }
}
