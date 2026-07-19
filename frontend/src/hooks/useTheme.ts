import { useCallback, useEffect, useSyncExternalStore } from 'react'

/**
 * Feature 032 US1 — theme preference (data-model ThemePreference).
 *
 * One module-level store so every consumer (App's engine mount, the More →
 * Appearance control) reads and writes the same state: `hq.theme` in
 * localStorage (`system | light | dark`, anything else → `system`), a live
 * matchMedia subscription for the OS scheme, and the derived resolved theme.
 * Applying the resolved theme means exactly two effects (data-model): the
 * `data-theme` attribute on <html> and the `theme-color` meta content — all
 * styling flows from the token blocks in index.css (contract C1).
 */
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'hq.theme'

function readStored(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system'
  } catch {
    return 'system'
  }
}

type ThemeStore = {
  preference: ThemePreference
  media: MediaQueryList | null
  listeners: Set<() => void>
}

let store: ThemeStore | null = null

function getStore(): ThemeStore {
  if (store) return store
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  store = { preference: readStored(), media, listeners: new Set() }
  // OS scheme changes only matter while following the system; applyTheme is a
  // no-op re-stamp otherwise. Listener lives for the app's lifetime.
  media?.addEventListener('change', () => {
    applyTheme()
    notify()
  })
  return store
}

function notify() {
  for (const listener of getStore().listeners) listener()
}

function subscribe(listener: () => void): () => void {
  const s = getStore()
  s.listeners.add(listener)
  return () => s.listeners.delete(listener)
}

function getPreference(): ThemePreference {
  return getStore().preference
}

export function getResolvedTheme(): ResolvedTheme {
  const s = getStore()
  if (s.preference !== 'system') return s.preference
  return s.media?.matches ? 'dark' : 'light'
}

/**
 * Stamp <html data-theme> and sync the theme-color metas to the active
 * theme's --bg (read from computed style so the CSS token block stays the
 * single source of color truth — no hex here, contract C1).
 */
function applyTheme() {
  const root = document.documentElement
  root.setAttribute('data-theme', getResolvedTheme())
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  if (bg) {
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute('content', bg))
  }
}

export function setThemePreference(next: ThemePreference) {
  const s = getStore()
  s.preference = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Private-mode/quota failures degrade to session-only preference.
  }
  applyTheme()
  notify()
}

/** Test-only: drop the module store so each test starts from clean storage/matchMedia. */
export function resetThemeStoreForTests() {
  store = null
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, getPreference)
  const resolvedTheme = useSyncExternalStore(subscribe, getResolvedTheme)

  // Re-stamp whenever preference or the resolved theme changes (covers the
  // initial mount correcting anything the pre-paint script missed).
  useEffect(() => {
    applyTheme()
  }, [preference, resolvedTheme])

  const setPreference = useCallback((next: ThemePreference) => setThemePreference(next), [])

  return { preference, resolvedTheme, setPreference }
}
