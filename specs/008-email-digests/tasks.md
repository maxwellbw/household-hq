---

description: "Task list for Email Digests (008)"
---

# Tasks: Email Digests (email-digests)

**Input**: Design documents from `/specs/008-email-digests/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/digest-contract.md](contracts/digest-contract.md), [quickstart.md](quickstart.md)

**Tests**: `SelfTest.js` cases are included per plan.md (project convention — every backend
feature ships pure-logic self-test coverage; see CLAUDE.md Definition of Done).

**Organization**: Tasks are grouped by user story (US1 = weekly, US2 = monthly, US3 =
schedule/robustness) so each can be implemented and validated independently, per plan.md's
single-file design (`backend/Digests.js` owns the feature).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Nearly all logic lives in one new file (`backend/Digests.js`), built up incrementally, so
  most tasks are **sequential** even within a story — [P] is reserved for genuinely
  independent files (`Config.js`, `appsscript.json`).

## Path Conventions

Backend-only Apps Script project: `backend/*.js`, `backend/appsscript.json`. No frontend, no
new Sheet tab.

---

## Phase 1: Setup

**Purpose**: Config/schema groundwork every story needs — new Settings keys, constants, OAuth
scope. No digest logic yet.

- [X] T001 [P] Add `https://www.googleapis.com/auth/script.send_mail` to `oauthScopes` in `backend/appsscript.json`
- [X] T002 [P] In `backend/Config.js`: remove the placeholder `digestSchedule` seed row and add the five `SETTINGS_SEED` rows (`digestWeeklyEnabled=TRUE`, `digestWeeklyDay=Sunday`, `digestMonthlyEnabled=TRUE`, `digestMonthlyDay=last`, `digestHour=7`) per [data-model.md](data-model.md)
- [X] T003 [P] In `backend/Config.js`: add `DIGEST_TRIGGER_HOUR = 6` constant, `OWNER_EMAIL_HUE` map (`max:'#3E6E68'`, `jaz:'#7E4A5E'`, `both:'#C6613F'`), add `'digest-weekly': 'emailed the week ahead'` and `'digest-monthly': 'emailed the month ahead'` to `ACTION_VERBS`, and bump `API_VERSION` patch
- [X] T004 Create `backend/Digests.js` with the file header comment (mirroring `CalendarSync.js`'s style — purpose, public entry points, internal helpers) and empty structure; no logic yet

**Checkpoint**: Schema/config ready; `setupDatabase()` will seed the new keys on next run; no digest behavior exists yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared building blocks every user story's send path needs — Settings
resolution, item selection, rendering, dedupe, and the mail wrapper. Nothing here is
recipient- or period-specific; US1/US2/US3 all call into this.

**⚠️ CRITICAL**: No user story task can be completed until this phase is done — `sendDigests`,
the manual kicks, and every self-test case depend on these helpers existing.

- [X] T005 [US: shared] In `backend/Digests.js`: `resolveWeekday_(settings)` — parses `digestWeeklyDay` (name or 0–6), falls back to Sunday (0) on blank/invalid, per [data-model.md](data-model.md) validation rules
- [X] T006 In `backend/Digests.js`: `resolveMonthlyDay_(settings, year, month)` — parses `digestMonthlyDay` (`last` or 1–28), resolves `last` to that month's actual final day (handles Feb/30-day months), falls back to `last` on blank/invalid
- [X] T007 In `backend/Digests.js`: `resolveHour_(settings)` and `isEnabled_(settings, key)` — hour 0–23 falling back to `DIGEST_TRIGGER_HOUR`; boolean-ish parse (`TRUE`/`true`/`1`/`yes`) falling back to `TRUE` on blank/invalid
- [X] T008 In `backend/Digests.js`: `relevantItemsFor_(person, windowStart, windowEnd, events, tasks)` — pure function implementing the inclusion predicate from [data-model.md](data-model.md) §Item: events by `owner ∈ {person, both}` + `start` date in window; tasks by `owner ∈ {person, both}` + non-blank `dueDate` in window + `status ∈ {open, snoozed}`; returns items sorted by date (then time)
- [X] T009 In `backend/Digests.js`: `renderHtml_(person, kind, window, items)` and `renderText_(person, kind, window, items)` — build the HTML body (inline owner-color styles from `OWNER_EMAIL_HUE`, grouped by day) and plain-text fallback (`[Max]`/`[Jaz]`/`[Both]` labels), each producing the FR-009 empty-state message when `items.length === 0`
- [X] T010 In `backend/Digests.js`: `buildDigest_(person, kind, window, events, tasks)` — composes T008 + T009 into `{ person, kind, window, items, count, subject, html, text }` per [data-model.md](data-model.md) §Digest, with kind-appropriate subject text (e.g. "Your week ahead — ...", "... at a glance")
- [X] T011 In `backend/Digests.js`: `periodKey_(kind, window, person)` — deterministic key builder (`weekly/<yyyy-MM-dd>/<person>`, `monthly/<yyyy-MM>/<person>`) using `getTimezone_()`-correct date formatting
- [X] T012 In `backend/Digests.js`: `alreadySent_(action, targetId)` — scans `readTable_(TABS.ACTIVITY_LOG)` for a matching `action`+`targetId` row (research D2)
- [X] T013 In `backend/Digests.js`: `sendOne_(person, digest, settings)` — resolves the recipient email (`maxEmail`/`jazEmail`), skips with no error if blank (FR-010), otherwise calls `MailApp.sendEmail({ to, subject, htmlBody: digest.html, body: digest.text })`, appends the ActivityLog row via `appendLog_`, wrapped with the project's `withLock_` pattern around the check-send-log sequence (research D3)

**Checkpoint**: All shared digest machinery exists and is independently unit-testable; no
public entry point wires them together yet — that's each user story's job.

---

## Phase 3: User Story 1 - Sunday "week ahead" email, personalized per person (Priority: P1) 🎯 MVP

**Goal**: Every Sunday (or whenever configured), Max and Jaz each get their own email with the
events + dated tasks relevant to them for the next 7 days.

**Independent Test**: Populate the Sheet with mixed-owner events/tasks in and out of the next-7-day window; run `sendWeeklyDigestNow()`; confirm two correctly-filtered, date-ordered emails and two `digest-weekly` ActivityLog rows.

### Tests for User Story 1

- [X] T014 [P] [US1] In `backend/SelfTest.js`: add cases for `relevantItemsFor_`/`buildDigest_` weekly window boundaries — includes today and today+6, excludes today−1 and today+7 (FR-001, FR-013)
- [X] T015 [P] [US1] In `backend/SelfTest.js`: add cases asserting owner filtering for a weekly build — `max`-owned item in Max's digest only, `both`-owned item in both, `jaz`-owned item never in Max's (FR-003, FR-004)
- [X] T016 [P] [US1] In `backend/SelfTest.js`: add case asserting completed/deleted and no-due-date tasks never appear in a weekly build (FR-014)

### Implementation for User Story 1

- [X] T017 [US1] In `backend/Digests.js`: `weeklyWindow_(today)` — returns `{ start: today, end: today+6 }` inclusive, household-tz correct
- [X] T018 [US1] In `backend/Digests.js`: `runWeekly_(settings, events, tasks, today)` — for each person with a resolved recipient email, builds the weekly digest via T010/T017, checks `alreadySent_` via T011/T012, and sends via T013 if due
- [X] T019 [US1] In `backend/Digests.js`: public `sendWeeklyDigestNow()` — reads Settings + Events + Tasks tabs, computes `today`, calls `runWeekly_` unconditionally (bypasses only the weekday gate, per contracts/digest-contract.md)
- [X] T020 [US1] In `backend/Digests.js`: public `sendDigests()` — reads Settings once, and if `isEnabled_(settings, 'digestWeeklyEnabled')` and today's weekday matches `resolveWeekday_(settings)`, calls `runWeekly_` (monthly branch added in US2)

**Checkpoint**: `sendWeeklyDigestNow()` and the weekly half of `sendDigests()` are fully
functional and independently testable — run Scenario A from [quickstart.md](quickstart.md).

---

## Phase 4: User Story 2 - End-of-month "next month" email, personalized per person (Priority: P2)

**Goal**: Near month-end, Max and Jaz each get their own email covering all of next calendar month's relevant events/tasks.

**Independent Test**: Populate the Sheet across this month, next month, and the month after; run `sendMonthlyDigestNow()`; confirm each person's email covers exactly next month's relevant items and two `digest-monthly` ActivityLog rows appear.

### Tests for User Story 2

- [X] T021 [P] [US2] In `backend/SelfTest.js`: add cases for monthly window boundaries — includes first/last day of next month, excludes this month and two-months-out (FR-002, FR-013)
- [X] T022 [P] [US2] In `backend/SelfTest.js`: add case for `resolveMonthlyDay_`'s `last`-day resolution across a short month (February) and a 30-day month (FR-002, research D1)
- [X] T023 [P] [US2] In `backend/SelfTest.js`: add case asserting owner filtering for a monthly build, mirroring T015 (FR-003, FR-004)

### Implementation for User Story 2

- [X] T024 [US2] In `backend/Digests.js`: `monthlyWindow_(today)` — returns `{ start: firstOfNextMonth, end: lastOfNextMonth }`, household-tz correct
- [X] T025 [US2] In `backend/Digests.js`: `runMonthly_(settings, events, tasks, today)` — mirrors T018 for the monthly kind, using T024 + `resolveMonthlyDay_`
- [X] T026 [US2] In `backend/Digests.js`: public `sendMonthlyDigestNow()` — mirrors T019 for monthly, bypassing only the day-of-month gate
- [X] T027 [US2] In `backend/Digests.js`: extend `sendDigests()` (T020) with the monthly branch — if `isEnabled_(settings, 'digestMonthlyEnabled')` and today's day-of-month matches `resolveMonthlyDay_`, calls `runMonthly_`

**Checkpoint**: Both digest types are fully functional independently and together — run
Scenario B from [quickstart.md](quickstart.md).

---

## Phase 5: User Story 3 - Digests run unattended, are configurable, and degrade gracefully (Priority: P3)

**Goal**: The schedule is hand-editable in Settings (including on/off), missing-email and
empty-window cases degrade gracefully, and re-fires never double-send.

**Independent Test**: Flip Settings values and re-run per [quickstart.md](quickstart.md) Scenarios C–F — confirm no double-send, graceful missing-email skip, friendly empty-state email, and schedule/on-off changes take effect without a trigger reinstall.

### Tests for User Story 3

- [X] T028 [P] [US3] In `backend/SelfTest.js`: add case for `alreadySent_` — returns true after a matching ActivityLog row exists, false otherwise (FR-011)
- [X] T029 [P] [US3] In `backend/SelfTest.js`: add case for `sendOne_`'s missing-email skip path — no error, no ActivityLog row, when the recipient's Settings email is blank (FR-010)
- [X] T030 [P] [US3] In `backend/SelfTest.js`: add case asserting `buildDigest_` with zero items produces a non-blank, clearly-worded empty-state `html`/`text` (FR-009)
- [X] T031 [P] [US3] In `backend/SelfTest.js`: add case asserting `sendDigests()` and `installDigestTrigger()` exist as public (non-underscore) functions and `sendDigests()` runs without throwing on a non-send day (no-op) — per the CLAUDE.md trigger/editor entry-point rule

### Implementation for User Story 3

- [X] T032 [US3] In `backend/Digests.js`: public `installDigestTrigger()` — deletes any existing `sendDigests` trigger, installs a new daily trigger at `resolveHour_(readSettingsMap_())` (mirroring `installCalendarTrigger()`'s idempotent delete-then-create pattern)
- [X] T033 [US3] Verify `Setup.js` requires no code change — confirm `seedSettings_`/`migrateHeaders_` pick up the T002 Settings keys automatically on the next `setupDatabase()` run (inspection task, no file edit expected)

**Checkpoint**: All three user stories work independently and together; the feature is safe to
leave running unattended.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final repo-wide consistency and live validation.

- [X] T034 Update `BACKLOG.md`: mark feature 008 stage and add the "007 merged" active-feature summary once implementation + validation complete (per CLAUDE.md workflow)
- [X] T035 Run `selfTest()` in the Apps Script editor and confirm **ALL PASS** across all cases added in T014–T016, T021–T023, T028–T031
- [X] T036 Run [quickstart.md](quickstart.md) Scenarios A–F end-to-end against real inboxes and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs `OWNER_EMAIL_HUE`, `ACTION_VERBS`, Settings keys from T001–T003) — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational completion. Extends `sendDigests()` from US1 (T020) — implement after US1 for a clean single-file diff, though its own logic (T024–T026) has no functional dependency on US1's weekly logic.
- **User Story 3 (Phase 5)**: Depends on Foundational completion; `installDigestTrigger()` (T032) is independent of US1/US2 content but is most useful once both digest types exist.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### Within Each User Story

- Self-test cases (if written first per TDD) precede their implementation task, but since these
  test pure functions, writing implementation first and tests immediately after (T014-16 after
  T008-T010 exist) is equally valid — both orders are listed together per phase for clarity.
- Window builder → run\_ orchestrator → public entry point, in that order (each depends on the
  previous within its story).

### Parallel Opportunities

- T001–T003 (Setup) touch different files/regions and can run in parallel.
- Within each story's Tests block, all `SelfTest.js` cases are additive to the same file but
  cover independent assertions — safe to write in one pass; marked [P] to signal no
  cross-dependency in what they assert.
- US1 and US2 implementation tasks (T017–T020 vs. T024–T027) touch the same file
  (`Digests.js`) — **not safely parallel** even though independently testable; implement
  sequentially to avoid merge conflicts within one file.

---

## Parallel Example: Setup

```bash
Task: "Add script.send_mail scope in backend/appsscript.json"
Task: "Add Settings seed rows in backend/Config.js"
Task: "Add DIGEST_TRIGGER_HOUR/OWNER_EMAIL_HUE/ACTION_VERBS in backend/Config.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (weekly digest)
4. **STOP and VALIDATE**: run Scenario A from quickstart.md against real inboxes
5. Deploy/demo if ready — the household already gets weekly digests even without monthly

### Incremental Delivery

1. Setup + Foundational → shared machinery ready, nothing sends yet
2. Add US1 → weekly digest live → validate (Scenario A) → deploy
3. Add US2 → monthly digest live → validate (Scenario B) → deploy
4. Add US3 → configurable schedule + graceful degradation → validate (Scenarios C–F) → deploy
5. Polish → BACKLOG update, full selftest, full quickstart pass

---

## Notes

- [P] tasks = different files or independently-assertable test cases, no dependencies
- [Story] label maps task to specific user story for traceability
- Nearly all implementation lives in one new file (`backend/Digests.js`) built up in strict
  layers: Settings resolvers → item selection → rendering → digest composition → dedupe/send →
  per-story orchestration → public entry points. Each task assumes the prior layer exists.
- Verify `selfTest()` prints ALL PASS after each story's test tasks, not just at the end
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently per quickstart.md
