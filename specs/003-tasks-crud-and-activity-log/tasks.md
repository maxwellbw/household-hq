---
description: "Task list for feature 003 tasks-crud-and-activity-log"
---

# Tasks: Tasks CRUD and Activity Log

**Input**: Design documents from `/specs/003-tasks-crud-and-activity-log/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-003.md — all
present. Features 001 (schema/API/envelope) and 002 (verified `actor`/`identity`) are
deployed.

**Tests**: As in 001/002, the plan chooses a manually-run `selfTest()` over a TDD runner
(Apps Script has none; "keep it boring"). Lifecycle and slice logic are exercised in
`SelfTest.js` with live Sheet round-trips; the token/HTTP path is proven in the quickstart.
No pre-written failing-test tasks.

**Organization**: Tasks are grouped by user story (spec.md priorities). This feature is
**backend-only** — the UI is feature 006. No schema columns are added.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1–US3 for user-story-phase tasks only
- All paths are repo-relative; the Apps Script project is flat under `backend/`

## Path & shared-file note

Apps Script has no folders — every source file lives directly in `backend/`. Because several
tasks edit the same file, they are **sequential** (no `[P]`):

- `backend/Api.js` — **T003, T004, T006, T010** (handlers + `HANDLERS` registry) → sequential.
- `backend/Sheets.js` — **T002, T009** (two new helpers) → sequential.
- `backend/SelfTest.js` — **T005, T007, T011** (new assertion blocks) → sequential.
- `backend/Config.js` (**T001**) and `backend/README.md` (**T012**) are each touched once.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Constants the feed summary and slices read, in one place.

- [X] T001 [P] Update `backend/Config.js`: add feed + slice constants — `FEED_DEFAULT_LIMIT = 200`
  and `FEED_MAX_LIMIT = 500` (research D5); `ACTOR_DISPLAY_NAMES = { max:'Max', jaz:'Jaz',
  system:'System' }` and `ACTION_VERBS = { create:'added', update:'edited', complete:'completed',
  reopen:'reopened', delete:'deleted', 'adopt-id':'assigned an id to', provision:'set up' }`
  for `summary` composition; and a `TASK_FILTERS = ['mine','theirs','ours','all','default']`
  list for `tasks.list` validation. No schema/`HEADERS` changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The lock-safe lifecycle write primitive that `tasks.complete`/`tasks.reopen`
(US1, the MVP) both call. Nothing in US1 works until it exists.

**⚠️ CRITICAL**: US1 depends on T002.

- [X] T002 [US1] Add `setTaskLifecycle_(id, targetStatus, actor, logAction)` to
  `backend/Sheets.js`: run inside `withLock_` → `readTableForWrite_(TABS.TASKS)` →
  `findRecord_`; `NOT_FOUND` if absent. **Read current status first**: if it already equals
  `targetStatus` (`done` for complete, `open` for reopen), return
  `{ task: stripInternal_(rec), changed: false }` **without writing or logging** (FR-003;
  the no-change/race answer — the read+decision is inside the lock, D2). Otherwise set
  `status = targetStatus`; for `done` stamp `completedBy = actor` + `completedAt = nowIso_()`,
  for `open` clear both; `writeRowAsText_` the row; `appendLog_(actor, logAction, id,
  merged.title || '')`; return `{ task: merged, changed: true }`. Reuse the existing
  read/find/build/write helpers — no new Sheet-access code (research D3).

---

## Phase 3: User Story 1 — Run my task list end to end (Priority: P1) 🎯 MVP

**Goal**: Full, trustworthy task lifecycle — create/edit/complete/reopen/delete with correct
attribution and exactly-one feed entry per change (no dup on re-complete).

**Independent Test**: Walk one task through its whole life via the service (create `both`
+ due date, retitle, move then clear due date, complete, re-complete = no-change, reopen,
delete), asserting state, attribution, and log entries at each step (spec US1 Independent
Test; quickstart §2–3).

- [X] T003 [US1] In `backend/Api.js` add `completeTask_(payload, actor)` and
  `reopenTask_(payload, actor)`: `requireFields_(payload, ['id'])`, then return
  `setTaskLifecycle_(id, 'done', actor, 'complete')` / `setTaskLifecycle_(id, 'open', actor,
  'reopen')` respectively. Register in `HANDLERS`: `'tasks.complete'` and `'tasks.reopen'`,
  each returning the helper's `{ task, changed }` object (contracts/api-003.md).
- [X] T004 [US1] In `backend/Api.js` **tighten `updateTask_`**: reject any of `status`,
  `completedBy`, `completedAt` present in the payload with
  `fail_('BAD_REQUEST', 'Use tasks.complete / tasks.reopen to change status.', <field>)`
  (do this before/at `rejectUnknownFields_`); remove the old status→completion stamping block
  (lines that set/clear `completedBy`/`completedAt` on status transitions) so `tasks.update`
  only ever writes `title`/`owner`/`dueDate` and logs `update`. Confirm clearing `dueDate`
  (empty string) still works via the existing `mutablePatch_` path (FR-005). This supersedes
  001's status-via-update line (contracts/api-003.md). Also tighten `createTask_`: new tasks
  always start `open` and an explicit non-open `status` is rejected `BAD_REQUEST` (FR-001).
- [X] T005 [US1] In `backend/SelfTest.js` **rewrite the completion block** in
  `liveCrudRoundTrip_` (the `updateTask_({status:'done'})` / `{status:'open'}` lines) to use
  `completeTask_`/`reopenTask_`: assert complete → `changed:true`, `status:'done'`,
  `completedBy === actor`, `completedAt !== ''`; a **second** `completeTask_` →
  `changed:false` with the **same** `completedBy`/`completedAt` and **no new** `complete`
  log row (count ActivityLog rows for the id before/after); reopen → `changed:true`,
  `status:'open'`, completion cleared, and a `reopen` log row; reopen again → `changed:false`,
  no new row. Add an assertion that `updateTask_({id, status:'done'})` now throws
  `BAD_REQUEST` (SC-003/SC-006).

**Checkpoint**: US1 is independently testable — the lifecycle is complete and idempotent.

---

## Phase 4: User Story 2 — See mine, theirs, ours, or everything (Priority: P1)

**Goal**: Identity-relative task slices (`mine`/`theirs`/`ours`/`all`/`default`) resolved from
the verified caller, never a client parameter.

**Independent Test**: Seed tasks owned `max`, `jaz`, `both`; request each filter as each user
and verify exact membership — `mine`/`theirs`/`ours` disjoint and union to `all`, `both`
only in `ours`/`default`, and `mine` flips between Max and Jaz (spec US2; quickstart §4).

- [X] T006 [US2] In `backend/Api.js` add `listTasks_(payload, actor, identity)` and point
  `HANDLERS['tasks.list']` at it (replacing the bare `listRecords_` call). Read all tasks
  once via `listRecords_(TABS.TASKS)`. Resolve `filter` (default `all`); reject values not in
  `TASK_FILTERS` with `VALIDATION_FAILED` (field `filter`). For identity-relative filters
  (`mine`/`theirs`/`default`) resolve the caller's person `P`: personal account → `actor`;
  shared account (`actor` null) → `payload.actingPerson` ∈ {max,jaz} or
  `ACTING_PERSON_REQUIRED` (reuse 002's shape — research D4). Filter in memory: `mine`
  `owner===P`; `theirs` `owner===other(P)` (`other(max)=jaz`); `ours` `owner==='both'`;
  `default` `owner===P || owner==='both'`; `all` everything. Return `{ tasks }`
  (all statuses — owner-only filtering).
- [X] T007 [US2] In `backend/SelfTest.js` add `liveTaskSlices_()` (call it from `selfTest()`):
  seed one `max`, one `jaz`, one `both` task (selftest prefix), then assert against
  `listTasks_` with a synthetic `max` actor and a synthetic `jaz` actor that `mine`/`theirs`/
  `ours` are pairwise-disjoint and union to `all` over the seeded ids, `both` appears only in
  `ours`/`default`, `default` === `mine ∪ ours`, and `mine` differs between the two callers
  (FR-009/SC-002). Also assert an unknown `filter` throws `VALIDATION_FAILED`. Clean up the
  seeded rows.

**Checkpoint**: US2 is independently testable — slices are correct and caller-relative.

---

## Phase 5: User Story 3 — Know what my partner did without asking (Priority: P2)

**Goal**: A readable, newest-first, bounded household activity feed that survives deleted
targets and attributes system entries to the system.

**Independent Test**: Perform a few changes (complete/edit/delete), fetch the feed, verify
entries arrive newest-first with `who + action + title + when` summaries — including the
deleted one — and that the log is never mutated (spec US3; quickstart §5).

- [X] T009 [US3] Add `readActivityFeed_(opts)` to `backend/Sheets.js`: `readTable_(TABS.ACTIVITY_LOG)`
  (read-only, no lock), **reverse** `records` into newest-first append order (do **not** sort on
  the minute-resolution `timestamp` — research D5). Apply optional `opts.since` (keep
  `timestamp >= since`) then take the first `min(opts.limit || FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT)`. Map each to a FeedEntry: the five raw columns plus `summary` composed as
  `<name> <verb>[ '<detail>']` using `ACTOR_DISPLAY_NAMES` (fallback: the raw actor) and
  `ACTION_VERBS` (fallback: the raw action), quoting `detail` only when non-empty. Never
  dereference `targetId` (FR-013); empty log → `[]`.
- [X] T010 [US3] In `backend/Api.js` add `listActivity_(payload)` returning
  `{ activity: readActivityFeed_({ limit: payload.limit, since: payload.since }) }`, and
  register `HANDLERS['activity.list']` (read-only; verified caller, no `actingPerson`, no
  lock — contracts/api-003.md). If `limit`/`since` are supplied, coerce/validate loosely
  (numeric limit; `since` passed through as a string comparison).
- [X] T011 [US3] In `backend/SelfTest.js` add `liveActivityFeed_()` (call it from `selfTest()`):
  create → complete → delete a selftest task, then assert `readActivityFeed_` returns those
  entries **newest-first**, each with a non-empty `summary` naming the actor + action + title,
  that the deleted task's entries **still read** with its title (FR-013/SC-005), that
  `complete` appears as its own action (not `update`), and that `limit`/`since` bound the
  result (e.g. `limit:1` returns one; a `since` in the future returns `[]`).

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 [P] Update `backend/README.md`: document the tightened completion path
  (`tasks.complete`/`tasks.reopen` are the only way to change status; `tasks.update` is
  title/owner/dueDate only) and the new `tasks.list` `filter` and `activity.list` actions,
  cross-linking `specs/003-.../contracts/api-003.md`. Note that this supersedes 001's
  status-via-update line.
- [X] T013 Deploy & validate: `cd backend && clasp push && clasp deploy -i <deploymentId>`,
  run `selfTest()` in the editor (expect `ALL PASS`), then walk
  `specs/003-tasks-crud-and-activity-log/quickstart.md` §2–5 against the live URL with a real
  token (no new scopes → no re-auth).

---

## Dependencies & Execution Order

- **Setup (T001)** → everything (summary/slice constants).
- **Foundational (T002)** → US1 (T003–T005).
- **US1 (P1)** → the MVP. T002 → T003 → T004 → T005 (T003/T004 both edit `Api.js`; T004 also
  removes the old stamping so it follows T003).
- **US2 (P1)** → independent of US1 except the shared `Api.js` file (T006 after T003/T004 to
  avoid edit conflicts). T006 → T007.
- **US3 (P2)** → independent; T009 (Sheets.js) → T010 (Api.js, after T006) → T011.
- **Polish (T012–T013)** → after the stories they document/validate.

Cross-file parallelism is limited (flat backend, few files). Genuinely parallel: **T001** and
**T012** are the only `[P]` tasks (distinct single-touch files), and even T012 documents work
that must exist first — so in practice run T001 first, then the sequential chain.

## Implementation Strategy

- **MVP = US1** (T001 → T002 → T003 → T004 → T005): a complete, idempotent task lifecycle with
  correct attribution. Shippable on its own.
- **Increment 2 = US2** (T006 → T007): the slices that make the owner model a daily tool.
- **Increment 3 = US3** (T009 → T010 → T011): the activity feed / completion awareness.
- **Finish** with T012 (docs) and T013 (deploy + live validation).
