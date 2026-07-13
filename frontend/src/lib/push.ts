// Web push helpers (feature 010 US2/US3). Pure functions plus small browser-API wrappers —
// callers supply `authedCall` (from useAuth) so this file stays untangled from auth wiring.

export type PushCapability = 'unsupported' | 'blocked' | 'default' | 'granted'

export function isStandalone(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari's own (non-standard) flag for an installed home-screen launch.
  return (navigator as unknown as { standalone?: boolean }).standalone === true
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Folds support + iOS-install detection + OS permission into one actionable state
 * (research R4): iOS only exposes PushManager inside an installed PWA, so a normal
 * Safari tab is `unsupported`, not a dead "Enable" button.
 */
export function getCapability(): PushCapability {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission === 'granted') return 'granted'
  return 'default'
}

/** "iPhone Safari", "Mac Chrome", etc. — approximate, no manual naming (research R8). */
export function deriveDeviceLabel(): string {
  const ua = navigator.userAgent
  const platform = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : 'Device'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\/|CriOS\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser'
  return `${platform} ${browser}`
}

function urlB64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function bufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface PushConfig {
  vapidPublicKey: string
  pushEnabled: boolean
}

type AuthedCall = <T>(action: string, payload?: Record<string, unknown>) => Promise<T>

/** Request OS permission (must be called from a user gesture) and register the subscription. */
export async function subscribeThisDevice(authedCall: AuthedCall): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const config = await authedCall<PushConfig>('push.config')
  if (!config.vapidPublicKey) {
    throw new Error('Push isn’t set up yet on the backend (run setupPush()).')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(config.vapidPublicKey) as BufferSource,
  })

  await authedCall('push.subscribe', {
    endpoint: subscription.endpoint,
    p256dh: bufferToBase64Url(subscription.getKey('p256dh')),
    auth: bufferToBase64Url(subscription.getKey('auth')),
    deviceLabel: deriveDeviceLabel(),
  })
}

/** Unsubscribe this device both locally and server-side. Safe to call when already off. */
export async function unsubscribeThisDevice(authedCall: AuthedCall): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await authedCall('push.unsubscribe', { endpoint })
}

/** Whether this device currently holds a live push subscription. */
export async function isSubscribedThisDevice(): Promise<boolean> {
  if (!isPushSupported()) return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return subscription != null
}
