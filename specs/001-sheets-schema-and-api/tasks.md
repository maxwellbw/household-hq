---
description: "Task list for feature 001 sheets-schema-and-api"
---

# Tasks: Sheets Schema and API

**Input**: Design documents from `/specs/001-sheets-schema-and-api/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md — all present.

**Tests**: The spec/plan choose a manually-run `selfTest()` over a TDD test runner (Apps
Script has none; research/plan "keep it boring"). No pre-written failing-test tasks;
`SelfTest.js` and the quickstart curl walkthrough are the verification, in Polish.

**Organization**: Tasks are grouped by user story (spec.md priorities). Note the plan's
file structure is flat and keeps **all action handlers in `Api.js`** (no per-entity
files), so tasks touching handlers share that file and are sequential, not parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1–US4 for user-story-phase tasks only
- All paths are repo-relative; the Apps Script project is flat under `backend/`

## Path note

Apps Script has no folders — every source file lives directly in `backend/`
(`backend/Config.js`, `backend/Api.js`, …). `backend/.clasp.json` and
`backend/appsscript.json` already exist from initial-setup.md Phase 6.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Config constants and web-app deployment descriptor every file depends on.

- [X] T001 [P] Create `backend/Config.js` with committed constants: `SPREADSHEET_ID`
  (the "Household HQ DB" Sheet ID), `API_VERSION`, the six `TAB` names (Events, Tasks,
  TaskTemplates, Recurring, ActivityLog, Settings), and per-tab required-header arrays in
  provisioned column order (per data-model.md). No Script Properties (research D8).
- [X] T002 [P] Extend `backend/appsscript.json` with the `webapp` block (`executeAs`,
  `access`) and confirm V8 + `America/Los_Angeles` timezone. Add a comment that the
  execute-as mode is finalized by feature 002 (research R1); 001's curl validation works
  in either mode.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared Sheets engine, envelope/dispatch, validation, and the
append-only log — the machinery every user story calls. The ActivityLog writer is here,
not in US4, because logging every mutation is a constitutional cross-cutting requirement
that US2's P1 handlers already depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Create `backend/Validation.js`: owner enum (`max|jaz|both`), status enum
  (`open|done|snoozed`), cadence enum, ISO date/datetime parse+format helpers using the
  household timezone, season-window rule (both set or both blank; each 1–12; wrap-around
  legal), and per-action payload validators returning the offending `field` on failure
  (FR-014, data-model.md).
- [X] T004 Create `backend/Sheets.js` **read layer**: `getSheet_(tab)`,
  `buildHeaderMap_(sheet)` (header-name→index; throw `SCHEMA_MISMATCH` naming tab+header
  when a required header is missing/renamed — FR-020/D3), one `getDataRange().getValues()`
  read per tab, and `rowsToRecords_` producing flat objects keyed by header name with
  `""` for empty cells. Never index by numeric literal; preserve unknown extra columns.
- [X] T005 Add to `backend/Sheets.js` **write layer + lock**: `findById_`,
  `appendRecord_`, `updateRecordById_` (partial, writes only known columns by mapped
  index, leaves hand-added columns untouched), `deleteRecordById_` (hard row removal),
  each a single batch `setValues`/`appendRow` + `SpreadsheetApp.flush()`; and
  `withLock_(fn)` wrapping mutations in `LockService.getScriptLock()` →
  `waitLock(30_000)` → `releaseLock()` in `finally`, throwing `BUSY` on timeout
  (FR-018/D4). Reads take no lock.
- [X] T006 [P] Create `backend/ActivityLog.js`: `appendLog_(actor, action, targetId,
  detail)` appending exactly one row (timestamp in household tz, actor, action, targetId,
  detail) to the append-only ActivityLog tab; application code never edits/deletes log
  rows (FR-006/FR-019).
- [X] T007 Create `backend/Api.js` **envelope + dispatch skeleton**: `ok_(data)` /
  `err_(code, message, field?)` builders, `ContentService` `text/plain;charset=utf-8`
  output, `doGet` health ping → `{service, version}` (contracts §Transport), `doPost` that
  parses the body (→ `BAD_REQUEST` on unparseable JSON), reserves the `token` slot as
  declared actor (FR-016; no verification in 001), routes `action` through a handler
  registry (→ `UNKNOWN_ACTION` when absent), wraps everything so thrown errors map to the
  closed code set (`VALIDATION_FAILED|NOT_FOUND|BUSY|SCHEMA_MISMATCH|INTERNAL`), and
  registers the `ping` action. HTTP status is always 200; `ok` is the only discriminator.

**Checkpoint**: Engine ready — `doGet` ping and an empty-registry `doPost` return
well-formed envelopes. User stories can now be implemented.

---

## Phase 3: User Story 1 - Transparent household database exists (Priority: P1) 🎯 MVP

**Goal**: A single legible six-tab Sheet exists, provisionable idempotently, with
Settings and the supporting tables readable both by hand and through the API.

**Independent Test**: Run `setupDatabase()` on an empty Sheet, then again — six tabs with
frozen human-readable headers and seeded Settings keys appear once, unchanged by the
second run. A person unfamiliar with the code can interpret any row in under a minute.
`settings.list` / `templates.list` / `recurring.list` return the tables' contents.

- [X] T008 [US1] Create `backend/Setup.js` `setupDatabase()`: for each of the six tabs
  create-if-missing, write the header row only if row 1 is empty, set all
  date/ID/text columns to plain-text (`@`) format, and freeze row 1; seed Settings
  key–value rows (allowedEmails blank; `timezone=America/Los_Angeles`; placeholder keys
  per data-model.md); append one `provision` ActivityLog row (actor `system`). Never
  deletes/clears; safe to re-run forever (FR-021/D7). Operator-run, not an API action.
- [X] T009 [US1] Register read-only list handlers in `backend/Api.js`: `settings.list`
  (returns `{settings:{key:value,…}}`), `templates.list`, `recurring.list` — each one
  `getDataRange` read via `Sheets.js`, returning all rows as flat header-keyed records
  (FR-011; contracts §Actions).

**Checkpoint**: Database provisions idempotently and the three supporting tables read back
through the API. MVP data layer exists.

---

## Phase 4: User Story 2 - The app can read and write Events and Tasks (Priority: P1)

**Goal**: Stable list/create/update/delete for Events and Tasks through one envelope,
with predictable idempotent writes and structured errors.

**Independent Test**: Through the API only, create an event and a task (with a
client-supplied id), list them, update them, delete them — every response follows the
envelope; replaying a create returns the existing record with no duplicate row; an
update/delete on an unknown id returns `NOT_FOUND`.

- [X] T010 [US2] Register Events handlers in `backend/Api.js`: `events.list`,
  `events.create` (client-suppliable id; server-generates via `Utilities.getUuid()` when
  absent; replay of an existing id returns it with `ok:true` — FR-017/D5),
  `events.update` (partial; unknown field → `BAD_REQUEST`; whole-write validation incl.
  `end ≥ start`), `events.delete` (hard). All mutations run under `withLock_` and append
  one ActivityLog row; validate via `Validation.js` (owner/dates) before touching the
  Sheet.
- [X] T011 [US2] Register Tasks handlers in `backend/Api.js`: `tasks.list`,
  `tasks.create` (id optional; `status` defaults `open`), `tasks.update` (partial;
  status transitions — setting `status:"done"` stamps `completedBy` (actor) +
  `completedAt`; returning to `"open"` clears both, per data-model lifecycle),
  `tasks.delete` (hard, title preserved in log detail). Same lock + validation + single
  ActivityLog append discipline as T010.

**Checkpoint**: Full Events + Tasks CRUD round-trips through the API. Core contract is
live for all future features.

---

## Phase 5: User Story 3 - Hand edits don't break the app (Priority: P2)

**Goal**: Reordered rows, blank-ID hand-added rows, and garbage cells all degrade
gracefully; a renamed header fails loudly.

**Independent Test**: Sort a tab by hand, append a row with a blank id, corrupt one
cell — the service still updates/deletes the right records by id, adopts the blank-id row
with a UUID + `adopt-id` log, returns the bad-cell row with `_warnings`, and renaming a
required header yields `SCHEMA_MISMATCH`.

- [X] T012 [US3] Add blank-ID adoption to `backend/Sheets.js`: on any tab access, before
  serving records, assign a `Utilities.getUuid()` to each hand-added row whose id cell is
  blank, write it back (under `withLock_`), and append an `adopt-id` ActivityLog row
  (actor `system`) per adoption (FR-022; contracts §Semantics). Idempotent — an
  already-id'd row is untouched.
- [X] T013 [US3] Add graceful-degradation to `backend/Sheets.js` `rowsToRecords_`: rows
  with unparseable cells (e.g. bad date) are returned intact with an added
  `_warnings:["…"]` key rather than dropped, so listings serve good and flag bad rows
  (FR-020). Confirm the `SCHEMA_MISMATCH` loud-failure path from T004 covers
  missing/renamed required headers.

**Checkpoint**: Direct Sheet edits — sort, hand-add, corrupt, rename — no longer break
any operation.

---

## Phase 6: User Story 4 - Every change is visible in the activity feed (Priority: P2)

**Goal**: Exactly one ActivityLog row per successful mutation; zero for failures.

**Independent Test**: One create, one update, one delete through the service adds exactly
three log rows (timestamp, actor, action, targetId); a rejected request adds none.

- [X] T014 [US4] Audit every mutation path in `backend/Api.js` and `backend/Setup.js`:
  ensure the `appendLog_` call happens only after the Sheet write succeeds and inside the
  same lock, so a validation/`NOT_FOUND`/`BUSY` rejection appends no row (FR-019); confirm
  create/update/delete/`adopt-id`/`provision` each map to exactly one row with the right
  action verb and a useful `detail` (deleted record's title on delete).

**Checkpoint**: The activity feed is a complete, failure-free record of every state
change.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification and deployment against the live Sheet.

- [X] T015 [P] Create `backend/SelfTest.js` `selfTest()`: exercise CRUD round-trip,
  idempotent-replay, the four error cases, hand-edit resilience (adopt-id + `_warnings` +
  `SCHEMA_MISMATCH`), the ActivityLog audit, and a concurrency spot-check — logging
  `ALL PASS` at the end (quickstart.md §8 parity).
- [X] T016 Deploy: `cd backend && clasp push && clasp deploy`; run `setupDatabase()`
  twice from the editor (verify no duplication); fill `allowedEmails` by hand in Settings
  (quickstart.md §1). First deploy only: set execute-as / access per initial-setup.md
  Phase 7.
- [X] T017 Run the full quickstart.md validation (§§2–7) against the deployed `$URL` and
  confirm SC-001…SC-007 hold.
- [X] T018 [P] Update `backend/README.md` (or note in spec.md) with the deploy/provision
  steps and the fixed transport/envelope decision if anything changed during
  implementation.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup. Blocks all user stories.
- **US1 → US2 → US3 → US4**: each depends only on Foundational and is independently
  testable; priority order is P1 (US1, US2) then P2 (US3, US4). US2 does not depend on
  US1 code, but MVP delivery does US1 then US2.
- **Polish (P7)**: depends on all shipped stories.

### Shared-file serialization (important)

- `backend/Api.js` is touched by **T007, T009, T010, T011, T014** — these run
  sequentially, not in parallel, despite spanning stories.
- `backend/Sheets.js` is touched by **T004, T005, T012, T013** — sequential.

### Parallel opportunities

- **T001, T002** (Setup) — different files, parallel.
- **T003 (Validation.js), T006 (ActivityLog.js)** — parallel with each other and with the
  first Sheets.js task, since they're independent files; T007 (Api.js) needs them.
- **T015, T018** (Polish) — parallel.

---

## Implementation Strategy

### MVP first

1. Phase 1 Setup → 2. Phase 2 Foundational (critical) → 3. Phase 3 US1 (provision +
supporting reads) → 4. Phase 4 US2 (Events + Tasks CRUD). **Stop and validate**: a full
create→list→update→delete round-trip through the API is the demonstrable MVP.

### Incremental delivery

Add US3 (hand-edit resilience) then US4 (activity-feed audit) — each hardens the layer
without changing the contract — then Polish: `selfTest()`, deploy, quickstart, docs.
