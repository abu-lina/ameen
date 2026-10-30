export function ResonateCount({ count }: { count?: number | null }) {
  if (typeof count !== 'number') return null
  return <span className="inline-flex shrink-0 items-center gap-1.5 text-xs tabular-nums opacity-70">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 5.6a5.5 5.5 0 0 0-8.8.6 5.5 5.5 0 0 0-8.8-.6C-1 11 12 20 12 20s13-9 8.8-14.4Z" /></svg>
    {count.toLocaleString()} {count === 1 ? 'resonate' : 'resonates'}
  </span>
}
