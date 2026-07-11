# Data Model: Stay Signed In (Session Persistence)

No Google Sheet tabs or columns change. This feature only adds **client-side** state. There
is no server-side session store (Constitution III).

## Persisted (localStorage) — the only durable additions

Namespace: `hq.` string keys, human-legible, defensively read.

| Key | Type | Meaning | Written | Cleared |
|-----|------|---------|---------|---------|
| `hq.autoSignIn` | `'1'` \| absent | Hint that a prior sign-in succeeded, so boot should attempt silent restore and show the calm restoring state instead of the sign-in wall. | On successful `signed-in`. | On sign-out; on unrecoverable silent-auth failure. |
| `hq.actingPerson` | `'max'` \| `'jaz'` \| absent | Remembered acting person for the shared account, restored on return and reflected in the affirmation banner. | When acting person is set/confirmed. | On sign-out. |

**Explicitly NOT persisted**: the ID token / any credential (FR-009). It is acquired fresh
each session and held in memory only.

**Read rules**: any unexpected/corrupt value → treat as absent → fall back to the sign-in
wall (spec edge case: corrupted persisted session data). `hq.actingPerson` is advisory only:
a fresh token that server-resolves to a concrete person (`identity` ≠ `shared`) overrides it,
and an invalid remembered value causes re-resolution via the existing `ActingPersonPrompt`.

## In-memory session (existing `Session`, unchanged shape)

From `frontend/src/types/domain.ts`:

```ts
interface Session {
  token: string                        // fresh ID token, memory only, refreshed reactively
  who: WhoAmI                          // { identity, displayName, email, needsActingPerson }
  actingPerson?: 'max' | 'jaz'         // now seeded from hq.actingPerson on restore
}
```

The type does not change. What changes is its **lifecycle**: it can now be rebuilt on boot
from a silently-acquired token, its `token` can be refreshed in place on expiry, and its
`actingPerson` can be seeded from `localStorage`.

## Auth state machine (extends existing `AuthStatus`)

Current: `'signed-out' | 'authenticating' | 'signed-in' | 'forbidden' | 'error'`.

Add: **`'restoring'`** — boot-time silent re-auth in progress; renders the calm restoring
gate (FR-005), never household data.

Transitions (new/changed in **bold**):

| From | Event | To |
|------|-------|-----|
| _(boot)_ | `hq.autoSignIn` set | **`restoring`** |
| _(boot)_ | no hint | `signed-out` |
| **`restoring`** | silent token acquired + whoami ok | `signed-in` (seed acting person) |
| **`restoring`** | silent auth declined / whoami fails non-auth | `signed-out` |
| **`restoring`** | whoami `FORBIDDEN`/`ALLOWLIST_MISCONFIGURED` | `forbidden` |
| `signed-in` | authed call → `UNAUTHENTICATED`/`INVALID_CREDENTIAL` | silent refresh (single-flight); on success stay `signed-in` with new token + retry; on failure → `signed-out` |
| `signed-in` | user Sign Out | `signed-out` + clear `hq.*` + `disableAutoSelect()` |

## Acting-person presentation (derived, not stored beyond the table above)

| Condition | UI |
|-----------|-----|
| `who.identity` is `max`/`jaz` (personal account) | No prompt/affirm; person is server-derived. |
| `who.needsActingPerson` and `hq.actingPerson` absent/invalid | Blocking `ActingPersonPrompt` (unchanged first-time flow). |
| `who.needsActingPerson` and `hq.actingPerson` valid | Restore silently + dismissible `ActingPersonAffirm` ("Signed in as X — switch?"). |
