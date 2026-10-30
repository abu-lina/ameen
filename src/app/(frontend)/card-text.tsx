'use client'

import { useId, useLayoutEffect, useRef, useState } from 'react'
import { POST_CHARACTER_LIMIT } from '@/lib/post-limits'
import { moderatePost } from '@/lib/post-moderation'

export function CardText({ text }: { text: string }) {
  const box = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const container = box.current
    const element = heading.current
    if (!container || !element) return
    const fit = () => {
      let size = 32
      element.style.fontSize = `${size}px`
      while (size > 16 && (element.scrollHeight > container.clientHeight || element.scrollWidth > container.clientWidth)) {
        size -= 0.5
        element.style.fontSize = `${size}px`
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    let active = true
    void document.fonts.ready.then(() => { if (active) fit() })
    return () => { active = false; observer.disconnect() }
  }, [text])

  return <div className="my-5 min-h-0 flex-1 [@media(max-height:740px)]:my-3">
    <div ref={box} className="flex h-full items-center">
      <h2 ref={heading} className="w-full font-serif text-[32px] leading-[1.35] tracking-[-.3px] [overflow-wrap:anywhere]">{text}</h2>
    </div>
  </div>
}

export function PostTextInput({ initialText = '', composer = false, disabled = false }: { initialText?: string; composer?: boolean; disabled?: boolean }) {
  const [text, setText] = useState(initialText)
  const [guidance, setGuidance] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  const remaining = POST_CHARACTER_LIMIT - text.length
  const limitAnnouncement = remaining === 0
    ? 'Character limit reached.'
    : remaining <= 30 ? `You’re close to the ${POST_CHARACTER_LIMIT}-character limit.` : ''

  return <div>
    <label className={composer ? 'sr-only' : 'block text-xs'} htmlFor={id}>Your thought</label>
    <textarea ref={input} id={id} name="text" value={text} disabled={disabled}
      onChange={event => { setText(event.target.value); setGuidance(''); event.target.setCustomValidity('') }}
      onBlur={() => { const message = text.trim() ? moderatePost(text)?.message || '' : ''; setGuidance(message); input.current?.setCustomValidity(message) }}
      onInvalid={event => {
        if (!event.currentTarget.validity.customError) return
        // Keep moderation blocking, but show only our inline guidance, not a second browser alert.
        event.preventDefault()
        event.currentTarget.focus()
      }}
      required minLength={10} maxLength={POST_CHARACTER_LIMIT} aria-invalid={!!guidance} aria-describedby={`${id}-limit ${id}-privacy ${id}-guidance`} placeholder="Something I’ve been thinking about…" className={composer ? 'mt-2 min-h-56 w-full resize-none rounded-xl border border-still-muted/15 bg-white/40 p-4 font-serif text-2xl leading-relaxed text-still-ink placeholder:text-still-muted/50' : 'mt-2 min-h-36 w-full rounded-xl border border-[#dfe4d6] bg-white p-4 text-base outline-[#779165]'} />
    <p className="mt-2 text-right text-xs tabular-nums text-still-muted"><span aria-hidden="true">{text.length} / {POST_CHARACTER_LIMIT}</span><span className="sr-only">{text.length} of {POST_CHARACTER_LIMIT} characters used.</span></p>
    <p id={`${id}-limit`} className="sr-only">Up to {POST_CHARACTER_LIMIT} characters.</p>
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{limitAnnouncement}</p>
    <p id={`${id}-privacy`} className="mt-3 text-xs leading-relaxed text-still-muted">Use relationships, not names. Leave out identifying details.</p>
    <p id={`${id}-guidance`} role="status" aria-live="polite" aria-atomic="true" className={guidance ? 'mt-3 text-xs leading-relaxed text-still-muted' : 'sr-only'}>{guidance}</p>
    <details className="mt-1 text-xs leading-relaxed text-still-muted">
      <summary className="w-fit cursor-pointer py-3 underline underline-offset-4">Writing guidelines</summary>
      <div className="space-y-2 pb-2">
        <p>Instead of names, try “my father,” “my brother,” or “a friend.” Leave out telephone numbers, emails, social handles, addresses, specific workplaces, and other details that could identify you or someone else.</p>
        <p>Keep it kind. No hate, profanity, insults, or requests for money.</p>
      </div>
    </details>
  </div>
}
