# Contract: Service Worker & push payload (010)

`frontend/public/sw.js` — hand-written, no Workbox. Served at `/household-hq/sw.js`, scope
`/household-hq/`. Registered from `main.tsx`. This file defines the SW's three responsibilities
and the push payload shape both sides agree on.

---

## Push payload (backend → SW)

The encrypted RFC 8291 body decrypts to this JSON (UTF-8):

```json
{
  "title": "Max completed: Take out recycling",
  "body":  "Max completed: Take out recycling",
  "url":   "/household-hq/?task=<taskId>",
  "tag":   "<taskId>"
}
```

- `title` / `body` — same text as the retired ntfy messages (FR-015). (Ntfy sent a single line;
  the SW may show `title` as the heading and `body` as the same or empty — kept identical for
  parity; can diverge later.)
- `url` — same-origin deep link opened on tap (R7). Always under `/household-hq/`.
- `tag` — task id; passed to `showNotification({ tag })` so repeated notifications about one task
  coalesce instead of stacking.

The SW must tolerate a missing/empty `data` (defensive default title/body, `url` → `BASE_URL`),
since iOS penalizes a `push` event that shows no notification.

---

## 1. Install / activate — app-shell cache

- `CACHE_VERSION` constant (e.g. `hq-shell-v1`); bump on structural SW change.
- `install`: `self.skipWaiting()`; optionally pre-open the cache. No brittle precache list.
- `activate`: delete caches whose name ≠ current `CACHE_VERSION`; `clients.claim()`.

## 2. Fetch — runtime caching (FR-003, FR-005)

Only handle same-origin GET:
- **Navigation requests** (`request.mode === 'navigate'`): network-first → on success cache a
  copy of the shell → on failure serve cached shell (`index.html`) → on miss serve a minimal
  inline offline card. Guarantees online users always get the newest HTML (no stale-build trap).
- **Hashed assets** (`/household-hq/assets/…`): cache-first (immutable per build hash), populate
  on first fetch.
- Everything else (API calls to the Apps Script origin, Google GSI): **bypass** — never cache,
  never intercept. API base URL is a different origin, so it isn't matched anyway.

## 3. Push & notificationclick (FR-013, FR-020)

- `push`: parse `event.data?.json()` defensively → `event.waitUntil(showNotification(title, {
  body, tag, data: { url }, icon, badge }))`. Icon/badge point at the app's PNG icons.
- `notificationclick`: `event.notification.close()`; `event.waitUntil(...)`:
  - `clients.matchAll({ type:'window', includeUncontrolled:true })` → if a client under scope
    exists, `focus()` it and `postMessage({ type:'deeplink', url })`;
  - else `clients.openWindow(url)`.

---

## Registration (main.tsx)

```
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js'))
}
```

Registration failure is non-fatal — the app works uninstalled (FR-005). Dev note: the SW is only
meaningful on the built/hosted site; local `vite dev` may skip or scope it to `/`.

---

## Frontend push helpers (`lib/push.ts`) — surface

- `isPushSupported(): boolean` — `'serviceWorker' in navigator && 'PushManager' in window &&
  'Notification' in window`.
- `getCapability(): 'unsupported' | 'blocked' | 'default' | 'granted'` — folds
  `isPushSupported()`, iOS-standalone detection, and `Notification.permission` (R4).
- `subscribeThisDevice(token): Promise<void>` — fetch `push.config` → `Notification.requestPermission()`
  → `reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlB64ToUint8(vapidPublicKey) })`
  → POST `push.subscribe` with endpoint/keys/`deriveDeviceLabel()`.
- `unsubscribeThisDevice(token): Promise<void>` — `reg.pushManager.getSubscription()` →
  `sub.unsubscribe()` → POST `push.unsubscribe`.
- `deriveDeviceLabel(): string` — coarse UA parse → `"iPhone Safari"`, `"Mac Chrome"`, etc.
- base64url ⇄ Uint8Array helpers for `applicationServerKey`.

## Deep-link handling (`lib/deeplink.ts`)

On launch and on SW `postMessage({type:'deeplink'})`: read `?task=`/`?date=`, open that task/day,
then `history.replaceState` to strip the param. Unknown/absent → Home.
