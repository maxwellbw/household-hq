import { useEffect, useMemo, useState } from 'react'
import { startSession, nextPair, applyAnswer, finalOrder, reconcile } from '@/lib/forceRank'
import type { ForceRankSession } from '@/lib/forceRank'

const STORAGE_KEY = 'household-hq.forceRankSession'

function loadStored(): ForceRankSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ForceRankSession
  } catch {
    return null
  }
}

function persist(session: ForceRankSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // best-effort — a failed persist just means this device won't resume next time
  }
}

/**
 * Same-device-resumable force-rank session (feature 021, research R4): backs the pure
 * `forceRank` engine with localStorage so leaving and returning on this device continues
 * an in-progress "this or that?" session without repeating answers. Only the final order is
 * ever sent to the backend — this hook never persists to the Sheet itself.
 *
 * Reconciles against the live someday task set whenever it changes, so a task scheduled,
 * completed, or deleted mid-session (by either user) drops out cleanly instead of crashing
 * or resurrecting stale entries (edge case: "list changed mid-session").
 */
export function useForceRankSession(somedayIds: string[]) {
  const [session, setSession] = useState<ForceRankSession | null>(loadStored)
  const idsKey = somedayIds.join('|')

  useEffect(() => {
    setSession((prev) => {
      if (!prev) return prev
      const next = reconcile(prev, somedayIds)
      persist(next)
      return next
    })
    // idsKey is the stable primitive form of somedayIds — reconciling on its value change
    // (not on array identity) avoids re-running every render for an unmemoized prop array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  function start() {
    const fresh = startSession(somedayIds)
    persist(fresh)
    setSession(fresh)
  }

  function answer(winnerId: string) {
    setSession((prev) => {
      if (!prev) return prev
      const next = applyAnswer(prev, winnerId)
      persist(next)
      return next
    })
  }

  /** Clear the session — call after a successful save, or when the user cancels. */
  function reset() {
    persist(null)
    setSession(null)
  }

  // Memoized so `pair`/`order` keep a stable reference across renders where `session` itself
  // hasn't changed — callers (ForceRankDialog) key a save effect off `order`, and a fresh
  // array/object identity on every render would re-fire that effect in a loop.
  const pair = useMemo(() => (session ? nextPair(session) : null), [session])
  const order = useMemo(() => (session ? finalOrder(session) : null), [session])

  return { session, pair, order, start, answer, reset }
}
