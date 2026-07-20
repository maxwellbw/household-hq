import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listenForDeepLinks, readDeepLink } from './deeplink'

function setUrl(search: string) {
  window.history.replaceState(null, '', `/${search}`)
}

describe('deeplink', () => {
  afterEach(() => {
    setUrl('')
  })

  describe('readDeepLink', () => {
    it('parses ?task=<id> and strips it', () => {
      setUrl('?task=abc123')
      expect(readDeepLink()).toEqual({ kind: 'task', taskId: 'abc123' })
      expect(window.location.search).toBe('')
    })

    it('parses ?walk=<YYYY-MM-DD> and strips it', () => {
      setUrl('?walk=2026-07-20')
      expect(readDeepLink()).toEqual({ kind: 'walk', dateKey: '2026-07-20' })
      expect(window.location.search).toBe('')
    })

    it('parses ?overdue=1 and strips it', () => {
      setUrl('?overdue=1')
      expect(readDeepLink()).toEqual({ kind: 'overdue' })
      expect(window.location.search).toBe('')
    })

    it('returns null and strips the param for an unparseable walk date', () => {
      setUrl('?walk=not-a-date')
      expect(readDeepLink()).toBeNull()
      expect(window.location.search).toBe('')
    })

    it('returns null when no recognized param is present, and leaves the URL untouched', () => {
      setUrl('?other=1')
      expect(readDeepLink()).toBeNull()
      expect(window.location.search).toBe('?other=1')
    })

    it('leaves unrelated params in place while stripping the recognized one', () => {
      setUrl('?foo=bar&task=t1')
      readDeepLink()
      expect(window.location.search).toBe('?foo=bar')
    })

    it('prefers task over walk and overdue when multiple are present, per the documented precedence', () => {
      setUrl('?task=t1&walk=2026-07-20&overdue=1')
      expect(readDeepLink()).toEqual({ kind: 'task', taskId: 't1' })
      expect(window.location.search).toBe('')
    })

    it('prefers walk over overdue when both are present', () => {
      setUrl('?walk=2026-07-20&overdue=1')
      expect(readDeepLink()).toEqual({ kind: 'walk', dateKey: '2026-07-20' })
    })
  })

  describe('listenForDeepLinks', () => {
    const originalServiceWorker = navigator.serviceWorker
    let fakeServiceWorker: EventTarget

    beforeEach(() => {
      setUrl('')
      fakeServiceWorker = new EventTarget()
      Object.defineProperty(navigator, 'serviceWorker', { value: fakeServiceWorker, configurable: true })
    })

    afterEach(() => {
      Object.defineProperty(navigator, 'serviceWorker', { value: originalServiceWorker, configurable: true })
    })

    it('calls onLink immediately for a cold-launch URL param', () => {
      setUrl('?walk=2026-07-20')
      const onLink = vi.fn()
      const unsubscribe = listenForDeepLinks(onLink)
      expect(onLink).toHaveBeenCalledWith({ kind: 'walk', dateKey: '2026-07-20' })
      unsubscribe()
    })

    it('does not call onLink when the URL has no recognized param', () => {
      const onLink = vi.fn()
      const unsubscribe = listenForDeepLinks(onLink)
      expect(onLink).not.toHaveBeenCalled()
      unsubscribe()
    })

    it('calls onLink for a warm-app postMessage from the service worker', () => {
      const onLink = vi.fn()
      const unsubscribe = listenForDeepLinks(onLink)
      onLink.mockClear()

      fakeServiceWorker.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'deeplink', url: 'https://app.example/?overdue=1' },
        }),
      )
      expect(onLink).toHaveBeenCalledWith({ kind: 'overdue' })
      unsubscribe()
    })

    it('ignores a postMessage after unsubscribe', () => {
      const onLink = vi.fn()
      const unsubscribe = listenForDeepLinks(onLink)
      onLink.mockClear()
      unsubscribe()

      fakeServiceWorker.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'deeplink', url: 'https://app.example/?task=t1' },
        }),
      )
      expect(onLink).not.toHaveBeenCalled()
    })
  })
})
