# API Contract — Feature 019

Transport unchanged (feature 001): every operation is a `text/plain` POST to the web app
carrying `{ action, token, payload }`; HTTP is always 200; `ok` discriminates success.
Only the deltas for this feature are documented here.

## New action: `tasks.acknowledge`

The assignee commits to a task assigned to them ("I've got it").

**Request**

```json
{ "action": "tasks.acknowledge", "token": "<id-token>", "payload": { "id": "<taskId>" } }
```

Shared-account callers must also include `actingPerson` (`max`|`jaz`) in `payload`, per the
002 write-disambiguation rule (`isWriteAction_` now matches `.acknowledge`).

**Response** (mirrors `tasks.snooze`/`tasks.complete`)

```json
{ "ok": true, "data": { "task": { ...full task... }, "changed": true } }
```

- `changed: true` on a real transition (ackBy/ackAt just set); `changed: false` on an
  idempotent replay (already acknowledged by this owner) — no new log row, no ntfy ping.
- The returned `task` reflects the stored `ackBy`/`ackAt`.

**Semantics**

- Validates `id` present, task exists.
- Authorization: the verified `actor` MUST equal the task's `owner`, and `owner` MUST be a
  single person (`max`|`jaz`). Otherwise `VALIDATION_FAILED` (see codes). This enforces
  "only the assignee may commit" and "no ack on `both`/self" server-side.
- On a real transition: set `ackBy = actor`, `ackAt = nowIso_()`, write the row under
  `LockService`, append one `acknowledge` ActivityLog row, then best-effort
  `pingAcknowledge_(task)` to `otherPerson_(owner)` (never throws).

**Error codes**

| Code | When |
|---|---|
| `VALIDATION_FAILED` | `id` missing; or `owner === 'both'`; or `actor !== owner` (not the assignee); field named where applicable. |
| `NOT_FOUND` | No task with that `id`. |
| `ACTING_PERSON_REQUIRED` | Shared account without a confirmed `actingPerson` on this write. |
| `BUSY` | Lock contention (retry-safe — acknowledgement is idempotent). |

## Amended: `tasks.create` / `tasks.update`

- **`notes`** is now an accepted, editable field on both (free text, optional). It flows
  through `fullRecord_` (create) and `mutablePatch_` (update) automatically once it is a
  `HEADERS.Tasks` name.
- **`ackBy` / `ackAt`** are server-managed: supplying either on `tasks.create` or
  `tasks.update` returns `BAD_REQUEST` (added to the existing `status`/`completedBy`/
  `completedAt` rejection guard). They change only via `tasks.acknowledge` (set) and
  reassignment (cleared).
- **Reassignment reset**: when `tasks.update` changes `owner` to a different value, the
  server also clears `ackBy`/`ackAt` in the same write (one `update` log row).

## Amended: `events.create` / `events.update`

- **`notes`** (already a header, previously never sent by the UI) and **`location`** (new
  header) are accepted, editable free-text fields on both. Both flow through the existing
  create/update paths; no new validation type.
- On create/update the event is mirrored to the Household calendar as today, now also
  calling `setLocation(location || '')` so the calendar entry's location matches (including
  clearing when emptied). Best-effort, like all calendar mirroring.

## Unchanged

`tasks.list` already returns every task field, so `notes`/`ackBy`/`ackAt` appear in its
response with no shape change. `events.list` likewise returns `notes`/`location`. No new
list/read action is required — the "not yet committed" state and the assigner notice are
derived client-side from these fields.
