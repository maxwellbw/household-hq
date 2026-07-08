# Research: Auth Allowlist (002)

Phase 0 decisions. Each: **Decision → Rationale → Alternatives rejected.** These resolve
the Technical Context unknowns and 001's risk **R1**.

## A1. ID-token verification method

**Decision**: Verify every ID token by GET-ing Google's token-info endpoint over
`UrlFetchApp`:
`https://oauth2.googleapis.com/tokeninfo?id_token=<token>` (`muteHttpExceptions: true`).
A 200 returns the decoded claims (`aud`, `email`, `email_verified`, `iss`, `exp`, `name`,
`sub`); any non-200 (or unparseable body) is an invalid credential.

**Rationale**: Google performs the RS256 signature check, expiry, and clock-skew
tolerance server-side — exactly the hard parts. The code stays dependency-free and boring
(Principle IV): one HTTP call, one JSON parse, then plain field checks. At tens of
requests/day the extra ~100–300 ms round trip is invisible against the 5 s budget (SC-005).

**Alternatives rejected**:
- *Local JWKS/RS256 verification* (fetch `oauth2/v3/certs`, verify the signature in
  script): Apps Script has no built-in RSA-verify; hand-rolling modular exponentiation is
  the opposite of boring and a security foot-gun. Rejected.
- *Trusting the token unverified / decoding without validation*: fails FR-002 outright.

## A2. Audience & issuer binding

**Decision**: After a successful `tokeninfo`, require all of: `aud === OAUTH_CLIENT_ID`;
`email_verified === true` (string `"true"` or boolean); `iss` ∈
{`accounts.google.com`, `https://accounts.google.com`}. Any mismatch ⇒ `INVALID_CREDENTIAL`.
`OAUTH_CLIENT_ID` is the app's Google **Web** OAuth client ID, stored as a committed
constant in `Config.js` (public value, not a secret — same posture as `SPREADSHEET_ID`,
D8). The client ID is created once in the Google Cloud Console (a browser step; see
quickstart) and is the same ID feature 006's GIS front end will use to mint tokens.

**Rationale**: Without the `aud` check, *any* valid Google ID token for *any* app would
pass — the audience binding is what ties a token to *our* app. `email_verified` blocks
spoofed unverified addresses. Boring, standard OIDC relying-party checks.

**Alternatives rejected**: Skipping `aud` (insecure); putting the client ID in Settings
(it's fixed deploy config, not operator-tuned data — Config.js is its home).

## A3. Web-app deployment mode — resolves R1 (FR-012)

**Decision**: Keep the manifest 001 already shipped: `executeAs: USER_DEPLOYING`,
`access: ANYONE_ANONYMOUS` — i.e. **Execute as: me (the deploying shared account)** /
**Who has access: Anyone**. All real gating is the ID-token + allowlist checks. Correct
the two docs that currently say otherwise:
- `CLAUDE.md` — "Execute as: user accessing the app, Anyone with a Google account" → the
  above; and "two-email allowlist" → three-account (two personal + shared).
- `initial-setup.md` — the deploy-dialog line, and the "You and Jaz each authorize"
  step (only the **deployer** authorizes under execute-as-me).

**Rationale**: R1 (001 research) found that *execute-as-user / Anyone-with-Google-account*
makes a cross-origin `fetch` from GitHub Pages receive a login-redirect HTML page instead
of JSON (no session cookie cross-site; credentialed CORS is incompatible with Apps
Script's wildcard `Access-Control-Allow-Origin`). *Execute-as-me / Anyone (anonymous)*
returns JSON directly and is the established SPA-to-Apps-Script pattern; security moves
entirely to the ID token in the body — which is precisely what this feature enforces.
The manifest was already correct; only the prose lagged.

**Alternatives rejected**: *Execute as user accessing* (breaks the browser client — the
whole point of R1); *Anyone-with-Google-account access* (adds Google's interstitial and
still doesn't carry a usable cross-site session).

## A4. Allowlist & identity storage (FR-003, FR-005, FR-007)

**Decision**: Three hand-editable Settings rows replace the single `allowedEmails` seed:

| key | value | maps to |
|---|---|---|
| `maxEmail` | `maxwellbwright@gmail.com` | `max` |
| `jazEmail` | `jazmine.prosch@gmail.com` | `jaz` |
| `sharedEmails` | `maxandjazmine@gmail.com` (`"; "`-delimited list) | shared (no person) |

The **allowlist** is the union of all three; the **identity** of a caller is decided by
which key its (lower-cased) email matched. `sharedEmails` matches ⇒ shared account (writes
need an `actingPerson`, A5). If `maxEmail`, `jazEmail`, and `sharedEmails` are all empty or
the Settings tab is unreadable, every authenticated caller is rejected with
`ALLOWLIST_MISCONFIGURED` (fail closed, FR-005; SC-006). Matching is exact and
case-insensitive; a hand-added stray value only ever *adds* an exact match, never opens a
wildcard.

**Rationale**: Non-redundant, self-describing, Sheet-is-truth (Principle II): each cell
says exactly which person an email is. Separating `sharedEmails` cleanly encodes "allowed
to sign in but not a person." Replacing `allowedEmails` (vs. layering a second map on top)
avoids listing the same email twice.

**Migration note**: 001 seeded and the operator hand-filled `allowedEmails`. `Setup.js`
seeds are create-if-missing, so it will add the three new keys without touching anything;
the operator fills them (quickstart) and may delete the now-unused `allowedEmails` row.
The `allowlist-three-emails` project memory is updated to reflect the new key layout.

**Alternatives rejected**: *Keep flat `allowedEmails` + a separate `emailIdentityMap`*
(redundant, two places to edit, drift risk); *positional mapping* (fragile, un-boring).

## A5. Acting-person transport (FR-014, FR-006)

**Decision**: A shared-account **write** carries `payload.actingPerson` = `"max"|"jaz"`.
The dispatcher reads and **removes** it from `payload` before the entity handler runs, so:
(a) 001's `{token, action, payload}` envelope is unchanged (FR-006), and (b) it never
trips the handler's "unknown field ⇒ `BAD_REQUEST`" check. For personal callers it is
ignored (and unnecessary). A shared-account write missing/invalid `actingPerson` ⇒
`ACTING_PERSON_REQUIRED`. Reads and `auth.whoami` never require it.

**Rationale**: The envelope is frozen project-wide; identity-adjacent metadata that only
some callers send belongs in `payload`, consumed by the auth layer. Popping it keeps the
entity validators oblivious. Boring and envelope-safe.

**Alternatives rejected**: *New top-level envelope field* (`actingAs`) — violates FR-006;
*attribute shared writes to `both`* — user explicitly wants re-association to the real
person (clarify 2026-07-08); *reject all shared-account writes* — user wants them to work
after a "Max or Jaz?" confirm.

## A6. Error codes (FR-004)

**Decision**: Add to 001's closed set, all distinguishable, message text always safe/
non-revealing:

| code | when | client action |
|---|---|---|
| `UNAUTHENTICATED` | token missing/empty (non-`ping`) | prompt sign-in |
| `INVALID_CREDENTIAL` | tokeninfo non-200, or `aud`/`iss`/`email_verified` fails, or expired | silent refresh + retry |
| `FORBIDDEN` | verified email not on the allowlist | show private-app message; no retry |
| `ALLOWLIST_MISCONFIGURED` | allowlist empty/unreadable | maintainer fixes Settings |
| `ACTING_PERSON_REQUIRED` | shared-account write without a valid `actingPerson` | prompt "Max or Jaz?" then retry |

**Rationale**: FR-004 requires distinguishable codes; FR-013 requires no data leak — codes
carry no household info or allowlist contents. Adding codes is an additive contract change
(001 §Versioning: additive changes don't bump envelope shape).

**Alternatives rejected**: Reusing 001's `BAD_REQUEST` for all auth failures (not
distinguishable — breaks silent-refresh vs. private-app UX, FR-004/US3).

## A7. who-am-I (FR-009)

**Decision**: New action `auth.whoami`, payload none, returns
`{ identity: "max"|"jaz"|"shared", displayName, email, needsActingPerson: boolean }`.
`displayName`/`email` come from the token's `name`/`email` claims (no profile storage).
For the shared account: `identity: "shared"`, `needsActingPerson: true`. Requires a valid
allowlisted token; never requires an `actingPerson`.

**Rationale**: Lets feature 006 personalize ("my stuff + our stuff") and know when to
prompt "Max or Jaz?" without re-deriving identity. `ping` stays the only fully public
action (exposes only service/version).

**Alternatives rejected**: Deriving identity client-side from the token (duplicates the
allowlist logic on the client; drift risk).

## A8. OAuth scopes

**Decision**: Declare `oauthScopes` explicitly in `appsscript.json`:
`https://www.googleapis.com/auth/spreadsheets` (Sheet I/O) and
`https://www.googleapis.com/auth/script.external_request` (the tokeninfo fetch). The
deploying (shared) account re-authorizes once after this scope change.

**Rationale**: The external request scope is mandatory for `UrlFetchApp` to
`oauth2.googleapis.com`. Declaring scopes explicitly makes the consent predictable and is
the documented re-auth trigger (CLAUDE.md gotcha). Under execute-as-me only one account
consents — not both users.

**Alternatives rejected**: Relying on Apps Script scope auto-detection (opaque; surprises
at deploy time).

## A9. Rejection observability (FR-013)

**Decision**: On every rejection, `console.warn('AUTH_REJECT ' + code + ' ' + (email || '-'))`
(visible in Apps Script / Stackdriver logs). No ActivityLog row, no household write.

**Rationale**: FR-013 wants maintainers able to notice "strangers knocking" without
leaking to clients and without polluting the household audit trail. `console` logs are
private to the script owner. Consistent with 001's "log records what happened, not what
was attempted."

**Alternatives rejected**: ActivityLog rows for rejects (pollutes the household log with
non-events; contradicts 001 FR-019).

## A10. Credential lifecycle contract for feature 006 (FR-010, FR-011)

**Decision**: Document (in contracts/auth.md) the contract the 006 sign-in UI implements —
not built here:
- **Acquire**: Google Identity Services on the frontend, using `OAUTH_CLIENT_ID`, yields a
  short-lived ID token (~1 hour) attached as `token` on every call.
- **Refresh**: on `INVALID_CREDENTIAL`, obtain a fresh token silently and retry once
  before surfacing anything — day-to-day use shows zero prompts (SC-003).
- **Reject UX**: `FORBIDDEN` → a static "this is a private household app" screen, no data,
  no allowlist hints, no retry loop (FR-011). `ACTING_PERSON_REQUIRED` → a "Max or Jaz?"
  chooser, then retry with `actingPerson`.

**Rationale**: The spec sets these experience requirements now (US3) though the screens
ship in 006; pinning them to concrete codes lets 006 implement without re-deciding.

**Alternatives rejected**: Deferring the contract entirely to 006 (spec FR-010/011 require
it defined here).
