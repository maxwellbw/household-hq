# Contract — Frontend ↔ Backend API Client (006)

The frontend consumes the **existing** Apps Script web app (features 001–005) with **no new
backend behavior**. This is the client-side view of that contract; the authoritative server
contract lives in `backend/` (`Api.js`, `Auth.js`, `Config.js`) and the 001–005 specs.

## Transport

- **URL**: single web-app deployment URL → `VITE_API_BASE_URL`.
- **Method**: `POST` for every action.
- **Content-Type**: `text/plain;charset=utf-8` (avoids the CORS preflight Apps Script won't answer — feature-001 decision / CLAUDE.md gotcha). Body is JSON despite the text mime type.
- **HTTP status**: always `200`. Success is determined **only** by the `ok` field, never status.
- **Request body**:
  ```json
  { "action": "<name>", "token": "<google-id-token>", "payload": { ... } }
  ```
  `token` is required on every action except `ping`. For shared-account **writes**, include `payload.actingPerson: "max" | "jaz"`.
- **Response**:
  ```json
  { "ok": true,  "data": { ... } }
  { "ok": false, "error": { "code": "STRING", "message": "STRING", "field": "optional" } }
  ```

Client (`lib/api.ts`) throws `ApiError(code, message, field?)` on `ok:false` or network/parse failure.

## Actions used by this feature

### Reads (require token; no `actingPerson`)

| Action | Payload | Response `data` | Used for |
|---|---|---|---|
| `auth.whoami` | — | `{ identity, displayName, email, needsActingPerson }` | Identify signed-in person (US3) |
| `settings.list` | — | `{ settings: { timezone, ... } }` | Household timezone (FR-017) |
| `events.list` | — | `{ events: Event[] }` | Calendar events (US1) |
| `tasks.list` | `{ filter? }` | `{ tasks: Task[] }` | Tasks incl. `eventId` tether (US2). Default/household slice; `filter` optional. |

> Owner filtering (FR-015) is applied **client-side** with independent chips, over the full task/event set — not via the backend `tasks.list` filter (which is a different, server-perspective slice). `events.list` returns all events; the client filters by owner.

### Writes (require token; shared account also requires `actingPerson`)

| Action | Payload (minimum) | Response `data` | Used for |
|---|---|---|---|
| `tasks.complete` | `{ id }` | `{ task, ... }` | Check off a task (US6, FR-019) |
| `tasks.reopen` | `{ id }` | `{ task, ... }` | Reopen a completed task (US6) |
| `events.create` | `{ title, start, end, owner }` | `{ event }` | Quick-add event (US5) |
| `recurring.create` | `{ title, cadence, anchorDate, defaultOwner }` | `{ recurring }` | Quick-add recurring chore (US5) |
| `tasks.create` | `{ title, owner }` (+ `dueDate`) | `{ task }` | Quick-add one-time task (US5) |

Required-field sets mirror `REQUIRED_ON_CREATE` in `backend/Config.js`. Every write appends to
ActivityLog server-side (constitution VI) — the client adds no logging and no silent mutation.

## Error codes → client behavior

| Code | Meaning | Client behavior |
|---|---|---|
| `UNAUTHENTICATED` | Missing/empty token | Return to sign-in gate |
| `INVALID_CREDENTIAL` | Token bad/expired/aud mismatch | Return to sign-in gate; prompt re-auth |
| `FORBIDDEN` | Email not on allowlist | Refusal screen (calm, plain); show no data |
| `ALLOWLIST_MISCONFIGURED` | Allowlist empty (fail-closed) | Refusal/error screen with plain message |
| `ACTING_PERSON_REQUIRED` | Shared-account write without actingPerson | Prompt "Max or Jaz?", then retry with `actingPerson` |
| `VALIDATION` | Bad field on create | Inline field error in quick-add; keep user input |
| `SCHEMA_MISMATCH` | Sheet headers off | Plain global error + retry (rare; ops issue) |
| `BUSY` | Lock contention | Auto-retry once, then plain "try again" |
| `BAD_REQUEST` / `UNKNOWN_ACTION` / `INTERNAL` | Client/back error | Plain error toast + retry affordance |

## Auth token lifecycle (R3)

1. GIS sign-in → ID token (`aud` = `VITE_GOOGLE_CLIENT_ID`, the committed `OAUTH_CLIENT_ID`).
2. `auth.whoami` establishes identity; `needsActingPerson` ⇒ prompt Max/Jaz before writes.
3. Token held in memory; on `UNAUTHENTICATED`/`INVALID_CREDENTIAL` from any call → back to gate.

## Non-goals (out of scope for 006)

- No `*.update` / `*.delete` calls (edit/delete of existing items deferred).
- No new endpoints, no changes to request/response shapes, no `appsscript.json` scope changes.
- No `activity.list` consumption (Feed tab is a later feature; tab is a stub here).
