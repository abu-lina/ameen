'use client'

import { useEffect, useState } from 'react'

export function BreathingMoment() {
  const [phase, setPhase] = useState<'idle' | 'in' | 'out' | 'done'>('idle')
  const active = phase === 'in' || phase === 'out'

  useEffect(() => {
    if (phase !== 'in' && phase !== 'out') return
    const timer = setTimeout(() => setPhase(phase === 'in' ? 'out' : 'done'), phase === 'in' ? 4000 : 6000)
    return () => clearTimeout(timer)
  }, [phase])

  return <button
    type="button"
    onClick={() => setPhase(active ? 'idle' : 'in')}
    aria-label={active ? 'Stop the optional breathing guide' : 'Start one optional gentle breath'}
    aria-pressed={active}
    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-full px-3 text-xs text-still-muted transition-colors hover:bg-still-sage/60"
  >
    <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full border border-still-muted/25 ${phase === 'in' ? 'motion-safe:animate-inhale' : phase === 'out' ? 'motion-safe:animate-exhale' : ''}`}>
      <span className="h-2 w-2 rounded-full bg-still-muted/40" />
    </span>
    <span role="status" aria-live="polite">{phase === 'in' ? 'Breathe in, gently…' : phase === 'out' ? 'And let it go…' : phase === 'done' ? 'Nothing else to do. Just be here.' : 'A slow breath, if you’d like'}</span>
    {active && <span className="text-xs opacity-70">Stop</span>}
  </button>
}
