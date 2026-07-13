import { afterEach, describe, expect, it, vi } from 'vitest'
import { deriveDeviceLabel, getCapability, isPushSupported } from './push'

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
}

const ORIGINAL_UA = navigator.userAgent

afterEach(() => {
  setUserAgent(ORIGINAL_UA)
  vi.unstubAllGlobals()
})

describe('deriveDeviceLabel', () => {
  it('recognizes iPhone Safari', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    )
    expect(deriveDeviceLabel()).toBe('iPhone Safari')
  })

  it('recognizes Mac Chrome', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    )
    expect(deriveDeviceLabel()).toBe('Mac Chrome')
  })

  it('recognizes Android Chrome', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36')
    expect(deriveDeviceLabel()).toBe('Android Chrome')
  })

  it('falls back to generic labels for an unrecognized UA', () => {
    setUserAgent('SomeUnknownBrowser/1.0')
    expect(deriveDeviceLabel()).toBe('Device Browser')
  })
})

describe('isPushSupported / getCapability', () => {
  it('is unsupported when the platform lacks PushManager/serviceWorker', () => {
    vi.stubGlobal('PushManager', undefined)
    expect(isPushSupported()).toBe(false)
    expect(getCapability()).toBe('unsupported')
  })

  it('reflects a denied OS permission as blocked', () => {
    vi.stubGlobal('PushManager', function () {})
    vi.stubGlobal('Notification', { permission: 'denied' })
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    expect(getCapability()).toBe('blocked')
  })

  it('reflects a granted OS permission as granted', () => {
    vi.stubGlobal('PushManager', function () {})
    vi.stubGlobal('Notification', { permission: 'granted' })
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    expect(getCapability()).toBe('granted')
  })

  it('reflects an undecided OS permission as default', () => {
    vi.stubGlobal('PushManager', function () {})
    vi.stubGlobal('Notification', { permission: 'default' })
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    expect(getCapability()).toBe('default')
  })
})
