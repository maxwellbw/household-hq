// Notification-tap deep-linking (feature 010 US3, generalized in feature 033 US4 / R3). A
// push notification's `url` carries one of `?task=<id>`, `?walk=<YYYY-MM-DD>`, or
// `?overdue=1`; on launch (or a service-worker "deeplink" postMessage) we parse that param
// into a `DeepLink`, hand it to the caller, then strip all recognized params via
// replaceState so a refresh doesn't re-open it. Absent/unparseable → the caller's fallback
// (Home). See contracts/deeplink-urls.md.

export type DeepLink =
  | { kind: 'task'; taskId: string }
  | { kind: 'walk'; dateKey: string }
  | { kind: 'overdue' }

const WALK_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Precedence when more than one recognized param is present: task → walk → overdue
// (contracts/deeplink-urls.md) — matches the check order below.
function parseDeepLinkParams(params: URLSearchParams): DeepLink | null {
  const taskId = params.get('task')
  if (taskId) return { kind: 'task', taskId }
  const walk = params.get('walk')
  if (walk !== null) return WALK_DATE_RE.test(walk) ? { kind: 'walk', dateKey: walk } : null
  if (params.get('overdue') === '1') return { kind: 'overdue' }
  return null
}

export function readDeepLink(): DeepLink | null {
  const params = new URLSearchParams(window.location.search)
  const hadRecognizedParam = params.has('task') || params.has('walk') || params.has('overdue')
  if (!hadRecognizedParam) return null

  const link = parseDeepLinkParams(params)
  params.delete('task')
  params.delete('walk')
  params.delete('overdue')
  const rest = params.toString()
  const next = window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash
  window.history.replaceState(null, '', next)
  return link
}

/** Wire once at app startup: calls `onLink` with the parsed deep link, whether it arrived
 *  via the current URL (cold launch from a notification) or a warm-app postMessage from the
 *  service worker (tapped a notification while the app was already open). */
export function listenForDeepLinks(onLink: (link: DeepLink) => void): () => void {
  const fromUrl = readDeepLink()
  if (fromUrl) onLink(fromUrl)

  function handleMessage(event: MessageEvent) {
    if (event.data?.type === 'deeplink' && typeof event.data.url === 'string') {
      const url = new URL(event.data.url)
      const link = parseDeepLinkParams(url.searchParams)
      if (link) onLink(link)
    }
  }

  navigator.serviceWorker?.addEventListener('message', handleMessage)
  return () => navigator.serviceWorker?.removeEventListener('message', handleMessage)
}
