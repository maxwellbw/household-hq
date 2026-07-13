# Contract: Push API actions (010)

Three new actions in the `HANDLERS` registry (`backend/Api.js`), following the existing
`noun.verb` convention and the standard envelope: `text/plain` POST, always HTTP 200, body
`{ ok, data? , error? }`, ID-token verified + allowlisted before dispatch (feature 002),
`actor` resolved to `max`/`jaz`. All three require a signed-in caller.

---

## `push.config`

Return what the frontend needs to create a subscription.

**Request**: `{ action: 'push.config', token }` (no payload fields).

**Response `data`**:
```json
{ "vapidPublicKey": "<base64url raw P-256 public key>", "pushEnabled": true }
```

- `vapidPublicKey` — the applicationServerKey the browser's `pushManager.subscribe` needs.
- `pushEnabled` — household master switch; the UI may note "notifications are off for the
  household" when `false` (still allows subscribing so it's ready when re-enabled).

**Errors**: `NOT_CONFIGURED` if `vapidPublicKey` is blank (setup not run) — the UI shows a
"push isn't set up yet" state rather than attempting to subscribe.

---

## `push.subscribe`

Upsert the calling device's subscription against the signed-in person. Endpoint-keyed,
idempotent, `LockService`-wrapped.

**Request**:
```json
{
  "action": "push.subscribe",
  "token": "<id token>",
  "payload": {
    "endpoint": "https://web.push.apple.com/...",
    "p256dh": "<base64url>",
    "auth": "<base64url>",
    "deviceLabel": "iPhone Safari"
  }
}
```

- Required: `endpoint`, `p256dh`, `auth`. `deviceLabel` optional (backend derives a fallback from
  the request User-Agent / a generic label if omitted).
- `person` is **not** client-supplied — it is the verified `actor`.

**Behavior**: if a row with `endpoint` exists → update `p256dh`, `auth`, `deviceLabel`, `person`
(to current actor), `lastUsedAt`; else insert a new row (`id = getUuid()`, `createdAt` now).
Appends `push-subscribe` to ActivityLog.

**Response `data`**: `{ "subscribed": true, "deviceLabel": "iPhone Safari" }`.

**Errors**: `VALIDATION_FAILED` (field-tagged) when `endpoint`/`p256dh`/`auth` missing or
malformed.

---

## `push.unsubscribe`

Remove the calling device's subscription.

**Request**:
```json
{ "action": "push.unsubscribe", "token": "<id token>", "payload": { "endpoint": "https://..." } }
```

**Behavior**: delete the row whose `endpoint` matches (no-op if absent — still `ok:true`,
idempotent). Appends `push-unsubscribe` to ActivityLog when a row was removed.

**Response `data`**: `{ "unsubscribed": true }`.

---

## Send path (internal, not an action)

Not client-callable; invoked from `completeTask_` and the acknowledge handler in place of the
retired ntfy calls, inside the existing `if (result.changed)` guard.

- `pushCompletion_(task, completer)` — recipient = `otherPerson_(completer)`.
- `pushAcknowledge_(task)` — recipient = `otherPerson_(task.owner)`.

Both: gate on `pushEnabled`; look up recipient's `PushSubscriptions` rows; for each, build the
`{title, body, url, tag}` payload (same text as the retired ntfy messages), encrypt per RFC 8291,
sign VAPID per RFC 8292, `UrlFetchApp.fetch` (or `fetchAll`) to the endpoint with
`muteHttpExceptions:true`; on `404`/`410` mark the row for pruning; batch-delete pruned rows;
append one `push-notify` log line summarizing the outcome. **Never throws.** Skips silently
(logged) when `pushEnabled` is false or the recipient has no rows.

**Idempotency**: guaranteed by the caller's `if (result.changed)` guard — a re-run/re-complete
does not re-enter the send path. No per-message ledger needed (mirrors ntfy).
