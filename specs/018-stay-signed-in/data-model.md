# Data Model: Stay Signed In (Session Persistence)

> **Revised 2026-07-12** (research R7): the `hq.autoSignIn` hint + silent-GIS model below is
> superseded by a backend-minted **household session token**. Tables updated in place.

No Google Sheet tabs or columns change. There is still no server-side session *store*
(Constitution III) — the session token is stateless (HMAC-signed, self-describing); the only
server-side addition is a `SESSION_SECRET` script property.

## Persisted (localStorage) — the only durable additions

Namespace: `hq.` string keys, human-legible, defensively read.

| Key | Type | Meaning | Written | Cleared |
|-----|------|---------|---------|---------|
| `hq.sessionToken` | `hqs1.<payload>.<hmac>` \| absent | Backend-minted household session token (30-day sliding expiry). Boot presents it to `auth.whoami`; the renewed token from the response replaces it. | On every successful `signed-in` (fresh mint from whoami). | On sign-out; when the backend rejects it (expired/tampered/forbidden). Kept on transient network failures. |
| `hq.actingPerson` | `'max'` \| `'jaz'` \| absent | Remembered acting person for the shared account, restored on return and reflected in the affirmation banner. | When acting person is set/confirmed. | On sign-out only — it survives token expiry so a re-sign-in doesn't re-ask "Max or Jaz?". |

(`hq.autoSignIn` is legacy — no longer written, removed by `clear()` on sign-out.)

**Explicitly NOT persisted**: any **Google** credential (FR-009 as revised). The Google ID
token appears only during the first interactive sign-in and is held in memory just long
enough to exchange it for a session token via `auth.whoami`.

**Read rules**: any unexpected/corrupt value → treat as absent → fall back to the sign-in
wall (spec edge case: corrupted persisted session data). `hq.actingPerson` is advisory only:
a fresh token that server-resolves to a concrete person (`identity` ≠ `shared`) overrides it,
and an invalid remembered value causes re-resolution via the existing `ActingPersonPrompt`.

## In-memory session (existing `Session`, unchanged shape)

From `frontend/src/types/domain.ts`:

```ts
interface Session {
  token: string                        // household session token (hqs1.*), also persisted
  who: WhoAmI                          // { identity, displayName, email, needsActingPerson, sessionToken }
  actingPerson?: 'max' | 'jaz'         // seeded from hq.actingPerson on restore
}
```

`WhoAmI` gains a required `sessionToken` — the freshly minted token returned by every
`auth.whoami` call, which becomes both the in-memory and persisted credential.

## Auth state machine (extends existing `AuthStatus`)

Current: `'signed-out' | 'authenticating' | 'signed-in' | 'forbidden' | 'error'`.

Add: **`'restoring'`** — boot-time silent re-auth in progress; renders the calm restoring
gate (FR-005), never household data.

Transitions (new/changed in **bold**):

| From | Event | To |
|------|-------|-----|
| _(boot)_ | `hq.sessionToken` present | **`restoring`** (one whoami round-trip) |
| _(boot)_ | no stored token | `signed-out` |
| **`restoring`** | whoami ok | `signed-in` (persist renewed token; seed acting person) |
| **`restoring`** | whoami `UNAUTHENTICATED`/`INVALID_CREDENTIAL` | `signed-out` (clear stored token) |
| **`restoring`** | whoami `FORBIDDEN`/`ALLOWLIST_MISCONFIGURED` | `forbidden` (clear stored token) |
| **`restoring`** | transient failure (offline etc.) | `signed-out` (stored token kept for next launch) |
| `signed-in` | authed call → `UNAUTHENTICATED`/`INVALID_CREDENTIAL` | `signed-out` (clear stored token; no silent Google refresh — see R7) |
| `signed-in` | user Sign Out | `signed-out` + clear `hq.*` + `disableAutoSelect()` |

## Acting-person presentation (derived, not stored beyond the table above)

| Condition | UI |
|-----------|-----|
| `who.identity` is `max`/`jaz` (personal account) | No prompt/affirm; person is server-derived. |
| `who.needsActingPerson` and `hq.actingPerson` absent/invalid | Blocking `ActingPersonPrompt` (unchanged first-time flow). |
| `who.needsActingPerson` and `hq.actingPerson` valid | Restore silently + dismissible `ActingPersonAffirm` ("Signed in as X — switch?"). |
