# Data Model: PWA Install + Web Push (010)

All storage is the Google Sheet (Principle II). One new tab, plus Settings deltas. Everything
stays plain text and hand-editable; deleting a `PushSubscriptions` row disables that device.

---

## New tab: `PushSubscriptions`

One row per enabled device. Registered in `Sheets.js` `TABS` and created by setup.

| Column | Type / format | Notes |
|--------|---------------|-------|
| `id` | UUID (`Utilities.getUuid()`) | Stable row identity; never derived from position. |
| `person` | `max` \| `jaz` | The signed-in person who enabled this device. Never `both`, never the shared account (resolved to a person on write, per the allowlist memory). |
| `endpoint` | URL string | Push service endpoint. **Natural dedupe key** (see R8). Long but plain text. |
| `p256dh` | base64url string | Subscription public key (from `PushSubscription.getKey('p256dh')`). Input to ECDH. |
| `auth` | base64url string | Subscription auth secret (`getKey('auth')`). Input to HKDF. |
| `deviceLabel` | string | Auto-derived from User-Agent at subscribe time, e.g. `iPhone Safari`. Human hint only. |
| `createdAt` | ISO 8601 (household tz) | When first subscribed. |
| `lastUsedAt` | ISO 8601 (household tz) | Updated on re-subscribe (upsert) and on a successful send. |

**Uniqueness**: `endpoint` is unique — `push.subscribe` upserts on it (update in place, else
insert). No two rows share an endpoint, so a single event never double-pushes one device.

**Lifecycle**:
- *Create/refresh* — `push.subscribe` (endpoint-keyed upsert under `LockService`).
- *Delete (user)* — `push.unsubscribe` removes the row for that endpoint.
- *Delete (auto-prune)* — a send that gets `404`/`410` from the push service removes the row
  (dead device), batched after fan-out. Never blocks or fails the originating action.

**Access**: written only via the `push.*` API actions (authenticated, allowlisted) and pruned by
the send path. Read by the send fan-out to target a recipient's devices.

---

## Settings tab — deltas

### Added (Sheet-only unless noted)

| Key | Default | Editable via 020 editor? | Purpose |
|-----|---------|--------------------------|---------|
| `pushEnabled` | `TRUE` | **Yes** (replaces `ntfyEnabled` in `EDITABLE_SETTINGS`) | Household master switch. `FALSE` sends no web pushes. |
| `vapidPublicKey` | `` (filled by `setupPush()`) | No | base64url raw P-256 public point; served to the frontend via `push.getConfig`. |
| `vapidPrivateKey` | `` (filled by `setupPush()`) | No | base64url P-256 private scalar. Secret; Sheet is the trust boundary (R2). |
| `vapidSubject` | `mailto:household@example.com` | No | VAPID `sub` claim / contact. |

### Retired (feature 009)

| Key | Disposition |
|-----|-------------|
| `ntfyEnabled` | Removed from `DEFAULT_SETTINGS`, `EDITABLE_SETTINGS`, and the `settings.update` switch. Superseded by `pushEnabled`. |
| `ntfyTopicMax` / `ntfyTopicJaz` | Removed from `DEFAULT_SETTINGS`. No longer read. |

Existing ntfy rows in an already-provisioned Sheet are harmless once unread; they can be deleted
by hand. `setupDatabase()` re-run will not recreate them.

---

## ActivityLog — action vocabulary

Consistent with Principle VI and the retired ntfy logging.

| Action | When | Detail example |
|--------|------|----------------|
| `push-subscribe` | Device enabled/refreshed | `subscribed Jaz device: iPhone Safari` |
| `push-unsubscribe` | Device disabled | `unsubscribed Jaz device: iPhone Safari` |
| `push-notify` | Per send attempt (replaces `ntfy-ping`) | `pushed Max (2 devices): "Take out recycling"` / `push skipped (disabled)` / `push skipped (no devices)` / `pruned dead device` / `push failed (HTTP 400)` |

Actor for send/prune events is `system` (as ntfy used); actor for subscribe/unsubscribe is the
signed-in person.

---

## In-memory / transport entities (not stored)

- **Push message** — `{ title, body, url, tag }` JSON, AES-128-GCM-encrypted into the request
  body per RFC 8291. `url` = `${BASE_URL}?task=<id>`; `tag` = task id (coalesces repeats).
- **VAPID keypair** — P-256; public also encoded into the `Authorization: vapid k=…` header per
  request; ephemeral per-message ECDH keypair generated fresh inside `encryptPayload_`.

---

## Relationships

```
Person (max|jaz) ──1:N──> PushSubscription (by `person`)
Task ──(event: complete|acknowledge)──> recipient = otherPerson_(actor/owner)
     └─> fan-out to recipient's PushSubscription rows ─> encrypted Web Push
Settings ── vapid* + pushEnabled ── gate & sign/encrypt every send
```
