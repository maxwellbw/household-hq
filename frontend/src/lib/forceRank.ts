/**
 * forceRank.ts — pure binary-insertion "this or that?" engine (feature 021, research R1).
 *
 * Places someday tasks into one shared order using ~n·log n pairwise comparisons instead
 * of every-pair. All functions are pure and side-effect-free so the session state is a
 * plain JSON object safe to round-trip through localStorage (same-device resume, R4) — I/O
 * lives in the consuming hook, not here.
 */

export interface ForceRankSession {
  /** Someday task IDs the session started from — used by `reconcile` as a staleness guard. */
  seededIds: string[]
  /** IDs placed so far, best → worst. */
  sorted: string[]
  /** IDs still waiting to be inserted. */
  unsorted: string[]
  /** Active binary-search window into `sorted`: [lo, hi). */
  lo: number
  hi: number
  /** The `unsorted` item currently being placed; '' when nothing is active. */
  pivotId: string
}

/** Pull the next `unsorted` item into `pivotId` and open its search window over all of `sorted`. */
function beginNextInsertion(state: ForceRankSession): ForceRankSession {
  if (state.unsorted.length === 0) {
    return { ...state, pivotId: '', lo: 0, hi: 0 }
  }
  const [next, ...rest] = state.unsorted
  return { ...state, pivotId: next, unsorted: rest, lo: 0, hi: state.sorted.length }
}

/** Begin a session over `ids` (any order). Empty/singleton input completes immediately. */
export function startSession(ids: string[]): ForceRankSession {
  const seededIds = [...ids]
  if (ids.length === 0) {
    return { seededIds, sorted: [], unsorted: [], lo: 0, hi: 0, pivotId: '' }
  }
  const [first, ...rest] = ids
  return beginNextInsertion({ seededIds, sorted: [first], unsorted: rest, lo: 0, hi: 0, pivotId: '' })
}

/** The next pair to show ("this or that?"): `a` is the item being placed, `b` the probe. Null when done. */
export function nextPair(state: ForceRankSession): { a: string; b: string } | null {
  if (!state.pivotId) return null
  const mid = Math.floor((state.lo + state.hi) / 2)
  const candidate = state.sorted[mid]
  if (candidate === undefined) return null
  return { a: state.pivotId, b: candidate }
}

/**
 * Record which of the current pair won and advance the session. An unrecognized
 * `winnerId` (stale UI, race) is a no-op rather than corrupting state.
 */
export function applyAnswer(state: ForceRankSession, winnerId: string): ForceRankSession {
  const pair = nextPair(state)
  if (!pair) return state
  const mid = Math.floor((state.lo + state.hi) / 2)

  let lo = state.lo
  let hi = state.hi
  if (winnerId === pair.a) {
    hi = mid // pivot beat the probe — it belongs at or before mid
  } else if (winnerId === pair.b) {
    lo = mid + 1 // probe beat the pivot — it belongs after mid
  } else {
    return state
  }

  if (lo < hi) {
    return { ...state, lo, hi }
  }

  const sorted = [...state.sorted.slice(0, lo), state.pivotId, ...state.sorted.slice(lo)]
  return beginNextInsertion({ ...state, sorted, unsorted: state.unsorted, pivotId: '', lo: 0, hi: 0 })
}

/** The finished order, or null while comparisons remain. */
export function finalOrder(state: ForceRankSession): string[] | null {
  if (state.pivotId || state.unsorted.length > 0) return null
  return [...state.sorted]
}

/**
 * Reconcile a session against the live someday task set (resume, or mid-session drift —
 * FR-013/edge case "list changed mid-session"): drop IDs no longer present from `sorted`/
 * `unsorted`/the active pivot, and append genuinely-new IDs to `unsorted` so they still get
 * placed. Already-answered comparisons for surviving IDs are preserved; only a dropped
 * active pivot forfeits its in-progress (unresolved) comparison.
 */
export function reconcile(state: ForceRankSession, liveSomedayIds: string[]): ForceRankSession {
  const live = new Set(liveSomedayIds)
  const sorted = state.sorted.filter((id) => live.has(id))
  let unsorted = state.unsorted.filter((id) => live.has(id))
  let pivotId = state.pivotId
  let lo = state.lo
  let hi = state.hi

  if (pivotId && !live.has(pivotId)) {
    pivotId = ''
    lo = 0
    hi = 0
  }

  const known = new Set([...sorted, ...unsorted, ...(pivotId ? [pivotId] : [])])
  const fresh = liveSomedayIds.filter((id) => !known.has(id))
  unsorted = [...unsorted, ...fresh]

  if (!pivotId) {
    if (sorted.length === 0) {
      if (unsorted.length === 0) {
        return { seededIds: state.seededIds, sorted, unsorted, lo: 0, hi: 0, pivotId: '' }
      }
      const [first, ...rest] = unsorted
      return beginNextInsertion({ seededIds: state.seededIds, sorted: [first], unsorted: rest, lo: 0, hi: 0, pivotId: '' })
    }
    return beginNextInsertion({ seededIds: state.seededIds, sorted, unsorted, lo: 0, hi: 0, pivotId: '' })
  }

  // Pivot survived — clamp its search window in case `sorted` shrank underneath it.
  hi = Math.min(hi, sorted.length)
  lo = Math.min(lo, hi)
  if (lo >= hi) {
    const newSorted = [...sorted.slice(0, lo), pivotId, ...sorted.slice(lo)]
    return beginNextInsertion({ seededIds: state.seededIds, sorted: newSorted, unsorted, lo: 0, hi: 0, pivotId: '' })
  }
  return { seededIds: state.seededIds, sorted, unsorted, lo, hi, pivotId }
}
