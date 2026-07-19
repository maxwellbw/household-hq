import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { resetThemeStoreForTests, useTheme } from './useTheme'

const STORAGE_KEY = 'hq.theme'

/** Controllable matchMedia stand-in (jsdom's can't flip at runtime). */
function stubMatchMedia(initiallyDark: boolean) {
  let matches = initiallyDark
  const changeListeners = new Set<(e: { matches: boolean }) => void>()
  const mql = {
    get matches() {
      return matches
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => changeListeners.add(cb),
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) =>
      changeListeners.delete(cb),
  }
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql))
  return {
    setOsDark(next: boolean) {
      matches = next
      changeListeners.forEach((cb) => cb({ matches }))
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  resetThemeStoreForTests()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  resetThemeStoreForTests()
})

describe('useTheme', () => {
  it('defaults to system and resolves from the OS scheme', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.preference).toBe('system')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('treats an invalid stored value as system (never throws)', () => {
    stubMatchMedia(false)
    localStorage.setItem(STORAGE_KEY, 'sepia')
    const { result } = renderHook(() => useTheme())
    expect(result.current.preference).toBe('system')
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('an explicit stored preference beats the OS scheme', () => {
    stubMatchMedia(true) // OS is dark…
    localStorage.setItem(STORAGE_KEY, 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('setPreference persists, restamps <html>, and is shared across hook instances', () => {
    stubMatchMedia(false)
    const first = renderHook(() => useTheme())
    const second = renderHook(() => useTheme())
    act(() => first.result.current.setPreference('dark'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(second.result.current.preference).toBe('dark')
    expect(second.result.current.resolvedTheme).toBe('dark')
  })

  it('follows a live OS change while on system, and stops following after an explicit choice', () => {
    const os = stubMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    expect(result.current.resolvedTheme).toBe('light')

    act(() => os.setOsDark(true))
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    act(() => result.current.setPreference('light'))
    act(() => os.setOsDark(false))
    act(() => os.setOsDark(true))
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('returning to system resumes following the OS', () => {
    const os = stubMatchMedia(true)
    localStorage.setItem(STORAGE_KEY, 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.resolvedTheme).toBe('light')
    act(() => result.current.setPreference('system'))
    expect(result.current.resolvedTheme).toBe('dark')
    act(() => os.setOsDark(false))
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('syncs every theme-color meta to the active theme background', () => {
    stubMatchMedia(false)
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
    // jsdom doesn't resolve CSS custom properties; substitute computed style.
    vi.stubGlobal(
      'getComputedStyle',
      vi.fn().mockReturnValue({ getPropertyValue: () => ' #123456 ' }),
    )
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setPreference('dark'))
    expect(meta.getAttribute('content')).toBe('#123456')
    meta.remove()
  })
})
