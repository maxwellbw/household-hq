import { useEffect, useState } from 'react'

interface SyncedAtProps {
  /** React Query's `dataUpdatedAt` (ms epoch) for the surface's data. Renders nothing
   *  until a fetch has actually landed (0 = never fetched). */
  updatedAt: number
}

function relativeSyncLabel(updatedAt: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - updatedAt) / 1000))
  if (diffSec < 60) return 'Synced just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Synced ${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  return `Synced ${diffHr} h ago`
}

/** Shared data-freshness label (feature 032 US3, contract C4): one relative format app-wide,
 *  ticking every 60s so a left-open view doesn't go stale mid-session (audit F-23). Views
 *  must not render their own absolute "Last synced HH:MM:SS" clock. */
export function SyncedAt({ updatedAt }: SyncedAtProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!updatedAt) return null

  return <p className="px-4 py-1 text-xs tabular-nums text-ink-faint">{relativeSyncLabel(updatedAt, now)}</p>
}
