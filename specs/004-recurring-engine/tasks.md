---
description: "Task list for feature 004 recurring-engine"
---

# Tasks: Recurring Chore Engine

**Input**: Design documents from `/specs/004-recurring-engine/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-004.md — all
present. Features 001 (schema/API/envelope/idempotent `createRecord_`), 002 (verified
`actor`), and 003 (task lifecycle + feed) are deployed.

**Tests**: As in 001–003, the plan chooses a manually-run `selfTest()` over a TDD runner
(Apps Script has none; "keep it boring"). Occurrence math and season logic are exercised as
in-process units; generation, idempotency, the tombstone, and rule CRUD are exercised with
live Sheet round-trips; the token/HTTP path is proven in the quickstart. No pre-written
failing-test tasks.

**Organization**: Tasks are grouped by user story (spec.md priorities). This feature is
**backend-only** — the UI is feature 006. **No schema columns are added** (the Recurring tab
already carries `lastGenerated`/`seasonStart`/`seasonEnd`); only one Settings row is seeded.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1–US3 for user-story-phase tasks only
- All paths are repo-relative; the Apps Script project is flat under `backend/`

## Path & shared-file note

Apps Script has no folders — every source file lives directly in `backend/`. Because several
tasks edit the same file, they are **sequential** (no `[P]`):

- `backend/Recurring.js` — **new file**; **T002, T003, T004, T007** (math → generator →
  trigger → rule CRUD helpers) → sequential.
- `backend/SelfTest.js` — **T005, T006, T009, T010** (new assertion blocks) → sequential.
- `backend/Config.js` (**T001**), `backend/Api.js` (**T008**), and `backend/README.md`
  (**T011**) are each touched once.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Constants + the one Settings key the generator and rule CRUD read. One file.

- [X] T001 [P] Update `backend/Config.js`: (a) add `REQUIRED_ON_CREATE.Recurring =
  ['title','cadence','anchorDate','defaultOwner']`; (b) add
  `RECURRING_LOOKAHEAD_DEFAULT_DAYS = 30` (research D6) and the trigger hour
  `RECURRING_TRIGGER_HOUR = 3` (research D7); (c) append `['recurringLookaheadDays','30',
  'feature 004; days ahead the nightly generator materializes (FR-016). Blank/≤0 ⇒ 30']` to
  `SETTINGS_SEED` (append-only; `seedSettings_` never overwrites a hand-set value); (d) bump
  `API_VERSION` to `'1.1.0'` (additive actions — contracts/api-004.md §Versioning). No
  `HEADERS`/`FIELD_TYPES` change (Recurring columns + `month` types already present).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure, dependency-free occurrence math + season test + deterministic id that
the generator (US1) and its catch-up behavior (US3) are built on. Nothing in US1/US3 works
until these exist. US2 (rule CRUD) does **not** depend on this phase.

**⚠️ CRITICAL**: US1 and US3 depend on T002.

- [X] T002 [US1] Create `backend/Recurring.js` with pure date helpers (no Sheet/network — unit
  testable), all operating on `YYYY-MM-DD` strings (research D3):
  - `daysInMonth_(year, month1to12)` and `addMonthsClamped_(ymd, months)` — step by calendar
    months clamping the day to the target month's length (Jan 31 +1mo → Feb 28/29; Feb 29
    +12mo → Feb 28 in common years).
  - `addDays_(ymd, n)` — calendar-day step for weekly/biweekly.
  - `occurrencesInWindow_(anchorDate, cadence, startExclusive, endInclusive)` → array of ISO
    dates: step from `anchorDate` by the cadence's unit (weekly +7d, biweekly +14d, monthly
    +1mo, quarterly +3mo, annually +12mo), **skipping** past occurrences `≤ startExclusive`,
    then collecting occurrences while `≤ endInclusive`. Returns `[]` if none.
  - `inSeason_(month1to12, seasonStart, seasonEnd)` — both-blank ⇒ `true` (year-round);
    else inclusive range with wrap-around: `s ≤ e ? (s ≤ m ≤ e) : (m ≥ s || m ≤ e)`
    (research D4).
  - `recurringTaskId_(recurringId, dueDate)` → `'r' + hex(MD5(recurringId + '|' + dueDate))`
    via `Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, …)` (research D1) — the
    idempotency key.
  Keep everything straight-line and comment the clamp/wrap edge cases (Principle IV).

---

## Phase 3: User Story 1 — A chore recurs on its own (Priority: P1) 🎯 MVP

**Goal**: The nightly generator materializes upcoming occurrences into ordinary Tasks,
idempotently, attributed to `system`, without ever resurrecting a deleted occurrence.

**Independent Test**: Seed a monthly rule anchored in the recent past (directly via
`createRecord_`), run `generateRecurringTasks()`, and verify the expected dated tasks exist
(title/owner from the rule, `recurringId` back-link, deterministic ids); a second run makes
no duplicates; deleting one occurrence and re-running does not re-create it; an out-of-season
rule generates nothing (spec US1 Independent Test; quickstart §3–4, §6).

- [X] T003 [US1] In `backend/Recurring.js` add `generateRecurringTasks()` — the trigger
  entry point (also editor-runnable). Read `recurringLookaheadDays` from `readSettingsMap_()`
  (fallback `RECURRING_LOOKAHEAD_DEFAULT_DAYS` when blank/≤0). Compute `today` as
  `Utilities.formatDate(new Date(), getTimezone_(), 'yyyy-MM-dd')`; `windowStart =
  rule.lastGenerated || addDays_(today, -1)`; `windowEnd = addDays_(today, lookahead)`. For
  each rule in `listRecords_(TABS.RECURRING)` (skips blank-id adoption automatically): call
  `occurrencesInWindow_(anchorDate, cadence, windowStart, windowEnd)`; for each occurrence
  whose month passes `inSeason_`, build a Task record `{ id: recurringTaskId_(rule.id, due),
  title: rule.title, dueDate: due, owner: rule.defaultOwner, status: 'open', recurringId:
  rule.id }` and call `createRecord_(TABS.TASKS, rec, 'system')` (idempotent replay dedupes —
  D1). Track the newest occurrence **considered** (created or season-skipped) as `highWater`;
  after the rule's occurrences, if `highWater` and it differs from `rule.lastGenerated`, call
  `updateRecordById_(TABS.RECURRING, rule.id, { lastGenerated: highWater }, 'system')` (logged
  only on change — D2/D5). Guard each rule in try/catch so one bad rule can't abort the run;
  log/skip on error. No outer lock — each `createRecord_`/`updateRecordById_` locks itself
  and is idempotent (Principle V).
- [X] T004 [US1] In `backend/Recurring.js` add `installRecurringTrigger()` (one-time,
  editor-run): iterate `ScriptApp.getProjectTriggers()`, delete any whose
  `getHandlerFunction() === 'generateRecurringTasks'`, then
  `ScriptApp.newTrigger('generateRecurringTasks').timeBased().atHour(RECURRING_TRIGGER_HOUR)
  .everyDays(1).create()`. Idempotent — re-running never stacks duplicate triggers
  (research D7). Add a short header comment that it must be run once from the editor after
  deploy (like `setupDatabase()`).
- [X] T005 [US1] In `backend/SelfTest.js` add `unitOccurrenceMath_()` (call it first from
  `selfTest()`, no Sheet needed): assert `addMonthsClamped_('2026-01-31', 1) === '2026-02-28'`
  and `('2028-01-31',1) === '2028-02-29'` (leap), `addDays_('2026-07-01', 14) === '2026-07-15'`;
  `occurrencesInWindow_('2026-06-15','monthly','2026-06-30','2026-09-30')` yields
  `['2026-07-15','2026-08-15','2026-09-15']` (skips the anchor ≤ start, stops at end);
  weekly/biweekly/quarterly/annually each produce the expected next date; `inSeason_(1,11,2)`
  true and `inSeason_(6,11,2)` false (wrap), `inSeason_(6,'','')` true (year-round);
  `recurringTaskId_('a','2026-07-15')` is deterministic (equal on repeat) and starts `'r'`.
- [X] T006 [US1] In `backend/SelfTest.js` add `liveRecurringGeneration_()` (call from
  `selfTest()`): create a rule via `createRecord_(TABS.RECURRING, { id: SELFTEST_PREFIX+…,
  title, cadence:'monthly', anchorDate:<~today−15d>, defaultOwner:'both' }, 'selftest')`; run
  `generateRecurringTasks()`; assert ≥1 Task with `recurringId === rule.id`, `owner:'both'`,
  `status:'open'`, id starting `'r'`, and `dueDate` within the window; assert the rule's
  `lastGenerated` is now non-blank. **Re-run** `generateRecurringTasks()` and assert the
  count of tasks with that `recurringId` is unchanged (no duplicates — SC-002). **Delete** one
  occurrence via `deleteRecordById_(TABS.TASKS, …)`, re-run, and assert it is **not**
  re-created (FR-013). Add an **out-of-season** rule (e.g. `seasonStart:'12',seasonEnd:'1'`,
  anchored/ran mid-year) and assert `generateRecurringTasks()` creates **no** tasks for it.
  Clean up every seeded rule + generated task.

**Checkpoint**: US1 is independently testable — generation is correct, idempotent, seasonal,
and tombstoned.

---

## Phase 4: User Story 2 — Manage the recurring chores themselves (Priority: P1)

**Goal**: Create/edit/delete Recurring rules over the JSON API, validated and logged, with
`lastGenerated` server-owned.

**Independent Test**: Through the handlers, create a rule, read it back, edit each field,
and delete it — asserting persistence, that a supplied `lastGenerated` is refused, that a
half-set season window is rejected, and that each change is logged (spec US2 Independent
Test; quickstart §2).

- [X] T007 [US2] In `backend/Recurring.js` add `createRecurring_(payload, actor)` and
  `updateRecurring_(payload, actor)` (mirroring `createTask_`/`updateTask_` in `Api.js`):
  - **create**: `rejectUnknownFields_(TABS.RECURRING, payload)`; refuse a supplied
    `lastGenerated` with `fail_('BAD_REQUEST', …, 'lastGenerated')` (research D8);
    `requireFields_(payload, REQUIRED_ON_CREATE.Recurring)`; `validateFields_(TABS.RECURRING,
    payload)`; `validateSeasonWindow_(payload.seasonStart, payload.seasonEnd)`;
    `fullRecord_(TABS.RECURRING, payload)`; force `rec.lastGenerated = ''`; return
    `createRecord_(TABS.RECURRING, rec, actor)`.
  - **update**: `rejectUnknownFields_`; `requireFields_(payload, ['id'])`; refuse
    `lastGenerated` (BAD_REQUEST); `validateFields_`; `mutablePatch_(TABS.RECURRING, payload)`;
    `updateRecordById_(TABS.RECURRING, id, patch, actor, invariant)` where `invariant(merged)`
    calls `validateSeasonWindow_(merged.seasonStart, merged.seasonEnd)` so setting/clearing
    one season bound is validated against the merged pair.
- [X] T008 [US2] In `backend/Api.js` register three `HANDLERS`:
  `'recurring.create': function (p, actor) { return { recurring: createRecurring_(p, actor) }; }`,
  `'recurring.update': function (p, actor) { return { recurring: updateRecurring_(p, actor) }; }`,
  and `'recurring.delete': function (p, actor) { return { id: deleteEntity_(TABS.RECURRING, p,
  actor) }; }` (reuses the generic `deleteEntity_`/`deleteRecordById_` — RECURRING is an
  `ID_TAB`). Leave the existing `recurring.list` untouched (contracts/api-004.md).
- [X] T009 [US2] In `backend/SelfTest.js` add `liveRecurringCrud_()` (call from `selfTest()`):
  `createRecurring_({ title, cadence:'weekly', anchorDate:'2026-06-01', defaultOwner:'max' },
  'selftest')` → assert stored with blank `lastGenerated`; `updateRecurring_` the title and a
  valid season pair → assert persisted; assert `createRecurring_`/`updateRecurring_` with
  `lastGenerated` set throws `BAD_REQUEST`; a half-season (`seasonStart` only) throws
  `VALIDATION_FAILED`; an unknown field throws `BAD_REQUEST`; `updateRecurring_` on a bad id
  throws `NOT_FOUND`. Delete via `deleteRecordById_(TABS.RECURRING, id, 'selftest')` and assert
  gone. Clean up.

**Checkpoint**: US2 is independently testable — rule CRUD round-trips, validates, and logs.

---

## Phase 5: User Story 3 — Catch up gracefully when idle (Priority: P2)

**Goal**: A never-generated rule with an old anchor produces a bounded, near-term set on
first run (no backlog), and later runs resume from the watermark.

**Independent Test**: Create a rule anchored far in the past, run the generator once, and
assert the number of tasks equals only the in-window occurrences (not one per elapsed cycle),
with `lastGenerated` advanced (spec US3 Independent Test; quickstart §3).

- [X] T010 [US3] In `backend/SelfTest.js` add `liveRecurringCatchUp_()` (call from
  `selfTest()`): create a **monthly** rule anchored ~2 years in the past (blank
  `lastGenerated`), run `generateRecurringTasks()`, and assert the count of tasks with that
  `recurringId` is **≤ 2** (only occurrences within the 30-day window — bounded, not ~24 —
  SC-003) and that all their `dueDate`s are `≥ today` and `≤ today+30d`. Assert the rule's
  `lastGenerated` is now set (resume point). Clean up. (No production code — US3 behavior is
  inherent in T003's window logic; this phase proves the bound.)

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T011 [P] Update `backend/README.md`: document the Recurring rule model, the
  `recurring.create/update/delete` actions (and that `lastGenerated` is generator-managed /
  refused on writes), the nightly generator + `installRecurringTrigger()`, the
  `recurringLookaheadDays` Setting, and the idempotency/tombstone design (deterministic ids +
  `lastGenerated` high-water). Cross-link `specs/004-recurring-engine/contracts/api-004.md`.
- [X] T012 Deploy & validate: `cd backend && clasp push && clasp deploy -i <deploymentId>`;
  in the editor run `setupDatabase()` (seeds `recurringLookaheadDays`), `selfTest()` (expect
  `ALL PASS`), and `installRecurringTrigger()` (confirm exactly one trigger under Triggers);
  then walk `specs/004-recurring-engine/quickstart.md` §2–7 against the live URL with a real
  token (no new scopes → no re-auth).

---

## Dependencies & Execution Order

- **Setup (T001)** → everything (required-fields, lookahead default, Settings seed, version).
- **Foundational (T002)** → US1 (T003, T005, T006) and US3 (T010).
- **US1 (P1)** → the MVP. T002 → T003 → T004 (both in `Recurring.js`, sequential) → T005 →
  T006 (both in `SelfTest.js`, sequential; T006 needs T003).
- **US2 (P1)** → independent of US1's generator, but T007 shares `Recurring.js` (after
  T003/T004 to avoid edit conflicts) and needs T001's `REQUIRED_ON_CREATE.Recurring`. T007 →
  T008 (Api.js) → T009 (SelfTest.js).
- **US3 (P2)** → needs T003 (generator) + T002; T010 is a `SelfTest.js` block (after T006/T009
  in that file).
- **Polish (T011–T012)** → after the stories they document/validate.

Cross-file parallelism is limited (flat backend, two main files). Genuinely parallel:
**T001** (Config.js) and **T011** (README.md) are the only `[P]` tasks — distinct single-touch
files. Everything else serializes on `Recurring.js` or `SelfTest.js`.

## Implementation strategy

- **MVP = Setup + Foundational + US1** (T001–T006): the generator materializes chores
  idempotently with the tombstone — the feature's whole reason to exist. Rules can be seeded
  by hand in the Sheet (SC-006) until US2 lands.
- **Increment 2 = US2** (T007–T009): rule management over the API, so the household stops
  hand-editing the Sheet.
- **Increment 3 = US3 + Polish** (T010–T012): prove the catch-up bound, document, deploy,
  install the trigger, and validate live.
