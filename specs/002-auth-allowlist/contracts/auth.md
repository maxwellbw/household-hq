# API Contract Delta: Auth (002)

Extends [001 contracts/api.md](../../001-sheets-schema-and-api/contracts/api.md). The
transport and `{token, action, payload}` / `{ok, data|error}` envelopes are **unchanged**
(FR-006). 002 only: enforces `token`, adds one action, five error codes, and one optional
`payload` field.

## Enforcement (applies to every action except `ping`)

Before dispatch, `doPost` authenticates:

1. `token` empty/missing → `UNAUTHENTICATED`.
2. Verify via Google `tokeninfo` (research A1). Non-200, or `aud != OAUTH_CLIENT_ID`, or
   `iss` not Google, or `email_verified != true`, or expired → `INVALID_CREDENTIAL`.
3. Resolve the verified email against the Settings allowlist (data-model §Settings):
   - all keys empty / Settings unreadable → `ALLOWLIST_MISCONFIGURED`
   - not matched → `FORBIDDEN`
   - matched → `max` / `jaz` / shared.
4. For a **write** action (`*.create` / `*.update` / `*.delete`) by a **shared** caller:
   `payload.actingPerson` must be `max`/`jaz`, else `ACTING_PERSON_REQUIRED`.
5. Pop `payload.actingPerson`; dispatch the handler with the resolved `actor`.

`ping` (GET or `action:"ping"`) skips all of the above — it exposes only service + version.

### Added error codes (additive to 001's closed set)

| Code | Meaning | Distinguishes so the client can… |
|---|---|---|
| `UNAUTHENTICATED` | no/empty credential | prompt sign-in |
| `INVALID_CREDENTIAL` | credential fails verification (bad `aud`/`iss`, unverified email, expired, tampered) | **silently refresh + retry** |
| `FORBIDDEN` | valid credential, email not on allowlist | show private-app message, **no retry** |
| `ALLOWLIST_MISCONFIGURED` | allowlist empty/unreadable (fail closed) | tell maintainer to fix Settings |
| `ACTING_PERSON_REQUIRED` | shared-account write with no valid `actingPerson` | prompt "Max or Jaz?", retry with it |

Messages carry **no** household data, allowlist contents, or per-email reason (FR-013,
SC-004). Rejections are logged server-side only (`console.warn`, research A9).

## New action

| Action | Payload | Data returned |
|---|---|---|
| `auth.whoami` | — | `{ identity: "max"\|"jaz"\|"shared", displayName, email, needsActingPerson }` |

Requires a valid allowlisted token; never requires `actingPerson` (data-model §whoami).

## New optional request field

`payload.actingPerson` — `"max"` \| `"jaz"`. Only meaningful for shared-account writes;
popped by the dispatcher before entity validation, so it is never an "unknown field".
Ignored for personal callers.

## Attribution change (affects all 001 write actions)

`actor` on every ActivityLog row and on `completedBy` now derives from the **verified
identity** (FR-007), replacing 001's declared-string behavior. Client-declared actor
values are ignored. No 001 action's request/response *shape* changes — only the source of
`actor` and the fact that an empty `token` now fails.

## Credential lifecycle contract (for feature 006 — defined here, built there)

- **Acquire**: Google Identity Services on the frontend, configured with `OAUTH_CLIENT_ID`,
  produces a short-lived (~1 h) ID token sent as `token` on every request.
- **Refresh (FR-010)**: on `INVALID_CREDENTIAL`, silently obtain a fresh token and retry
  once before showing anything — steady-state use prompts zero times (SC-003).
- **Reject UX (FR-011)**: `FORBIDDEN` → static "this is a private household app" screen (no
  data, no hints, no retry). `ACTING_PERSON_REQUIRED` → "Max or Jaz?" chooser, then retry
  with `actingPerson`.
