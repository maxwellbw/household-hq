// Notification-tap deep-linking (feature 010 US3 / research R7). A push notification's
// `url` carries `?task=<id>`; on launch (or a service-worker "deeplink" postMessage) we
// read that param, hand the id to the caller, then strip it via replaceState so a refresh
// doesn't re-open it. Absent/unparseable → the caller's fallback (Home).

export function readDeepLinkTaskId(): string | null {
  const params = new URLSearchParams(window.location.search)
  const taskId = params.get('task')
  if (!taskId) return null
  params.delete('task')
  const rest = params.toString()
  const next = window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash
  window.history.replaceState(null, '', next)
  return taskId
}

/** Wire once at app startup: calls `onTaskId` with the deep-linked task id, whether it
 *  arrived via the current URL (cold launch from a notification) or a warm-app postMessage
 *  from the service worker (tapped a notification while the app was already open). */
export function listenForDeepLinks(onTaskId: (taskId: string) => void): () => void {
  const fromUrl = readDeepLinkTaskId()
  if (fromUrl) onTaskId(fromUrl)

  function handleMessage(event: MessageEvent) {
    if (event.data?.type === 'deeplink' && typeof event.data.url === 'string') {
      const url = new URL(event.data.url)
      const taskId = url.searchParams.get('task')
      if (taskId) onTaskId(taskId)
    }
  }

  navigator.serviceWorker?.addEventListener('message', handleMessage)
  return () => navigator.serviceWorker?.removeEventListener('message', handleMessage)
}
