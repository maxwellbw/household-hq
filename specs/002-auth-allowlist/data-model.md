# Data Model: Auth Allowlist (002)

002 adds **no tabs and no columns**. It changes three Settings *rows*, adds one committed
constant, and defines in-memory shapes (verified identity, whoami). Field-level tab
schemas remain as [001 data-model.md](../001-sheets-schema-and-api/data-model.md).

## Settings rows (the allowlist + identity map)

`Settings` tab keys read by auth. Plain text, hand-editable (Principle II). The single
001 seed `allowedEmails` is **replaced** by three self-describing keys:

| key | example value | meaning | maps to identity |
|---|---|---|---|
| `maxEmail` | `maxwellbwright@gmail.com` | Max's personal Google account | `max` |
| `jazEmail` | `jazmine.prosch@gmail.com` | Jaz's personal Google account | `jaz` |
| `sharedEmails` | `maxandjazmine@gmail.com` | shared household account(s), `"; "`-delimited | *shared* (needs actingPerson on write) |

- **Allowlist** = the set union of `maxEmail`, `jazEmail`, and each entry in `sharedEmails`,
  each trimmed and lower-cased. Empty values contribute nothing.
- **Resolution** of a verified email: equals `maxEmail` → `max`; equals `jazEmail` → `jaz`;
  in `sharedEmails` → shared; otherwise **not on allowlist** → `FORBIDDEN`.
- **Fail closed (FR-005 / SC-006)**: if all three are empty, or the Settings tab can't be
  read, every authenticated caller is rejected with `ALLOWLIST_MISCONFIGURED` (never
  treated as authorized). `ping` still answers.
- Matching is exact + case-insensitive; whitespace trimmed. A stray/typo'd entry only adds
  an exact match — it can never widen access to non-listed emails.

Updated `SETTINGS_SEED` entries (`Config.js`), create-if-missing so hand-filled values are
never overwritten:

```
['maxEmail',     '', 'feature 002; Google email that maps to identity "max"']
['jazEmail',     '', 'feature 002; Google email that maps to identity "jaz"']
['sharedEmails', '', 'feature 002; "; "-delimited shared accounts (auth ok; writes need actingPerson)']
```

The obsolete `allowedEmails` row is no longer read; the operator may delete it by hand.

## Committed constant (Config.js)

```
OAUTH_CLIENT_ID = '<the app's Google Web OAuth client ID>.apps.googleusercontent.com'
```

Public value (client IDs are not secrets), committed like `SPREADSHEET_ID`. Created once
in the Cloud Console (quickstart §1); reused by feature 006's GIS front end. A token's
`aud` must equal this exactly.

## Verified identity (in-memory, per request)

Produced by `Auth.js` from the tokeninfo claims; not persisted.

| field | type | notes |
|---|---|---|
| `actor` | `"max" \| "jaz"` | canonical person written to ActivityLog / `completedBy`. For a shared caller this is the resolved `actingPerson`; `null` until resolved on a write. |
| `identity` | `"max" \| "jaz" \| "shared"` | which allowlist bucket matched |
| `email` | string | verified, lower-cased |
| `displayName` | string | from the `name` claim; `""` if absent |

**Attribution rule (FR-007)**: personal caller → `actor = identity`, any client-declared
actor ignored. Shared caller performing a write → `actor = payload.actingPerson` (must be
`max`/`jaz`), else `ACTING_PERSON_REQUIRED`. The shared account is never itself an `actor`
or an `owner` value. `system` remains reserved for internal writes (unchanged, FR-008).

## `auth.whoami` response shape (FR-009)

```json
{ "identity": "max" | "jaz" | "shared",
  "displayName": "Max",
  "email": "maxwellbwright@gmail.com",
  "needsActingPerson": false }
```

`needsActingPerson` is `true` only for the shared account. No profile is stored — values
come straight from the current token's claims.

## `actingPerson` field (request, FR-014)

Carried inside `payload` (envelope frozen, FR-006): `payload.actingPerson` ∈
`{"max","jaz"}`. The dispatcher pops it before entity validation. Ignored for personal
callers; required for shared-account **write** actions (create/update/delete). Absent or
invalid on such a write ⇒ `ACTING_PERSON_REQUIRED`.

## Error codes added (contract delta — see contracts/auth.md)

`UNAUTHENTICATED`, `INVALID_CREDENTIAL`, `FORBIDDEN`, `ALLOWLIST_MISCONFIGURED`,
`ACTING_PERSON_REQUIRED` — additive to 001's closed set; envelope shape unchanged.
