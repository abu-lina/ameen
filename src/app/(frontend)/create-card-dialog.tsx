'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { PostTextInput } from './card-text'
import type { DeviceLibrary } from '@/lib/community-types'

export function CreateCardDialog({ busy, error, onClose, onSubmit, draft, onDraftChange, onDiscard, canKeepDraft }: {
  busy: boolean
  error: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  draft: DeviceLibrary['draft']
  onDraftChange: (text: string, topic: DeviceLibrary['draft']['topic']) => void
  onDiscard: () => void
  canKeepDraft: boolean
}) {
  const dialog = useRef<HTMLElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const keepWriting = useRef<HTMLButtonElement>(null)
  const wasConfirmingDiscard = useRef(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const requestClose = useCallback(() => {
    if (busy) return
    const text = form.current ? new FormData(form.current).get('text') : ''
    if (typeof text === 'string' && text.trim()) setConfirmDiscard(true)
    else onClose()
  }, [busy, onClose])

  useEffect(() => {
    const trigger = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const target = confirmDiscard
      ? keepWriting.current
      : wasConfirmingDiscard.current ? form.current?.querySelector('textarea') : dialog.current
    wasConfirmingDiscard.current = confirmDiscard
    target?.focus({ preventScroll: true })
  }, [confirmDiscard])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
      }
      if (event.key === 'Tab') {
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary') || [])
          .filter(element => element.getClientRects().length > 0)
        const first = items[0]
        const last = items[items.length - 1]
        if (!first) { event.preventDefault(); dialog.current?.focus(); return }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [requestClose])

  return <div onClick={requestClose} className="fixed inset-0 z-50 flex items-end justify-center bg-[#22372c]/35 pt-[max(3.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-5">
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="create-title" aria-describedby="create-intro" onClick={event => event.stopPropagation()} className="flex h-full w-full flex-col overflow-hidden rounded-t-3xl bg-[#fcfcf7] text-still-ink shadow-xl outline-none motion-safe:animate-arrive sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-lg sm:rounded-3xl">
      <header className="flex shrink-0 items-start justify-between gap-3 px-6 pb-4 pt-6 sm:px-8">
        <div>
          <h2 id="create-title" className="font-serif text-3xl leading-tight">Leave a little thought.</h2>
          <p id="create-intro" className="mt-2 text-sm text-still-muted">No perfect words needed.</p>
        </div>
        <button type="button" aria-label="Close writing" disabled={busy} onClick={requestClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-still-muted transition-colors hover:bg-still-sage disabled:opacity-50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </header>
      {confirmDiscard && <div role="alert" className="overflow-y-auto px-6 pb-8 pt-4 sm:px-8">
        <h3 className="font-serif text-2xl">Leave without sending?</h3>
        <p className="mt-3 text-sm leading-relaxed text-still-muted">{canKeepDraft ? 'Your words haven’t been sent. A draft is kept only in this browser.' : 'Your words haven’t been sent, and this browser couldn’t save a draft. Keep writing or copy your words before leaving.'}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button ref={keepWriting} type="button" onClick={() => setConfirmDiscard(false)} className="min-h-11 rounded-xl bg-still-ink px-5 py-3 text-sm text-white">Keep writing</button>
          <button type="button" disabled={!canKeepDraft} onClick={onClose} className="min-h-11 rounded-xl border border-still-muted/25 px-5 py-3 text-sm text-still-muted disabled:opacity-50">Keep draft</button>
          <button type="button" onClick={onDiscard} className="min-h-11 px-3 py-3 text-sm text-still-muted underline underline-offset-4">Discard thought</button>
        </div>
      </div>}
      <form ref={form} onSubmit={onSubmit} onChange={event => {
        const values = new FormData(event.currentTarget)
        onDraftChange(String(values.get('text') || ''), values.get('topic') as DeviceLibrary['draft']['topic'])
      }} className={confirmDiscard ? 'hidden' : 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8'}>
        <PostTextInput initialText={draft.text} composer disabled={busy} />
        <label className="mt-2 flex items-center gap-3 text-xs text-still-muted">Category
          <select name="topic" defaultValue={draft.topic} disabled={busy} className="min-h-11 rounded-full border border-still-muted/20 bg-transparent px-3 text-xs text-still-ink">
            {['Life', 'Creativity', 'Growth', 'Connection'].map(topic => <option key={topic}>{topic}</option>)}
          </select>
        </label>
        {error && <p role="alert" className="mt-4 text-sm text-[#965948]">{error}</p>}
        <div className="mt-auto pt-6">
          <button disabled={busy} className="min-h-11 w-full rounded-xl bg-still-ink px-5 py-3.5 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50">{busy ? 'Sending…' : 'Send for review'}</button>
          <p className="mt-3 text-center text-xs leading-relaxed text-still-muted">No account needed. A person reads each thought before it’s shared.</p>
        </div>
      </form>
    </section>
  </div>
}
