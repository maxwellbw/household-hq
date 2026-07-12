import { describe, expect, it } from 'vitest'
import { startSession, nextPair, applyAnswer, finalOrder, reconcile } from './forceRank'
import type { ForceRankSession } from './forceRank'

/** Drives a session to completion using a "true order" comparator; returns the result and comparison count. */
function runSession(ids: string[], trueOrder: string[]) {
  let state = startSession(ids)
  let comparisons = 0
  while (true) {
    const pair = nextPair(state)
    if (!pair) break
    comparisons++
    const winner = trueOrder.indexOf(pair.a) < trueOrder.indexOf(pair.b) ? pair.a : pair.b
    state = applyAnswer(state, winner)
  }
  return { order: finalOrder(state)!, comparisons }
}

describe('startSession / finalOrder — trivial cases', () => {
  it('empty input completes immediately with an empty order', () => {
    const state = startSession([])
    expect(finalOrder(state)).toEqual([])
    expect(nextPair(state)).toBeNull()
  })

  it('a single item completes immediately with no comparisons', () => {
    const state = startSession(['only'])
    expect(finalOrder(state)).toEqual(['only'])
    expect(nextPair(state)).toBeNull()
  })

  it('finalOrder is null while comparisons remain', () => {
    const state = startSession(['a', 'b'])
    expect(finalOrder(state)).toBeNull()
  })
})

describe('nextPair / applyAnswer — mechanics', () => {
  it('presents exactly two IDs and advances on a valid answer', () => {
    const state = startSession(['a', 'b'])
    const pair = nextPair(state)!
    expect(pair.a).toBe('b')
    expect(pair.b).toBe('a')
    const next = applyAnswer(state, pair.a)
    expect(nextPair(next)).toBeNull()
    expect(finalOrder(next)).toEqual(['b', 'a'])
  })

  it('the loser wins the comparison the other way — item is placed after', () => {
    const state = startSession(['a', 'b'])
    const pair = nextPair(state)!
    const next = applyAnswer(state, pair.b)
    expect(finalOrder(next)).toEqual(['a', 'b'])
  })

  it('an unrecognized winner id is a no-op (never throws, never corrupts state)', () => {
    const state = startSession(['a', 'b', 'c'])
    const before = JSON.stringify(state)
    const next = applyAnswer(state, 'not-in-this-pair')
    expect(JSON.stringify(next)).toBe(before)
  })

  it('three items resolve in at most 2 comparisons', () => {
    const { order, comparisons } = runSession(['b', 'a', 'c'], ['a', 'b', 'c'])
    expect(order).toEqual(['a', 'b', 'c'])
    expect(comparisons).toBeLessThanOrEqual(2)
  })
})

describe('comparison count stays sub-quadratic (SC-002)', () => {
  it('10 items resolve well under n·(n-1)/2 and within roughly n·log2(n)', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `id${i}`)
    const trueOrder = [...ids].reverse() // arbitrary fixed "true" priority order
    const { order, comparisons } = runSession(ids, trueOrder)
    expect(order).toEqual(trueOrder)
    const everyPair = (ids.length * (ids.length - 1)) / 2
    const nLogN = Math.ceil(ids.length * Math.log2(ids.length))
    expect(comparisons).toBeLessThan(everyPair)
    expect(comparisons).toBeLessThanOrEqual(nLogN)
  })

  it('20 items: comparisons stay far below every-pair (n²) growth', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id${i}`)
    const trueOrder = [...ids].sort(() => 0.5) // shuffled fixed order
    const { order, comparisons } = runSession(ids, trueOrder)
    expect(order).toEqual(trueOrder)
    const everyPair = (ids.length * (ids.length - 1)) / 2 // 190
    expect(comparisons).toBeLessThan(everyPair / 2)
  })
})

describe('reconcile — resume and mid-session drift', () => {
  it('drops an id no longer live and appends a brand-new id to unsorted', () => {
    let state = startSession(['a', 'b', 'c'])
    // Place 'b' relative to 'a': sorted becomes ['a', 'b'] (a wins), pivot moves to 'c'.
    let pair = nextPair(state)!
    state = applyAnswer(state, pair.b === 'a' ? pair.b : pair.a) // whichever id is 'a' wins
    expect(state.sorted).toEqual(['a', 'b'])
    pair = nextPair(state)!
    expect(pair.a).toBe('c') // 'c' is the active pivot

    // Drift: 'b' scheduled away (no longer live); 'd' is a brand-new someday task.
    state = reconcile(state, ['a', 'c', 'd'])

    const tracked = [...state.sorted, ...state.unsorted, ...(state.pivotId ? [state.pivotId] : [])]
    expect(tracked).not.toContain('b')
    expect(tracked).toContain('d')
    expect(state.sorted).toContain('a') // already-placed survivor kept
  })

  it('preserves already-answered relative order across a reconcile', () => {
    let state = startSession(['a', 'b'])
    const pair = nextPair(state)!
    // Force 'a' to win so sorted === ['a', 'b'] deterministically.
    const aWins = pair.a === 'a' ? pair.a : pair.b
    state = applyAnswer(state, aWins)
    expect(state.sorted).toEqual(['a', 'b'])

    // Reconcile with the same live set plus a new item — no drops.
    state = reconcile(state, ['a', 'b', 'c'])

    // Finish the session (whatever answers) and confirm 'a' still precedes 'b'.
    while (true) {
      const p = nextPair(state)
      if (!p) break
      state = applyAnswer(state, p.a)
    }
    const order = finalOrder(state)!
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.sort()).toEqual(['a', 'b', 'c'])
  })

  it('reconciling an already-completed session with an unchanged live set is a no-op', () => {
    let state = startSession(['a', 'b', 'c'])
    while (true) {
      const p = nextPair(state)
      if (!p) break
      state = applyAnswer(state, p.a)
    }
    const before = finalOrder(state)
    const after = reconcile(state, ['a', 'b', 'c'])
    expect(finalOrder(after)).toEqual(before)
  })

  it('dropping the active pivot forfeits only its unresolved comparison, not the rest of the session', () => {
    let state = startSession(['a', 'b', 'c', 'd'])
    // Place 'b': sorted -> ['a','b'] or ['b','a'] depending on answer; pivot becomes 'c'.
    let pair = nextPair(state)!
    state = applyAnswer(state, pair.a)
    pair = nextPair(state)! // pivot is now 'c'
    expect(pair.a).toBe('c')

    // 'c' (the active pivot) gets completed/scheduled away mid-comparison.
    const survivors = state.sorted // 'a' and 'b' in whatever order was settled
    state = reconcile(state, [...survivors, 'd'])

    const tracked = [...state.sorted, ...state.unsorted, ...(state.pivotId ? [state.pivotId] : [])]
    expect(tracked).not.toContain('c')
    expect(tracked.sort()).toEqual([...survivors, 'd'].sort())
  })

  it('reconciling down to zero live tasks empties the session without throwing', () => {
    const state = startSession(['a', 'b'])
    const after = reconcile(state, [])
    expect(finalOrder(after)).toEqual([])
  })
})

describe('session state is JSON-serializable (localStorage-safe, R4)', () => {
  it('round-trips through JSON.stringify/parse unchanged', () => {
    const state = startSession(['a', 'b', 'c'])
    const roundTripped = JSON.parse(JSON.stringify(state)) as ForceRankSession
    expect(roundTripped).toEqual(state)
  })
})
