# Contract — `data.bootstrap` action (030)

One **new** backend action plus client-side transport hardening. The authoritative server contract lives in `backend/Api.js`; this is the feature's slice.

## Transport (unchanged from feature 001)

- **URL**: single web-app deployment URL → `VITE_API_BASE_URL`.
- **Method**: `POST`. **Content-Type**: `text/plain;charset=utf-8` (JSON body; avoids the CORS preflight Apps Script won't answer).
- **HTTP status**: always `200`. Success is the `ok` field only.
- **Request body**: `{ "action": "data.bootstrap", "token": "<google-id-token>", "payload": {} }`
- **Response**: `{ "ok": true, "data": { … } }` or `{ "ok": false, "error": { code, message, field? } }`.
- Client (`lib/api.ts`) throws `ApiError(code, message, field?)` on `ok:false`, network failure, **timeout/abort**, or parse failure.

## New read action

### `data.bootstrap`

- **Requires**: `token` (same identity + two-email allowlist gate as every other action). No `actingPerson` (read-only).
- **Payload**: none (`{}`).
- **Response `data`** — the aggregate of the nine core collections, each key **field-identical** to its standalone `*.list` response:

  ```json
  {
    "events":          [ /* Event[]            — == events.list.events */ ],
    "tasks":           [ /* Task[]             — == tasks.list.tasks (same actor scoping) */ ],
    "recurring":       [ /* RecurringRule[]    — == recurring.list.recurring */ ],
    "recurringEvents": [ /* RecurringEventRule[] — == recurringEvents.list.recurringEvents */ ],
    "lists":           [ /* List[]             — == lists.list.lists */ ],
    "listItems":       [ /* ListItem[]         — == listItems.list.items (ALL lists) */ ],
    "templates":       [ /* TaskTemplate[]     — == templates.list.templates */ ],
    "settings":        { /* Settings map       — == settings.list.settings */ },
    "dogWalks":        [ /* DogWalk[]          — == dogwalks.list.dogWalks */ ]
  }
  ```

- **Excluded**: `activity` (loaded lazily via `activity.list` when the More tab opens).
- **Guarantees**:
  - *Shape parity*: each key equals the corresponding `*.list` result for the same actor/instant (asserted by `SelfTest.js`).
  - *Gating parity*: identical allowlist gate; `tasks` scoped exactly as `tasks.list`.
  - *Read-only*: writes nothing; appends no ActivityLog row.
  - *Read-once*: calls each list helper once; no per-cell/per-record loops.
- **Errors**: same envelope as all actions — `UNAUTHENTICATED` (missing/expired token), `FORBIDDEN` (not on allowlist), `INTERNAL` (unexpected). Unknown-action is not applicable (this becomes a known action).

## Actions still used (unchanged, still callable)

Every `*.list` action remains for targeted refetch/invalidate after a write: `events.list`, `tasks.list`, `recurring.list`, `recurringEvents.list`, `lists.list`, `listItems.list`, `templates.list`, `settings.list`, `dogwalks.list`, `activity.list`. Bootstrap is additive — it replaces only the initial fan-out.

## Client-side transport hardening (no server contract change)

These are `lib/api.ts` + QueryClient behaviors, not new server semantics:

| Concern | Behavior |
|---|---|
| **Timeout** | Every `apiCall` aborts after a bounded wait (~15 s) via `AbortController` and throws a retryable `NETWORK_ERROR`/`TIMEOUT` `ApiError` (FR-011). |
| **Read retry** | QueryClient retries reads only on transient codes (`NETWORK_ERROR`/`TIMEOUT`/`BAD_RESPONSE`), bounded count + backoff; never on `VALIDATION_FAILED`/`FORBIDDEN`/`UNAUTHENTICATED`/`UNKNOWN_ACTION` (FR-012/014). |
| **Write retry** | None (TanStack default `retry: 0`). Write recovery = optimistic revert + error toast, leaning on backend idempotence (FR-013). |
| **Boot restore** | Transient whoami/bootstrap failure → auto-retry (bounded, backoff) → recoverable "Retry" screen; session preserved. Genuine `FORBIDDEN`/expired → their existing terminal states (FR-007/009). |
| **Chunk load** | A failed lazy chunk surfaces a retryable, area-scoped error, not an app crash (FR-020). |

## Error code taxonomy (transient vs. genuine)

| Code | Class | Retried / recovered? |
|---|---|---|
| `NETWORK_ERROR`, `TIMEOUT`, `BAD_RESPONSE` | Transient | Reads auto-retry; boot auto-retries then offers manual Retry |
| `UNAUTHENTICATED` (expired/invalid) | Genuine auth | No retry; routes to sign-in wall |
| `FORBIDDEN` | Genuine auth | No retry; routes to forbidden gate |
| `VALIDATION_FAILED`, `UNKNOWN_ACTION`, `INTERNAL` | Genuine | Surfaced immediately; no retry budget consumed |
