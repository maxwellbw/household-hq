import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOwnerFilter } from './useOwnerFilter'

const STORAGE_KEY = 'household-hq.ownerFilter'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('useOwnerFilter', () => {
  it('defaults to all owners visible when nothing is stored', () => {
    const { result } = renderHook(() => useOwnerFilter())
    expect(result.current.visibleOwners).toEqual(new Set(['max', 'jaz', 'both']))
  })

  it('toggling an owner off then on again restores it', () => {
    const { result } = renderHook(() => useOwnerFilter())
    act(() => result.current.toggle('jaz'))
    expect(result.current.visibleOwners.has('jaz')).toBe(false)
    act(() => result.current.toggle('jaz'))
    expect(result.current.visibleOwners.has('jaz')).toBe(true)
  })

  it('persists an intentionally-empty filter (all chips off) across reload, rather than resetting to all-on', () => {
    const { result } = renderHook(() => useOwnerFilter())
    act(() => {
      result.current.toggle('max')
      result.current.toggle('jaz')
      result.current.toggle('both')
    })
    expect(result.current.visibleOwners.size).toBe(0)

    // Simulate a reload: mount a fresh hook instance reading the same storage.
    const { result: reloaded } = renderHook(() => useOwnerFilter())
    expect(reloaded.current.visibleOwners.size).toBe(0)
  })

  it('falls back to all-owners when storage is missing or malformed', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json')
    const { result } = renderHook(() => useOwnerFilter())
    expect(result.current.visibleOwners).toEqual(new Set(['max', 'jaz', 'both']))
  })
})
