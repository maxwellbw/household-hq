# Implementation Plan: Auth Allowlist

**Branch**: `002-auth-allowlist` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-auth-allowlist/spec.md`

## Summary

Turn 001's reserved `token` slot into enforced identity. Every action except the public
`ping` now requires a Google ID token: the backend verifies it via Google's `tokeninfo`
endpoint (dependency-free, offloads signature/expiry/skew to Google), checks `aud`
against our OAuth Web client ID and that the email is verified, then matches the email
(case-insensitively) against the Settings allowlist — the two personal accounts (Max,
Jaz) plus the shared household account. Attribution switches from the declared string to
the verified identity mapped to `max`/`jaz`. The shared account is never itself an actor:
a shared-account write must carry a confirmed `actingPerson`, else it's rejected. Adds a
`auth.whoami` action, five distinguishable rejection codes, and documents the credential
lifecycle the feature-006 sign-in UI will implement. Finally, ratifies the web-app
deployment mode (execute-as-me / anyone), resolving 001's risk R1, and corrects the stale
CLAUDE.md / initial-setup.md prose.

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+), JavaScript — same as 001

**Primary Dependencies**: none (constitution Principle IV). New external call: Google
`tokeninfo` over `UrlFetchApp`. No libraries, no JWT/crypto code.

**Storage**: same Google Sheet. Auth reads three Settings keys (`maxEmail`, `jazEmail`,
`sharedEmails`); `OAUTH_CLIENT_ID` is a committed constant in `backend/Config.js` (public,
not a secret — client IDs are safe to commit; matches D8).

**Testing**: `SelfTest.js` — synthetic-claims unit checks over the pure identity resolver
for every accept/reject path; live token path validated in [quickstart.md](quickstart.md)
with a real ID token minted via the OAuth 2.0 Playground (and end-to-end in feature 006).

**Target Platform**: Apps Script web app (`clasp push && clasp deploy` from `/backend`)

**Project Type**: web-service backend (frontend consumes it from feature 006 on)

**Performance Goals**: within 001's < 5s budget (SC-005). One extra `tokeninfo` round trip
(~100–300 ms) per authenticated request; acceptable at tens of requests/day.

**Constraints**: no server-side session cache — verify every request (spec Assumptions);
envelope shape from 001 is frozen (FR-006), so `actingPerson` rides inside `payload`;
`access: ANYONE_ANONYMOUS` so cross-origin `fetch` gets JSON, not a login redirect (R1).

**Scale/Scope**: exactly two people; three allowlisted accounts; tens of requests/day.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Two Users Forever | ✅ Pass | Still two humans; the allowlist's third entry is the shared **infrastructure** account (owns Sheet/Script, runs clasp), always resolved to `max`/`jaz` for attribution — never a third identity. No roles, tenancy, or registration. `owner`/actor stay `max\|jaz\|both`/`max\|jaz\|system`. See A4. |
| II | Sheet Is Source of Truth | ✅ Pass | Allowlist + identity map are plain-text, hand-editable Settings rows (A4); `OAUTH_CLIENT_ID` is a committed constant like `SPREADSHEET_ID` (A2). No session cache or shadow state — verify per request. |
| III | Free-Tier Only | ✅ Pass | Google `tokeninfo` is a free keyless endpoint; no paid or billed service added (A1). |
| IV | Boring and Debuggable | ✅ Pass | `tokeninfo` over hand-rolled JWKS/RSA verification (A1); one straight-line `Auth.js`; five clearly-named error codes; no crypto. |
| V | Idempotent Generation | ✅ Pass | Auth introduces no generators or writes; rejected requests write nothing; `auth.whoami` is read-only. No trigger surface. |
| VI | Every State Change Logged | ✅ Pass | Attribution now comes from verified identity (more trustworthy); still one ActivityLog row per mutation. Rejected requests log to console only (FR-013), consistent with 001's "log what happened, not what was attempted." |
| VII | Spec-Driven | ✅ Pass | spec.md + clarify session (2026-07-08) complete; this plan; deviations return to the spec. |

**Post-Phase-1 re-check (2026-07-08)**: all seven gates still pass. The design in
data-model.md and contracts/auth.md adds no service, dependency, role, or unlogged write
path. The shared-account entry is expressly justified under Principle I above. No
Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-allowlist/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions A1–A10, resolves R1
├── data-model.md        # Phase 1 — Settings auth keys, identity map, error codes, whoami
├── quickstart.md        # Phase 1 — deploy (scopes/mode) + curl/Playground validation
├── contracts/
│   └── auth.md          # Phase 1 — delta to 001's api.md: codes, whoami, actingPerson, lifecycle
└── tasks.md             # Phase 2 (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── appsscript.json      # + oauthScopes (spreadsheets, script.external_request); mode ratified
├── Config.js            # + OAUTH_CLIENT_ID; SETTINGS_SEED: allowedEmails → maxEmail/jazEmail/sharedEmails; WRITE_ACTIONS
├── Auth.js              # NEW — verifyIdToken_ (tokeninfo), resolveIdentity_ (pure), requireActor_, whoami
├── Api.js               # doPost gains the auth gate + actingPerson pop; + auth.whoami handler; resolveActor_ removed
└── SelfTest.js          # + resolveIdentity_ checks across every accept/reject path

# Docs corrected in the same change (FR-012):
CLAUDE.md                # deploy mode + "two-email" → three-account allowlist
initial-setup.md         # deploy dialog: Execute as me / Anyone (not "user accessing")
```

**Structure Decision**: single `backend/` Apps Script project, one file per concern
(flat — Apps Script has no folders), matching 001. Auth logic isolated in `Auth.js`; the
only edits to existing files are the `doPost` gate and config/seed additions. No frontend
work this feature — the sign-in UI is feature 006, contracted here.

## Key Design Decisions (full detail in research.md)

- **A1 Token verification (FR-002)**: verify each ID token by calling Google
  `tokeninfo` over `UrlFetchApp` — Google checks signature, expiry, and clock skew;
  we read the returned claims. No local JWT/RSA code (rejected as un-boring).
- **A2 Audience binding (FR-002)**: require `aud == OAUTH_CLIENT_ID` (committed constant),
  `email_verified == true`, and a Google `iss`. The Web client ID is created once in the
  Cloud Console (a browser step; public value).
- **A3 Deployment mode (FR-012 / resolves R1)**: keep `executeAs: USER_DEPLOYING` +
  `access: ANYONE_ANONYMOUS` (already shipped in 001's manifest) — cross-origin `fetch`
  gets JSON; the ID token + allowlist do all gating. Only the deploying (shared) account
  authorizes scopes. Correct CLAUDE.md and initial-setup.md, which currently misstate this.
- **A4 Allowlist + identity storage (FR-003/FR-007)**: three hand-editable Settings keys —
  `maxEmail`→`max`, `jazEmail`→`jaz`, `sharedEmails` (";"-list)→shared. Allowlist = their
  union; identity = which key matched. Replaces the single `allowedEmails` seed. Empty/
  unreadable ⇒ fail closed (FR-005).
- **A5 Acting-person transport (FR-014, FR-006)**: shared-account writes carry
  `payload.actingPerson` (`max`/`jaz`); the dispatcher pops it before entity validation so
  001's envelope stays frozen and it isn't seen as an unknown field. Ignored for personal
  callers; required on write actions for shared callers.
- **A6 Error codes (FR-004)**: add `UNAUTHENTICATED`, `INVALID_CREDENTIAL`, `FORBIDDEN`,
  `ALLOWLIST_MISCONFIGURED`, `ACTING_PERSON_REQUIRED` — additive to 001's set (no envelope
  shape change), each programmatically distinguishable for the client.
- **A7 who-am-I (FR-009)**: `auth.whoami` returns `{ identity, displayName, email,
  needsActingPerson }`. Requires a valid allowlisted token but never an acting-person;
  `ping` remains the only fully public action.
- **A8 Scopes (FR-013 side-effect)**: declare `oauthScopes` explicitly (spreadsheets +
  `script.external_request` for the tokeninfo fetch). Deployer re-authorizes once.
- **A9 Reject logging (FR-013)**: `console.warn` the code + email on every rejection; no
  ActivityLog row and no household data written.
- **A10 Credential lifecycle contract (FR-010/FR-011)**: documented in contracts/auth.md
  for feature 006 — GIS token acquisition, ~1h expiry, silent refresh on
  `INVALID_CREDENTIAL`, private-app message on `FORBIDDEN`, "Max or Jaz?" prompt on
  `ACTING_PERSON_REQUIRED`.

## Complexity Tracking

No constitution violations; table intentionally empty.
