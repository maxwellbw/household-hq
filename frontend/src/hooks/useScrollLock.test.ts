import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useScrollLock } from './useScrollLock'

beforeEach(() => {
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
})

describe('useScrollLock', () => {
  it('locks background scroll on mount', () => {
    renderHook(() => useScrollLock())
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')
  })

  it('restores scroll on unmount', () => {
    const { unmount } = renderHook(() => useScrollLock())
    unmount()
    expect(document.body.style.overflow).toBe('')
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('keeps the lock through a nested open — only restores once the last one closes', () => {
    const outer = renderHook(() => useScrollLock())
    const inner = renderHook(() => useScrollLock())

    inner.unmount()
    // The outer dialog is still open — scroll must stay locked.
    expect(document.body.style.overflow).toBe('hidden')

    outer.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('restores the pre-existing inline overflow value rather than clobbering it', () => {
    document.body.style.overflow = 'scroll'
    const { unmount } = renderHook(() => useScrollLock())
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('a rapid mount/unmount/mount/unmount always ends fully restored', () => {
    const a = renderHook(() => useScrollLock())
    a.unmount()
    const b = renderHook(() => useScrollLock())
    b.unmount()
    expect(document.body.style.overflow).toBe('')
    expect(document.documentElement.style.overflow).toBe('')
  })
})
