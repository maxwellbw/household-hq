import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSheetHistory } from './useSheetHistory'

// Spies on the real history API rather than relying on jsdom's actual (async) navigation
// timing — we only need to verify the calls this hook makes and the listener it wires up.

describe('useSheetHistory', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
  })

  it('pushes a {hqSheet: "planner"} history entry while open', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState')
    renderHook(() => useSheetHistory(true, vi.fn()))
    expect(pushSpy).toHaveBeenCalledWith({ hqSheet: 'planner' }, '')
    pushSpy.mockRestore()
  })

  it('does not push history when not open', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState')
    renderHook(() => useSheetHistory(false, vi.fn()))
    expect(pushSpy).not.toHaveBeenCalled()
    pushSpy.mockRestore()
  })

  it('calls onClose when a popstate event fires (browser Back)', () => {
    const onClose = vi.fn()
    renderHook(() => useSheetHistory(true, onClose))
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('close() calls history.back() rather than onClose directly, when its own push is on top', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const onClose = vi.fn()
    const { result } = renderHook(() => useSheetHistory(true, onClose))

    result.current.close()

    expect(backSpy).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    backSpy.mockRestore()
  })

  it('cold-start guard: does not push a second entry when one is already on top, and close() calls onClose directly instead of back()', () => {
    // Simulate a deep link that already landed on a {hqSheet: 'planner'} entry before this
    // hook instance's effect runs.
    window.history.replaceState({ hqSheet: 'planner' }, '', window.location.pathname)
    const pushSpy = vi.spyOn(window.history, 'pushState')
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const onClose = vi.fn()
    const { result } = renderHook(() => useSheetHistory(true, onClose))
    expect(pushSpy).not.toHaveBeenCalled()

    result.current.close()

    expect(backSpy).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
    pushSpy.mockRestore()
    backSpy.mockRestore()
  })

  it('removes the popstate listener on unmount so a later popstate does not re-trigger onClose', () => {
    const onClose = vi.fn()
    const { unmount } = renderHook(() => useSheetHistory(true, onClose))
    unmount()

    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
