'use client'

import { useEffect, useState, useRef, type FormEvent } from 'react'
import { swipeAction } from '@/lib/swipe'
import { CardText } from './card-text'
import { CreateCardDialog } from './create-card-dialog'
import { ReviewPanel, type Submission } from './review-panel'
import { ResonateCount } from './resonate-count'
import { BreathingMoment } from './breathing-moment'
import { emptyLibrary, readLibrary, writeLibrary, newDeviceKey } from '@/lib/device-library'
import { UNDO_WINDOW_MS } from '@/lib/interaction-state'
import type { CommunityCard, DeviceLibrary, LocalChoice, Topic } from '@/lib/community-types'

type Card = CommunityCard
function Icon({ name, className = '' }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    discover: <><rect x="4" y="5" width="14" height="16" rx="3" transform="rotate(-12 4 5)" /><path d="M10 3h7a3 3 0 0 1 3 3v12" /></>,
    save: <path d="M6 4h12v17l-6-4-6 4z" />, heart: <path d="M20.8 5.6a5.5 5.5 0 0 0-8.8.6 5.5 5.5 0 0 0-8.8-.6C-1 11 12 20 12 20s13-9 8.8-14.4Z" />,
    plus: <path d="M12 5v14M5 12h14" />, arrow: <path d="m9 5 7 7-7 7M4 12h12" />,
    close: <path d="m6 6 12 12M6 18 18 6" />, leaf: <><path d="M19 3C6 2 2 8 6 15c7 4 13 0 13-12Z" /><path d="M4 21 15 9" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    undo: <><path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14" /></>,
  }
  return <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.discover}</svg>
}
export default function HomePage() {
  const [view, setView] = useState('Discover')
  const [topic, setTopic] = useState('All thoughts')
  const [cards, setCards] = useState<Card[]>([])
  const [library, setLibrary] = useState<DeviceLibrary>(emptyLibrary)
  const libraryRef = useRef<DeviceLibrary>(emptyLibrary())
  const [deviceReady, setDeviceReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [user, setUser] = useState<{role: 'reviewer'} | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [queue, setQueue] = useState<Submission[]>([])
  const [modal, setModal] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [pauseCard, setPauseCard] = useState<Card | null>(null)
  const [focusedCardID, setFocusedCardID] = useState<Card['id'] | null>(null)
  const readingCard = useRef<HTMLElement>(null)
  const pauseHeading = useRef<HTMLHeadingElement>(null)
  const start = useRef<{x: number; y: number; pointerId: number} | null>(null)
  const submitting = useRef(false)
  const loadVersion = useRef(0)
  const flushing = useRef(false)
  const last = library.history[0]
  function commit(update: (current: DeviceLibrary) => DeviceLibrary) {
    try {
      const next = update(readLibrary())
      writeLibrary(next)
      libraryRef.current = next
      setLibrary(next)
      setStorageError('')
      return true
    } catch {
      setStorageError('This browser can’t save right now. Please allow site storage to keep cards or send a thought. Existing saved data has not been overwritten.')
      return false
    }
  }
  function openComposer() {
    setMessage('')
    setModal('post')
  }
  async function load() {
    const version = ++loadVersion.current
    try {
      const r = await fetch('/api/community', { signal: AbortSignal.timeout(12000) })
      const d = await r.json()
      if (version !== loadVersion.current) return
      if (!r.ok) throw new Error(d.error)
      setCards(d.cards); setUser(d.user)
      if (!d.user) { setQueue([]); setView(current => current === 'Review' ? 'Discover' : current) }
      setPauseCard(previous => previous ? d.cards.find((c: Card) => c.id === previous.id) || previous : null)
      const keys = libraryRef.current.keys
      const mine = keys.length ? await send({ operation: 'owned', keys }) : { cards: [] }
      if (version !== loadVersion.current) return
      setSubmissions(mine.cards)
      const review = d.user?.role === 'reviewer' ? await send({ operation: 'review-queue', keys }) : { cards: [] }
      if (version === loadVersion.current) setQueue(review.cards)
    } catch (e) {
      if (version === loadVersion.current) setMessage(e instanceof Error ? e.message : 'The shared cards couldn’t be refreshed. Saved cards are still available here.')
    }
    if (version === loadVersion.current) setLoaded(true)
  }
  useEffect(() => {
    const hydrate = () => {
      try {
        const saved = readLibrary()
        libraryRef.current = saved
        setLibrary(saved)
        setStorageError('')
      } catch {
        setStorageError('This browser’s saved library couldn’t be read. It has not been overwritten.')
      }
      setDeviceReady(true)
    }
    hydrate()
    void load()
    void flush()
    const onStorage = () => { hydrate(); setSubmissions([]); void load() }
    const onOnline = () => { void flush().then(() => load()) }
    window.addEventListener('storage', onStorage)
    window.addEventListener('online', onOnline)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('online', onOnline) }
  }, [])
  useEffect(() => {
    if (pauseCard && view === 'Discover') {
      pauseHeading.current?.focus({ preventScroll: true })
    }
  }, [pauseCard, view])
  async function send(data: Record<string, unknown>) {
    const r = await fetch('/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(12000) })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    return d
  }
  const managedSend = (data: Record<string, unknown>) => send({ ...data, keys: libraryRef.current.keys })
  async function flush() {
    if (flushing.current) return false
    flushing.current = true
    let changed = false
    try {
      while (libraryRef.current.outbox.length) {
        const event = libraryRef.current.outbox[0]
        if (Date.now() - event.createdAt < UNDO_WINDOW_MS) {
          await send({ operation: 'interaction', ...event })
          changed = true
        }
        if (!commit(current => ({ ...current, outbox: current.outbox.filter(item => !(item.key === event.key && item.undo === event.undo)) }))) break
      }
    } catch {
      // Local choices stay usable offline; stable receipt keys make later retries idempotent.
      setMessage('Kept in this browser. Shared counts will catch up when a connection is available.')
    } finally { flushing.current = false }
    return changed
  }
  async function logout() {
    if (busy || submitting.current) return
    submitting.current = true
    setBusy(true)
    setMessage('')
    try {
      await send({ operation: 'logout' })
      loadVersion.current += 1
      setUser(null)
      setQueue([])
      setPauseCard(null)
      setModal(null)
      start.current = null
      setDrag({ x: 0, y: 0 })
      setView('Discover')
      setMessage('Reviewer session ended. Your browser’s saved cards are still here.')
    } catch {
      setMessage('We couldn’t log you out. Please try again.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  const seen = new Set(library.history.map(choice => choice.card.id))
  const deck = cards.filter(c => (topic === 'All thoughts' || c.topic === topic) && !seen.has(c.id))
  const card = deck[0]
  const readingFocused = !!card && focusedCardID === card.id && view === 'Discover' && !pauseCard && !modal
  useEffect(() => { setFocusedCardID(null) }, [card?.id, view, topic, !!pauseCard, modal])
  useEffect(() => {
    if (!readingFocused) return
    const leaveOutside = (event: Event) => {
      if (event.target instanceof Node && !readingCard.current?.contains(event.target)) setFocusedCardID(null)
    }
    const leaveForControl = (event: FocusEvent) => {
      // Touch can focus the page root after a card gesture; only a real control leaves reading.
      if (event.target instanceof Element && event.target.matches('button, a, input, textarea, select, summary, [tabindex]:not([tabindex="-1"])')) leaveOutside(event)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setFocusedCardID(null) }
    }
    document.addEventListener('pointerdown', leaveOutside, true)
    document.addEventListener('focusin', leaveForControl)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', leaveOutside, true)
      document.removeEventListener('focusin', leaveForControl)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [readingFocused])
  async function act(action: LocalChoice['action']) {
    if (!card || pauseCard || busy || submitting.current || !deviceReady) return
    if (libraryRef.current.history.some(choice => choice.card.id === card.id)) return
    const choice: LocalChoice = { key: newDeviceKey(), card, action, createdAt: Date.now() }
    if (!commit(current => ({
      ...current, history: [choice, ...current.history],
      outbox: [...current.outbox, { key: choice.key, card: card.id, action, undo: false, createdAt: choice.createdAt }],
    }))) return
    submitting.current = true
    try {
      setMessage(action === 'pass' ? 'Not every thought has to be yours.' : action === 'save' ? 'Kept for a moment when you need it.' : 'Something in these words met you.')
      if (action === 'resonate') {
        setDrag({ x: 0, y: 0 })
        setPauseCard({ ...card, resonateCount: (card.resonateCount || 0) + 1 })
      }
      void flush().then(changed => { if (changed) void load() })
    }
    catch (e) { setMessage((e as Error).message) }
    submitting.current = false
    setDrag({ x: 0, y: 0 })
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy || submitting.current) return
    const values = Object.fromEntries(new FormData(e.currentTarget))
    let key: string | undefined
    if (modal === 'post') {
      key = libraryRef.current.draft.key || newDeviceKey()
      if (!commit(current => ({
        ...current, keys: [...new Set([...current.keys, key!])],
        draft: { text: String(values.text || ''), topic: values.topic as Topic, key },
      }))) return
    }
    submitting.current = true
    setBusy(true); setMessage('')
    try {
      if (modal === 'post') {
        await send({ operation: 'post', ...values, key })
        commit(current => ({ ...current, draft: { text: '', topic: 'Life' } }))
        setModal(null); setView('My Cards')
        await load()
        setMessage('Thank you for sharing. A person will read your thought before it becomes public.')
      } else if (modal === 'import-legacy') {
        const result = await send({ operation: 'import-legacy', ...values })
        if (!commit(current => {
          const byCard = new Map(current.history.map(choice => [choice.card.id, choice]))
          for (const choice of result.history as LocalChoice[]) if (!byCard.has(choice.card.id)) byCard.set(choice.card.id, choice)
          return { ...current, keys: [...new Set([...current.keys, ...result.keys as string[]])], history: [...byCard.values()] }
        })) return
        setModal(null); await load()
        setMessage('Your previous cards are now kept in this browser too. The originals haven’t been removed.')
      } else {
        await send({ operation: 'reviewer-login', ...values })
        setModal(null); await load(); setView('Review')
      }
    }
    catch (e) { setMessage((e as Error).message) }
    finally { submitting.current = false; setBusy(false) }
  }
  async function undo() {
    if (busy || submitting.current || !last) return
    const sharedUndo = !last.imported && Date.now() - last.createdAt < UNDO_WINDOW_MS
    if (!commit(current => ({
      ...current, history: current.history.filter(choice => choice.key !== last.key),
      outbox: sharedUndo ? [...current.outbox, { key: last.key, card: last.card.id, action: last.action, undo: true, createdAt: last.createdAt }] : current.outbox,
    }))) return
    setPauseCard(null)
    setMessage(sharedUndo ? 'A little room to reconsider.' : 'Undone in this browser. The shared-count Undo window has ended.')
    void flush().then(changed => { if (changed) void load() })
  }
  const saved = library.history.filter(choice => choice.action === 'save')
  const navigation = [['Discover','discover'],['Bookmarks','save'],['My Cards','user'], ...(user?.role === 'reviewer' ? [['Review','leaf']] : [])]
  const notice = storageError || message
  const feedback = notice && <div role="status" className={`mx-auto flex w-full max-w-lg shrink-0 items-center justify-center gap-4 rounded-xl bg-still-sage px-3 py-2 text-center text-xs ${view === 'Discover' ? '' : 'mt-5'}`}>
    <span>{view === 'Discover' && storageError ? 'Browser storage is unavailable. Reading is still welcome.' : notice}</span>
    {last && <button disabled={busy} className="flex shrink-0 items-center gap-1 font-semibold underline disabled:opacity-50" onClick={() => void undo()}><Icon name="undo" className="h-3 w-3" />Undo</button>}
    <button aria-label="Dismiss message" onClick={() => setMessage('')} className="shrink-0 p-1"><Icon name="close" className="h-3 w-3" /></button>
  </div>
  return <div data-reading-focused={readingFocused ? 'true' : undefined} className={`${view === 'Discover' ? 'fixed inset-0 h-dvh overflow-hidden overscroll-none' : 'min-h-screen'} bg-[#f8f9f5] pt-[max(3.75rem,env(safe-area-inset-top))] text-[#263f35] md:pt-[env(safe-area-inset-top)]`}>
    <div aria-hidden="true" data-reading-backdrop className={`pointer-events-none fixed inset-0 z-30 bg-still-ink/5 transition-opacity duration-300 motion-reduce:transition-none ${readingFocused ? 'backdrop-blur-xs opacity-100' : 'opacity-0'}`} />
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] flex-col border-r border-[#e5e8df] bg-[#fcfcf9] px-7 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))] md:flex">
      <nav className="space-y-2">{navigation.map(([label, icon]) => <button key={label} onClick={() => setView(label)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm transition ${view === label ? 'bg-[#e9eee5] font-semibold text-[#365343]' : 'text-[#7c857b] hover:bg-[#f0f2eb]'}`}><Icon name={icon} />{label}{label === 'Bookmarks' && saved.length > 0 && <span className="ml-auto text-xs">{saved.length}</span>}</button>)}</nav>
      <div className="mt-auto border-t border-still-muted/20 pt-6">
        <p className="text-xs leading-relaxed text-still-muted">No account. Your saved words stay in this browser.</p>
        {user && <button type="button" disabled={busy} onClick={() => void logout()} className="mt-3 min-h-11 text-sm text-still-muted underline underline-offset-4 disabled:opacity-50">End reviewer session</button>}
      </div>
    </aside>
    <div className={`md:ml-[238px] ${view === 'Discover' ? 'flex h-full min-h-0 flex-col' : ''}`}>
      <main className={`mx-auto w-full max-w-[1100px] px-5 sm:px-10 ${view === 'Discover' ? 'flex min-h-0 flex-1 flex-col pb-[calc(var(--spacing-app-bar)+0.75rem+env(safe-area-inset-bottom))] md:pb-6 md:pt-8' : 'pb-24 md:pt-10 lg:pt-12'}`}>
        <header className="flex h-app-bar shrink-0 flex-col items-center justify-center gap-3 md:h-auto">
        <h1 className={view === 'Discover' && notice ? 'sr-only' : 'shrink-0 text-center font-serif text-2xl leading-tight tracking-[-1.3px] sm:text-[43px] [@media(max-height:740px)]:sm:text-3xl'}>{view === 'My Cards' ? 'Your thoughts, gently held.' : view === 'Review' ? 'A moment of care.' : view === 'Discover' ? 'One thought at a time.' : 'Words to come back to.'}</h1>
        {view === 'Discover' && feedback}
        {view === 'Discover' && !notice && <p className="shrink-0 text-center text-xs leading-relaxed text-still-muted [@media(max-height:740px)]:hidden">Come as you are. There’s nothing to catch up on.</p>}
        </header>
        {view === 'Bookmarks' && <p className="mt-2 shrink-0 text-center text-xs leading-relaxed text-still-muted">Kept in this browser, for the days you need them again.</p>}
        {view === 'My Cards' || view === 'Review' ? <>
          {view === 'My Cards' && <div className="mx-auto mt-6 flex max-w-xl justify-center">
            <button type="button" disabled={!deviceReady || !!storageError || busy} onClick={openComposer} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#345440] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#284332] disabled:opacity-50"><Icon name="plus" />{library.draft.text ? 'Continue your draft' : 'Create a card'}</button>
          </div>}
          <ReviewPanel cards={view === 'Review' ? queue : submissions} reviewing={view === 'Review'} send={managedSend} refresh={load} />
          {view === 'My Cards' && <details className="mx-auto mt-8 max-w-xl text-xs leading-relaxed text-still-muted">
            <summary className="mx-auto w-fit cursor-pointer py-3 underline underline-offset-4">About this browser</summary>
            <p className="mt-3">Bookmarks, drafts, and private card-management keys stay in this browser on this site, not in an account. Clearing browser data loses this access. Shared cards remain in the community. Counts reflect interactions, not unique people; offline counts are best-effort and shared-count Undo lasts ten minutes.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-x-6">
              <button type="button" disabled={busy || !!storageError} onClick={() => { setMessage(''); setModal('import-legacy') }} className="min-h-11 underline underline-offset-4 disabled:opacity-50">Import a previous account</button>
              {user
                ? <button type="button" disabled={busy} onClick={() => void logout()} className="min-h-11 underline underline-offset-4 disabled:opacity-50">End reviewer session</button>
                : <button type="button" onClick={() => { setMessage(''); setModal('reviewer-login') }} className="min-h-11 underline underline-offset-4">Reviewer access</button>}
            </div>
          </details>}
        </> : view === 'Discover' ? <>
          <div className="flex min-h-0 flex-1 flex-col justify-center">
          {!pauseCard && <div className="mt-3 flex shrink-0 flex-wrap justify-center gap-1 sm:gap-2">{['All thoughts','Life','Creativity','Growth','Connection'].map(t => <button key={t} onClick={() => setTopic(t)} className={`whitespace-nowrap rounded-full px-2.5 py-2 text-xs transition sm:px-4 ${topic === t ? 'bg-[#e4eadc] font-medium text-[#42583a]' : 'text-[#8c9386] hover:bg-[#edf0e7]'}`}>{t}</button>)}</div>}
          <div className={`mt-3 flex min-h-0 shrink flex-col ${pauseCard ? 'h-[560px]' : ''}`}>
          {pauseCard ? <section aria-labelledby="pause-heading" className="relative z-40 mx-auto flex min-h-0 max-h-[560px] w-full max-w-[445px] flex-1 flex-col items-center rounded-[22px] border border-[#d7dfcb] bg-[#eaf0e2] p-5 text-center shadow-[0_12px_35px_-20px_#626a48] sm:px-8 [@media(max-height:740px)]:p-4">
            <h2 id="pause-heading" ref={pauseHeading} tabIndex={-1} className="font-serif text-[32px] leading-tight tracking-[-.5px] outline-none [@media(max-height:740px)]:text-2xl">Let that stay with you.</h2>
            <BreathingMoment />
            <blockquote className="my-3 flex min-h-0 w-full flex-1 flex-col border-y border-[#d5dfc9] pb-3 font-serif italic text-[#516547]"><CardText text={`“${pauseCard.text}”`} /><footer className="flex shrink-0 items-center justify-end font-sans not-italic text-[#859477]"><ResonateCount count={pauseCard.resonateCount} /></footer></blockquote>
            <button disabled={busy} onClick={() => { setPauseCard(null); setMessage('') }} className="mt-auto flex shrink-0 items-center gap-3 rounded-full bg-[#345440] px-6 py-3 text-sm text-white transition hover:bg-[#284332] disabled:opacity-50">Continue when you’re ready<Icon name="arrow" className="h-4 w-4" /></button>
          </section> : <>
          <div className="flex h-[460px] min-h-0 shrink items-center justify-center">
          <div key={card?.id ?? `quiet-${topic}`} className="relative z-40 mx-auto h-full min-h-0 max-h-[460px] w-full max-w-[445px] motion-safe:animate-arrive">
            <article ref={readingCard} aria-label="Thought card. Swipe left to pass, up to save, or right to resonate. Tap to focus on the words, or use the Focus control." className={`relative flex h-full touch-none select-none cursor-grab flex-col rounded-[22px] border bg-[#f8f5e9] p-5 transition-[box-shadow,border-color] duration-300 motion-reduce:transition-none active:cursor-grabbing sm:p-8 [@media(max-height:740px)]:p-4 ${readingFocused ? 'border-still-muted/40 shadow-2xl ring-1 ring-still-muted/15' : 'border-[#e2dfcf] shadow-[0_12px_35px_-20px_#626a48]'}`} style={{ transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 25}deg)` }}
              onPointerDown={e => { if (!card || busy || submitting.current || !e.isPrimary || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId } }}
              onPointerMove={e => { if (start.current?.pointerId === e.pointerId) setDrag({ x: e.clientX - start.current.x, y: Math.min(0, e.clientY - start.current.y) }) }}
              onPointerCancel={() => { start.current = null; setDrag({ x: 0, y: 0 }) }}
              onLostPointerCapture={() => { start.current = null; setDrag({ x: 0, y: 0 }) }}
              onPointerUp={e => {
                const origin = start.current
                if (!origin || origin.pointerId !== e.pointerId) return
                start.current = null
                const dx = e.clientX - origin.x
                const dy = e.clientY - origin.y
                const action = swipeAction(dx, dy)
                setDrag({ x: 0, y: 0 })
                // Resolve taps here too: touch pointer capture need not produce a later click.
                if (action) { setFocusedCardID(null); void act(action as LocalChoice['action']) }
                else if (card && Math.hypot(dx, dy) <= 8) setFocusedCardID(current => current === card.id ? null : card.id)
              }}>
              <div className="flex h-full min-h-0 flex-col">
              <div className="flex min-h-4 items-center justify-between gap-3">
                <span className="text-xs text-[#7a8665]">{card?.topic || 'A moment of quiet'}</span>
                {card && <button type="button" aria-pressed={readingFocused} aria-label={readingFocused ? 'Leave focus' : 'Focus on this thought'} disabled={busy}
                  onPointerDown={event => event.stopPropagation()}
                  onClick={event => { event.stopPropagation(); setFocusedCardID(current => current === card.id ? null : card.id) }}
                  className="-my-3.5 min-h-11 shrink-0 rounded-full px-2 text-xs text-still-muted underline decoration-still-muted/40 underline-offset-4 transition-colors hover:text-still-ink disabled:opacity-50">{readingFocused ? 'Leave focus' : 'Focus'}</button>}
              </div>
              <CardText text={card?.text || (loaded ? 'That’s everything here for now. There’s no need to keep going. Let a thought settle.' : 'Settle in. A little stillness is on its way.')} />
              <div className="flex justify-end text-xs text-[#8b927e]">{card && <ResonateCount count={card.resonateCount} />}</div>
              </div>
              {(Math.abs(drag.x) > 25 || drag.y < -25) && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[22px] bg-[#e7ecdc]/90 text-2xl font-medium"><span>{-drag.y > Math.abs(drag.x) ? 'Save for later' : drag.x > 0 ? 'This resonates' : 'Pass, gently'}</span><span className="text-sm font-normal">{swipeAction(drag.x, drag.y) ? 'Release to confirm' : 'Keep dragging to confirm'}</span></div>}
            </article>
          </div>
          </div>
          <div className="mt-3 flex shrink-0 items-start justify-center gap-8 sm:gap-11">{[['pass','close','Pass','Swipe left'],['save','save','Save','Swipe up'],['resonate','heart','Resonates','Swipe right']].map(([action, icon, label, hint]) => <button key={action} aria-label={`${label}. ${hint}.`} disabled={busy || !card || !deviceReady} onClick={() => void act(action as LocalChoice['action'])} className="group flex flex-col items-center disabled:opacity-40"><span className={`mb-2 grid h-11 w-11 place-items-center rounded-full border transition group-hover:-translate-y-1 sm:h-[58px] sm:w-[58px] ${action === 'resonate' ? 'border-[#36533f] bg-[#36533f] text-white' : action === 'save' ? 'border-[#dce1cf] bg-[#edf0e3] text-[#73815d]' : 'border-[#e1e4dc] bg-white text-[#9b9e93]'}`}><Icon name={icon} /></span><span className="text-xs font-medium">{label}</span><span className="mt-1 text-[10px] text-[#a0a597] [@media(max-height:740px)]:sr-only">{hint}</span></button>)}</div>
          {busy && <p role="status" className="mt-5 text-center text-xs text-[#8b927e]">Saving…</p>}
          </>}
          </div>
          </div>
        </> : <div className="mx-auto mt-10 max-w-xl space-y-4">{saved.length ? saved.map(s => { const c = cards.find(card => card.id === s.card.id) || s.card; return <article key={s.key} className="rounded-2xl border border-[#e2dfcf] bg-[#f8f5e9] p-7 motion-safe:animate-arrive"><span className="text-xs text-[#879373]">{c.topic}</span><p className="my-4 font-serif text-2xl">{c.text}</p><div className="flex justify-end text-xs text-[#929887]"><ResonateCount count={c.resonateCount} /></div></article> }) : <div className="rounded-2xl border border-dashed border-[#d9dfd1] p-12 text-center"><Icon name="save" className="mx-auto mb-4 text-[#8b9c7e]" /><h2 className="font-serif text-2xl">Some words are worth keeping.</h2><p className="mt-3 text-sm leading-relaxed text-still-muted">When a thought feels worth returning to, save it here. No account needed. There’s no need to fill this space.</p><button onClick={() => setView('Discover')} className="mt-5 min-h-11 text-sm underline underline-offset-4">Find a thought</button></div>}</div>}
        {view !== 'Discover' && feedback}
      </main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex h-[calc(var(--spacing-app-bar)+env(safe-area-inset-bottom))] items-center justify-around border-t border-[#e0e5d8] bg-[#fcfcf9] pb-[env(safe-area-inset-bottom)] md:hidden">{navigation.map(([v,i]) => <button key={v} onClick={() => setView(v)} className={`flex flex-col items-center gap-1 text-[10px] ${view === v ? 'text-[#345440]' : 'text-[#929987]'}`}><Icon name={i} />{v}</button>)}</nav>
    {modal === 'post' ? <CreateCardDialog busy={busy} error={storageError || message} draft={library.draft} canKeepDraft={!storageError}
      onDraftChange={(text, topic) => commit(current => ({ ...current, draft: { text, topic, ...(current.draft.text === text && current.draft.topic === topic ? { key: current.draft.key } : {}) } }))}
      onDiscard={() => { if (commit(current => ({ ...current, draft: { text: '', topic: 'Life' } }))) setModal(null) }}
      onClose={() => setModal(null)} onSubmit={submit} /> : modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#22372c]/35 p-5 backdrop-blur-sm" onClick={() => { if (!busy) setModal(null) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()} className="relative max-h-[calc(100dvh-2.5rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-[#fcfcf7] p-8 shadow-xl motion-safe:animate-arrive">
        <button type="button" disabled={busy} aria-label="Close dialog" onClick={() => setModal(null)} className="absolute right-5 top-5 disabled:opacity-50"><Icon name="close" /></button>
        <Icon name="leaf" className="mb-5 h-8 w-8" />
        <h2 id="dialog-title" className="font-serif text-3xl">{modal === 'import-legacy' ? 'Bring your previous cards.' : 'Reviewer access.'}</h2>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-still-muted">{modal === 'import-legacy' ? 'Verify your previous account to copy its saved cards and management access into this browser. The originals and access on other browsers stay unchanged. Your account details are not saved here.' : 'A protected entrance for authorised reviewers. Reading, saving, and writing never need an account.'}</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs">Email address<input name="email" type="email" required autoComplete="email" className="mt-2 w-full rounded-xl border border-[#dfe4d6] bg-white p-3 text-sm" /></label>
          <label className="block text-xs">Password<input name="password" type="password" required minLength={8} autoComplete="current-password" className="mt-2 w-full rounded-xl border border-[#dfe4d6] bg-white p-3 text-sm" /></label>
          <button disabled={busy} className="w-full rounded-xl bg-[#345440] p-3.5 text-sm text-white disabled:opacity-50">{busy ? 'One moment…' : modal === 'import-legacy' ? 'Import into this browser' : 'Enter review space'}</button>
        </form>
        {message && <p role="alert" className="mt-3 text-sm text-[#965948]">{message}</p>}
      </section>
    </div>}
  </div>
}
