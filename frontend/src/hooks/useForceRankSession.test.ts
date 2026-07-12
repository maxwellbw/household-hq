import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useForceRankSession } from './useForceRankSession'

const STORAGE_KEY = 'household-hq.forceRankSession'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('useForceRankSession', () => {
  it('starts with no session when nothing is stored', () => {
    const { result } = renderHook(() => useForceRankSession(['a', 'b', 'c']))
    expect(result.current.session).toBeNull()
    expect(result.current.pair).toBeNull()
    expect(result.current.order).toBeNull()
  })

  it('start() begins a session and persists it to localStorage', () => {
    const { result } = renderHook(() => useForceRankSession(['a', 'b']))
    act(() => result.current.start())
    expect(result.current.session).not.toBeNull()
    expect(result.current.pair).toEqual({ a: 'b', b: 'a' })
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('answer() advances the session and updates localStorage', () => {
    const { result } = renderHook(() => useForceRankSession(['a', 'b']))
    act(() => result.current.start())
    const pair = result.current.pair!
    act(() => result.current.answer(pair.a))
    expect(result.current.order).toEqual([pair.a, pair.b])
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.sorted).toEqual([pair.a, pair.b])
  })

  it('reset() clears the session and removes it from localStorage', () => {
    const { result } = renderHook(() => useForceRankSession(['a', 'b']))
    act(() => result.current.start())
    act(() => result.current.reset())
    expect(result.current.session).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('resumes an in-progress session already in localStorage on mount (same-device resume, FR-013)', () => {
    const first = renderHook(() => useForceRankSession(['a', 'b', 'c']))
    act(() => first.result.current.start())
    const pairBefore = first.result.current.pair!
    act(() => first.result.current.answer(pairBefore.a))
    const partialState = localStorage.getItem(STORAGE_KEY)
    expect(partialState).not.toBeNull()

    // Simulate leaving and returning: a fresh hook instance reads the same storage key.
    const second = renderHook(() => useForceRankSession(['a', 'b', 'c']))
    expect(second.result.current.session).not.toBeNull()
    expect(second.result.current.order).toBeNull() // still mid-session, not re-started
  })

  it('reconciles a dropped task out of the session without crashing (list changed mid-session)', () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useForceRankSession(ids),
      { initialProps: { ids: ['a', 'b', 'c'] } },
    )
    act(() => result.current.start())

    // 'c' is scheduled away mid-session — drop it from the live someday set.
    rerender({ ids: ['a', 'b'] })

    const tracked = result.current.session
      ? [...result.current.session.sorted, ...result.current.session.unsorted, result.current.session.pivotId].filter(Boolean)
      : []
    expect(tracked).not.toContain('c')
  })

  it('reconciles a brand-new task into the session (appended, not lost)', () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useForceRankSession(ids),
      { initialProps: { ids: ['a', 'b'] } },
    )
    act(() => result.current.start())
    act(() => result.current.answer(result.current.pair!.a)) // completes the 2-item session

    // A new someday task appears mid-session.
    rerender({ ids: ['a', 'b', 'd'] })

    const tracked = result.current.session
      ? [...result.current.session.sorted, ...result.current.session.unsorted, result.current.session.pivotId].filter(Boolean)
      : []
    expect(tracked).toContain('d')
  })
})
