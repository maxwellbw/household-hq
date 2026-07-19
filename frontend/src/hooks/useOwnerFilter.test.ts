import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { resetOwnerFilterStoreForTests, useOwnerFilter } from './useOwnerFilter'

const STORAGE_KEY = 'hq.ownerFilter'

beforeEach(() => {
  localStorage.clear()
  resetOwnerFilterStoreForTests()
})

afterEach(() => {
  localStorage.clear()
  resetOwnerFilterStoreForTests()
})

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

  it('deselecting every owner normalizes back to all-selected instead of an empty view (FR-020)', () => {
    const { result } = renderHook(() => useOwnerFilter())
    act(() => {
      result.current.toggle('max')
      result.current.toggle('jaz')
      result.current.toggle('both')
    })
    expect(result.current.visibleOwners).toEqual(new Set(['max', 'jaz', 'both']))
  })

  it('falls back to all-owners when storage is missing or malformed', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json')
    const { result } = renderHook(() => useOwnerFilter())
    expect(result.current.visibleOwners).toEqual(new Set(['max', 'jaz', 'both']))
  })

  it('normalizes a stored empty array back to all-owners on read', () => {
    localStorage.setItem(STORAGE_KEY, '[]')
    const { result } = renderHook(() => useOwnerFilter())
    expect(result.current.visibleOwners).toEqual(new Set(['max', 'jaz', 'both']))
  })

  it('is a single shared instance: a toggle in one hook consumer is reflected live in another (FR-020 scenario 4)', () => {
    const calendar = renderHook(() => useOwnerFilter())
    const tasks = renderHook(() => useOwnerFilter())
    act(() => calendar.result.current.toggle('jaz'))
    expect(tasks.result.current.visibleOwners.has('jaz')).toBe(false)
  })

  it('persists a toggle across a simulated reload', () => {
    const { result } = renderHook(() => useOwnerFilter())
    act(() => result.current.toggle('jaz'))

    resetOwnerFilterStoreForTests()
    const { result: reloaded } = renderHook(() => useOwnerFilter())
    expect(reloaded.current.visibleOwners.has('jaz')).toBe(false)
  })
})
