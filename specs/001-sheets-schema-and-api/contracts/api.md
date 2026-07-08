# API Contract: Household HQ Backend (001)

The single web-app endpoint for all features. Transport and envelope are fixed
project-wide by this document (research D1/D2; FR-015/FR-012). Field-level schemas live
in [data-model.md](../data-model.md); this contract does not duplicate them.

## Transport

- **All operations**: `POST <webAppUrl>` with `Content-Type: text/plain;charset=utf-8`
  and a JSON body. No custom headers, ever (they trigger CORS preflight, which Apps
  Script cannot answer). Clients must follow redirects (Apps Script 302s to
  `script.googleusercontent.com`).
- **`GET <webAppUrl>`**: health ping only → `{ "ok": true, "data": { "service": "household-hq", "version": "<API_VERSION>" } }`.
- HTTP status is **always 200**; `ok` in the body is the only success discriminator.

## Request envelope

```json
{
  "token": "",
  "action": "<namespace.verb>",
  "payload": { }
}
```

- `token` — Google ID token of the caller. **Reserved in 001**: recorded as declared
  actor identity, not verified. Feature 002 adds verification + allowlist rejection
  without changing this shape. May be `""` until then.
- `action` — required; one of the closed set below.
- `payload` — action-specific; optional for list actions.

## Response envelope

```json
{ "ok": true,  "data": … }
{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "…", "field": "dueDate" } }
```

`field` appears only on `VALIDATION_FAILED`.

### Error codes (closed set for 001)

| Code | Meaning |
|---|---|
| `UNKNOWN_ACTION` | `action` not in the table below |
| `BAD_REQUEST` | body unparseable, or envelope/payload structurally missing pieces |
| `VALIDATION_FAILED` | a field value fails data-model rules; names the field |
| `NOT_FOUND` | update/delete referenced an id that isn't in the tab |
| `BUSY` | write lock not acquired within 30s; safe to retry |
| `SCHEMA_MISMATCH` | a required header is missing/renamed in the Sheet; message names tab + header |
| `INTERNAL` | anything unexpected; message is safe/generic, details in Apps Script logs |

## Actions

| Action | Payload | Data returned |
|---|---|---|
| `ping` | — | `{ service, version }` |
| `events.list` | — | `{ events: [Event…] }` (all rows; no pagination) |
| `events.create` | Event fields; `id` optional (client-suppliable, FR-017) | `{ event }` as stored |
| `events.update` | `id` + any mutable Event fields | `{ event }` after update |
| `events.delete` | `{ id }` | `{ id }` (hard delete; row removed) |
| `tasks.list` | — | `{ tasks: [Task…] }` |
| `tasks.create` | Task fields; `id` optional; `status` defaults `open` | `{ task }` |
| `tasks.update` | `id` + any mutable Task fields (incl. status transitions) | `{ task }` |
| `tasks.delete` | `{ id }` | `{ id }` |
| `templates.list` | — | `{ templates: [TaskTemplate…] }` |
| `recurring.list` | — | `{ recurring: [RecurringRule…] }` |
| `settings.list` | — | `{ settings: { key: value, … } }` |

Records travel as flat JSON objects whose keys equal the tab's header names; empty
cells are `""`.

## Semantics

- **Idempotent create (FR-017)**: if `payload.id` already exists in the tab, return the
  existing record with `ok: true` — replay is success, not conflict.
- **Update**: partial — only supplied fields change; unknown fields → `BAD_REQUEST`;
  validation failures reject the whole write (FR-014). Setting `status: "done"` stamps
  `completedBy` (actor) + `completedAt`; back to `"open"` clears both.
- **Delete**: hard; ActivityLog `detail` preserves the record's title (FR-011).
- **Every mutation** appends exactly one ActivityLog row; failures append none
  (FR-019).
- **Blank-ID adoption (FR-022)**: any action touching a tab first adopts hand-added
  blank-ID rows (assign UUID + `adopt-id` log row, actor `system`).
- **Reads** are lock-free; rows with invalid cells are returned with a
  `_warnings: ["…"]` extra key rather than dropped, so listings degrade gracefully
  (FR-020) while flagging problems.
- **Mutations** run under the script lock (research D4).

## Versioning

`API_VERSION` (from `Config.js`) is returned by `ping`. Additive changes (new actions,
new optional fields) don't bump shape; the envelope itself changes only by
constitutional amendment-level decision, since every future feature builds on it.
