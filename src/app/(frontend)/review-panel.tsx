'use client'

import { useState, type FormEvent } from 'react'
import { PostTextInput } from './card-text'
import { ResonateCount } from './resonate-count'

export type Submission = {
  id: string | number
  text: string
  topic: string
  reviewStatus?: 'pending' | 'approved' | 'rejected' | null
  rejectionReason?: string | null
  resonateCount?: number | null
}

export function ReviewPanel({ cards, reviewing, send, refresh }: {
  cards: Submission[]
  reviewing: boolean
  send: (data: Record<string, unknown>) => Promise<unknown>
  refresh: () => Promise<void>
}) {
  const [editing, setEditing] = useState<string | number | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>, card: Submission) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value')
    setBusy(true)
    setNotice('')
    try {
      await send(reviewing
        ? { operation: 'review', id: card.id, status: decision, reason: form.get('reason') }
        : { operation: 'edit', id: card.id, text: form.get('text'), topic: form.get('topic') })
      setEditing(null)
      await refresh()
      setNotice(reviewing ? 'Review recorded. Thank you for taking care.' : 'Changes submitted. Your card will be reviewed again before it appears.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Please try again.') }
    setBusy(false)
  }

  return <div className="mx-auto mt-8 max-w-xl space-y-5">
    <p className="text-center text-sm leading-relaxed opacity-70">{reviewing
      ? 'Read with care. No profanity, names, telephone numbers, or identifying details about the author or anyone else. Relationships such as “my father” are welcome. Check context: automatic screening can miss details. Explain every rejection. Never review a card you wrote. Known own cards are blocked; anonymous submissions from another browser cannot be identified.'
      : 'A human reads every thought before it reaches Discover. Editing sends it back for review. Your private management keys stay in this browser.'}</p>
    <button type="button" disabled={busy} onClick={() => void refresh()} className="mx-auto block text-xs underline underline-offset-4">Refresh status</button>
    {notice && <p role="status" className="rounded-xl border border-current/15 p-4 text-sm">{notice}</p>}
    {!cards.length && <div className="rounded-2xl border border-dashed border-current/20 p-10 text-center">
      <h2 className="font-serif text-2xl">{reviewing ? 'A little room to breathe.' : 'Your thoughts will live here.'}</h2>
      <p className="mt-3 text-sm opacity-70">{reviewing ? 'There are no cards waiting for your review.' : 'You don’t need a big story. When you feel ready, a small, honest moment is a lovely place to start.'}</p>
    </div>}
    {cards.map(card => <article key={card.id} className="rounded-2xl border border-current/15 bg-white/60 p-6">
      <div className="flex items-center justify-between gap-3 text-xs"><span>{card.topic}</span><span className="rounded-full bg-current/5 px-3 py-1 font-medium">{card.reviewStatus === 'approved' ? 'Approved · Published' : card.reviewStatus === 'rejected' ? 'Not approved' : 'Awaiting human review'}</span></div>
      <p className="my-5 whitespace-pre-wrap break-words font-serif text-2xl">{card.text}</p>
      <div className="mb-4"><ResonateCount count={card.resonateCount} /></div>
      {!reviewing && card.reviewStatus === 'rejected' && <p className="mb-4 border-l-2 border-current/30 pl-3 text-sm"><strong>Reviewer’s note:</strong> {card.rejectionReason || 'Please revise this card to follow our community guidelines.'}</p>}
      {reviewing ? <form onSubmit={event => void submit(event, card)} className="space-y-3">
        <label className="block text-xs">Reason if rejecting<textarea name="reason" maxLength={500} placeholder="A clear, kind explanation for the author." className="mt-2 min-h-24 w-full rounded-xl border border-current/20 bg-white p-3 text-sm" /></label>
        <div className="flex gap-3"><button disabled={busy} name="decision" value="approved" className="rounded-xl bg-current/10 px-5 py-3 text-sm font-medium disabled:opacity-50">Approve</button><button disabled={busy} name="decision" value="rejected" className="rounded-xl border border-current/20 px-5 py-3 text-sm disabled:opacity-50">Reject with reason</button></div>
      </form> : editing === card.id ? <form onSubmit={event => void submit(event, card)} className="space-y-4">
        <PostTextInput initialText={card.text} />
        <label className="block text-xs">Topic<select name="topic" defaultValue={card.topic} className="mt-2 w-full rounded-xl border border-current/20 bg-white p-3 text-sm">{['Life', 'Creativity', 'Growth', 'Connection'].map(topic => <option key={topic}>{topic}</option>)}</select></label>
        <div className="flex gap-4"><button disabled={busy} className="rounded-xl bg-current/10 px-4 py-3 text-sm disabled:opacity-50">Submit changes for review</button><button type="button" disabled={busy} onClick={() => setEditing(null)} className="text-xs underline">Cancel</button></div>
      </form> : <button onClick={() => setEditing(card.id)} className="text-xs underline underline-offset-4">Edit and resubmit</button>}
    </article>)}
  </div>
}
