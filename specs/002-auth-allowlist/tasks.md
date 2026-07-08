---
description: "Task list for feature 002 auth-allowlist"
---

# Tasks: Auth Allowlist

**Input**: Design documents from `/specs/002-auth-allowlist/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth.md — all present.

**Tests**: As in 001, the spec/plan choose a manually-run `selfTest()` over a TDD runner
(Apps Script has none; "keep it boring"). The identity resolver is split into a pure
`resolveIdentity_(claims)` so `SelfTest.js` can exercise every accept/reject path with
synthetic claims; the live token path is proven in the quickstart. No pre-written
failing-test tasks.

**Organization**: Tasks are grouped by user story (spec.md priorities). The plan keeps the
flat `backend/` structure and puts all verification/resolution in one new `Auth.js`; the
`doPost` gate and handlers stay in `Api.js`, so all Api.js tasks are **sequential**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1–US3 for user-story-phase tasks only
- All paths are repo-relative; the Apps Script project is flat under `backend/`

## Path & shared-file note

Apps Script has no folders — every source file lives directly in `backend/`.
`backend/appsscript.json` and `backend/Config.js` already exist from 001.

- `backend/Api.js` is touched by **T005, T006, T007, T008, T009** — sequential, not parallel.
- `backend/Auth.js` (new) is touched by **T003, T004, T007** — sequential.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Config + deployment descriptor changes every auth path depends on.

- [X] T001 [P] Update `backend/Config.js`: add the committed `OAUTH_CLIENT_ID` constant
  (the app's Google **Web** OAuth client ID, `…apps.googleusercontent.com`; public, like
  `SPREADSHEET_ID` — research A2); in `SETTINGS_SEED` **replace** the single `allowedEmails`
  row with three self-describing rows `maxEmail` / `jazEmail` / `sharedEmails` (blank
  values, notes per data-model.md §Settings); and add a `WRITE_ACTIONS` helper/set (or an
  `isWriteAction_` convention: action ends in `.create`/`.update`/`.delete`) for the
  acting-person rule (A5).
- [X] T002 [P] Update `backend/appsscript.json`: add explicit `oauthScopes`
  (`…/auth/spreadsheets` and `…/auth/script.external_request` for the tokeninfo fetch —
  A8); confirm/ratify the shipped `webapp` mode `executeAs: USER_DEPLOYING` +
  `access: ANYONE_ANONYMOUS` (this **is** R1's answer — A3) and replace 001's
  "finalized by feature 002" comment with a note that 002 ratified it.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The verification + identity-resolution engine both P1 stories call. Nothing
in US1/US2 works until `Auth.js` exists.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Create `backend/Auth.js` **token verification**: `verifyIdToken_(token)` GETs
  `https://oauth2.googleapis.com/tokeninfo?id_token=<token>` via `UrlFetchApp`
  (`muteHttpExceptions:true`); on non-200 or unparseable body, or when `aud !==
  OAUTH_CLIENT_ID`, `iss` is not a Google issuer, or `email_verified` is not true, throw
  `AppError_('INVALID_CREDENTIAL', <safe msg>)`; otherwise return the claims
  (`email`, `name`, `aud`, `iss`, `sub`). Google enforces signature/expiry/skew — no local
  crypto (research A1/A2).
- [X] T004 Add to `backend/Auth.js` **allowlist + identity resolution**:
  `readAllowlist_()` reads `maxEmail`/`jazEmail`/`sharedEmails` from Settings (trim +
  lower-case; `sharedEmails` is `"; "`-split); `resolveIdentity_(claims)` — a **pure**
  function — returns `{ identity:"max"|"jaz"|"shared", actor, email, displayName }` or
  throws `AppError_('ALLOWLIST_MISCONFIGURED', …)` when all three keys are empty/unreadable
  (fail closed — FR-005/SC-006) and `AppError_('FORBIDDEN', …)` when the verified email
  matches none. Matching is exact + case-insensitive; messages leak no allowlist contents
  (FR-013/SC-004).

**Checkpoint**: `verifyIdToken_` + `resolveIdentity_` exist and are unit-exercisable with
synthetic claims. The `doPost` gate can now be wired.

---

## Phase 3: User Story 1 - Only Max and Jaz can touch household data (Priority: P1) 🎯 MVP

**Goal**: Every action except `ping` requires a verified, allowlisted identity; everyone
else is rejected with a distinguishable, non-revealing error and zero data access.

**Independent Test**: Call the service with (a) no token, (b) a garbage token, (c) a valid
token for a non-allowlisted account — get `UNAUTHENTICATED`, `INVALID_CREDENTIAL`,
`FORBIDDEN` respectively, each with no household data; `ping` still answers with no token.

- [X] T005 [US1] Wire the auth gate into `backend/Api.js` `doPost`: before dispatch, if the
  action is `ping` skip auth; else empty/missing `token` → `UNAUTHENTICATED`, otherwise
  `verifyIdToken_(body.token)` → `resolveIdentity_(claims)` and pass the resolved `actor`
  to the handler. **Remove** the 001 `resolveActor_` declared-actor shim. `doGet`/`ping`
  stay fully public (service+version only). Thrown `AppError_`s already map to the error
  envelope via the existing catch — no envelope plumbing changes (FR-001/FR-006).
- [X] T006 [US1] Add reject observability in `backend/Api.js` (FR-013): on any auth failure
  `console.warn('AUTH_REJECT ' + code + ' ' + (email||'-'))` before returning the error
  envelope; confirm no ActivityLog row and no Sheet write occurs on rejection (the gate runs
  before any handler/`withLock_`).

**Checkpoint**: Unauthorized callers (none / invalid / valid-but-unlisted) are all refused
with distinct codes and no leakage. This is the security MVP.

---

## Phase 4: User Story 2 - Every change is attributed to a verified person (Priority: P1)

**Goal**: Every write's `actor`/`completedBy` comes from the verified identity — personal
callers map directly, the shared account is disambiguated to a real person, and client-
declared actor fields are ignored.

**Independent Test**: A personal-account create whose body also sets `completedBy:"jaz"` is
logged with `actor` = the token's person (claim ignored); a shared-account write with no
`actingPerson` returns `ACTING_PERSON_REQUIRED` and writes nothing; the same write with
`actingPerson:"jaz"` is logged with `actor` `jaz`, never the shared account.

- [X] T007 [US2] Add shared-account disambiguation across `backend/Auth.js` +
  `backend/Api.js`: for a **write** action (`isWriteAction_`) by a `shared` identity,
  require `payload.actingPerson ∈ {max, jaz}` else `AppError_('ACTING_PERSON_REQUIRED', …)`;
  set `actor = actingPerson`. In `doPost`, **pop** `actingPerson` off `payload` before the
  handler runs so 001's envelope stays frozen and it never trips the handler's unknown-field
  check (FR-014/FR-006/A5). Personal callers ignore `actingPerson` entirely.
- [X] T008 [US2] Harden attribution in `backend/Api.js` (FR-007): ensure `completedBy` is
  **never** copied from the client `payload` — it is stamped only from the verified `actor`
  on the `status:"done"` transition (per 001's Task lifecycle), and cleared on reopen. Drop
  any client-supplied `completedBy`/actor field from create/update payloads so a false claim
  can never produce a mis-attributed record (SC-002).

**Checkpoint**: Attribution is trustworthy end-to-end: personal, shared-disambiguated, and
false-claim cases all resolve to the correct real person.

---

## Phase 5: User Story 3 - Signing in is a once-in-a-while act (Priority: P2)

**Goal**: The contract the feature-006 sign-in UI needs — a "who am I" answer and codes
distinguishable enough for silent refresh and correct messaging — is delivered here.

**Independent Test**: `auth.whoami` as a personal account returns `{identity:"max"|"jaz",
needsActingPerson:false}`; as the shared account returns `{identity:"shared",
needsActingPerson:true}`; the rejection codes from US1/US2 are all distinct (refresh vs.
private-app vs. "which person?").

- [X] T009 [US3] Register the `auth.whoami` handler in `backend/Api.js`: returns
  `{ identity, displayName, email, needsActingPerson }` from the resolved identity
  (`needsActingPerson` true only for `shared`); requires a valid allowlisted token but never
  an `actingPerson` (FR-009; data-model §whoami). `ping` remains the only fully public action.
- [X] T010 [US3] Confirm `specs/002-auth-allowlist/contracts/auth.md` documents the
  credential lifecycle for feature 006 (GIS acquisition, ~1h expiry + silent refresh on
  `INVALID_CREDENTIAL`, private-app message on `FORBIDDEN`, "Max or Jaz?" on
  `ACTING_PERSON_REQUIRED`) and that its error-code table matches the codes actually thrown
  in Auth.js/Api.js (FR-010/FR-011). No code — a doc-consistency check.

**Checkpoint**: The sign-in contract is complete and code-accurate; feature 006 can build
against it without re-deciding anything.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Self-test parity, the FR-012 doc corrections, live deploy, and validation.

- [X] T011 [P] Add an auth block to `backend/SelfTest.js` `selfTest()`: drive
  `resolveIdentity_` with synthetic claims for accept (`max`, `jaz`), `FORBIDDEN`
  (unlisted email), `ALLOWLIST_MISCONFIGURED` (all keys blank), `shared` → needs
  actingPerson, and `shared` + `actingPerson:"jaz"` → `actor jaz`; keep the log ending
  `ALL PASS` (quickstart §10 parity).
- [X] T012 [P] FR-012 doc corrections: fix `CLAUDE.md` (the deploy line — "Execute as: me
  (deploying/shared account), access: Anyone" not "user accessing the app / Anyone with a
  Google account"; only the deployer re-authorizes) and its "two-email allowlist" →
  three-account (two personal + shared); and `initial-setup.md` (the deploy-dialog step and
  the "You and Jaz each authorize" line). Same change as the code (A3/FR-012).
- [X] T013 Deploy & provision (needs the operator): create the OAuth **Web client ID** in
  the Cloud Console and paste it into `Config.js` `OAUTH_CLIENT_ID` (quickstart §1); then
  `cd backend && clasp push && clasp deploy -i <deploymentId>`; authorize the new
  `script.external_request` scope (deployer/shared account only); run `setupDatabase()` to
  seed the new Settings keys; fill `maxEmail`/`jazEmail`/`sharedEmails` and delete the stale
  `allowedEmails` row (quickstart §2).
- [X] T014 Run `quickstart.md` §4–§10 against the deployed `$URL` (mint tokens via the OAuth
  Playground): confirm the rejection matrix, verified attribution, shared-account
  disambiguation, `auth.whoami`, and fail-closed — i.e. SC-001, SC-002, SC-004, SC-006
  hold. (SC-003 silent-refresh and SC-005 latency are verified end-to-end with feature 006.)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup (needs `OAUTH_CLIENT_ID`, the new Settings keys,
  the scope). Blocks all user stories.
- **US1 (P1)**: depends on Foundational. The security MVP.
- **US2 (P1)**: depends on Foundational and the US1 gate (shares the `doPost` path).
- **US3 (P2)**: depends on Foundational (resolver) and the US1 gate; independent of US2.
- **Polish (P6)**: depends on all shipped stories; T013/T014 are last (live deploy).

### Shared-file serialization (important)

- `backend/Api.js` — **T005 → T006 → T007 → T008 → T009**, sequential.
- `backend/Auth.js` — **T003 → T004 → T007**, sequential.

### Parallel opportunities

- **T001, T002** (Setup) — different files, parallel.
- **T011, T012** (Polish) — `SelfTest.js` vs. `CLAUDE.md`/`initial-setup.md`, parallel.

---

## Implementation Strategy

### MVP first

1. Phase 1 Setup → 2. Phase 2 Foundational (`Auth.js`) → 3. Phase 3 US1 (the `doPost`
gate). **Stop and validate**: no-token / garbage-token / unlisted-token are all rejected
with distinct codes and `ping` still works — the enforcement MVP (SC-001).

### Incremental delivery

Add US2 (verified attribution + shared disambiguation), then US3 (`auth.whoami` + lifecycle
contract) — neither changes 001's envelope shape. Then Polish: `selfTest()` parity, the
FR-012 doc corrections, and the live deploy + quickstart run.
