---
description: "Task list for feature 007 gcal-sync"
---

# Tasks: Google Calendar Sync (gcal-sync)

**Input**: Design documents from `/specs/007-gcal-sync/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-007.md — all
present. Features 001 (schema/API/envelope/idempotent `createRecord_`), 002 (verified `actor`),
003 (task lifecycle: `completeTask_`/`reopenTask_`; Events CRUD), 004 (`addDays_`, trigger
installer pattern, `script.scriptapp` scope), 005 (on-save + nightly reconciler pattern,
`migrateHeaders_` additive column migration), and 006 (frontend, unaffected) are deployed.

**Tests**: As in 001–005, the plan uses a manually-run `runSelfTest()` (Apps Script has no TDD
runner; "keep it boring"). Pure builders/predicates are exercised as in-process units; the
mirror/idempotency/reconcile/orphan-sweep behavior is exercised with **guarded** live
Sheet+Calendar round-trips (skipped when `householdCalendarId` is blank; self-cleaning). The
token/HTTP path and both-phone notifications are proven in [quickstart.md](quickstart.md). No
pre-written failing-test tasks.

**Organization**: Tasks are grouped by user story (spec.md priorities). **Backend-only** — no
frontend change. **One schema column** (`gcalEventId` on Tasks) is added via the existing
generic `migrateHeaders_` in `setupDatabase()` (no Setup.js code change; re-run once). **One new
OAuth scope** (`calendar`) requires a one-time re-authorization by the shared deploying account.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1–US3 for user-story-phase tasks only
- All paths are repo-relative; the Apps Script project is flat under `backend/`

## Path & shared-file note

Apps Script has no folders — every source file lives directly in `backend/`. Because several
tasks edit the same file, they are **sequential** (no `[P]`):

- `backend/CalendarSync.js` — **new file**; **T003, T004, T006, T009, T012** (config/guard +
  pure builders → pointer/resolver plumbing → events brain → tasks brain → nightly reconcile +
  installer) → sequential.
- `backend/Api.js` — **T007, T010** (wire events mirror → wire tasks mirror) → sequential.
- `backend/SelfTest.js` — **T005, T008, T011, T013** (new assertion blocks) → sequential.
- `backend/Config.js` (**T001**), `backend/appsscript.json` (**T002**), `backend/README.md`
  (**T014**) are each touched once.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema column, constants, color map, Settings seed, and the new scope — the shared
prerequisites every story reads.

- [X] T001 [P] Update `backend/Config.js`: (a) append `'gcalEventId'` to `HEADERS.Tasks`
  (data-model.md §Tasks — plain-text mirror pointer); (b) add `GCAL_TRIGGER_HOUR = 5` (research
  D8 — offset from 004's hour 3 and 005's hour 4 so the three nightly jobs don't contend); (c)
  add `OWNER_EVENT_COLOR = { max: CalendarApp.EventColor.CYAN, jaz: CalendarApp.EventColor.MAUVE,
  both: CalendarApp.EventColor.ORANGE }` (research D4 / data-model.md color table); (d) append to
  `SETTINGS_SEED`: `['gcalEventReminderMin','30','feature 007; popup minutes before a timed
  event']` and `['gcalTaskReminderTime','09:00','feature 007; morning-of popup time for all-day
  task entries']`; (e) add `'gcal-sync': 'synced to calendar'` to `ACTION_VERBS` (research D9 —
  so the 003 feed renders it); (f) bump `API_VERSION` `'1.2.0'` → `'1.3.0'` (additive —
  contracts/api-007.md). No new `FIELD_TYPES` (`gcalEventId` is free text).

- [X] T002 [P] Update `backend/appsscript.json`: add `"https://www.googleapis.com/auth/calendar"`
  to `oauthScopes` (research D7 — broad read+write so feature 011 needs no re-auth). Manifest
  change ⇒ deploy step is `clasp push --force` + redeploy + the shared account re-authorizes once
  (CLAUDE.md scope gotcha).

**Checkpoint**: `clasp push` succeeds; the Tasks tab gains `gcalEventId` and Settings gains the
two keys after re-running `setupDatabase()` (validated in the deploy step, not a code task).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared `CalendarSync.js` plumbing that both the events and tasks brains call.
No mirroring behavior yet — pure builders, the calendar resolver + no-op guard, the locked
pointer writer, and the stale-pointer resolver.

**⚠️ BLOCKS all user stories.**

- [X] T003 Create `backend/CalendarSync.js` with the config/guard + **pure builders**
  (research D4/D5/D6): `getHouseholdCalendar_()` → reads `readSettingsMap_()['householdCalendarId']`
  and returns `CalendarApp.getCalendarById(id)` or `null` when blank/unresolvable (FR-014
  no-op); `ownerLabel_(owner)` → `Max`/`Jaz`/`Both`; `buildEntryTitle_(owner, title)` →
  `'[' + label + '] ' + title`; `ownerColor_(owner)` → `OWNER_EVENT_COLOR`; `todayYmd_()` and
  `graceStartYmd_()` (today − 1 via `addDays_`, household tz); `isEventDesired_(event)` (`end`
  date-part ≥ today) and `isTaskDesired_(task)` (`dueDate` non-empty AND ≥ today AND
  `status ∈ {open,snoozed}`); `taskReminderMinutesFromMidnight_(hhmm)` parsing
  `gcalTaskReminderTime` (default `09:00`). File header comment mirrors `PrepTasks.js` style
  (reuses `addDays_`, `getTimezone_`, `readSettingsMap_`; dependency-free).

- [X] T004 In `backend/CalendarSync.js`, add the **pointer/resolver plumbing**: `resolveGcalEvent_(calendar, id)`
  → `calendar.getEventById(id)` returning `null` on missing/stale (FR-015, no throw);
  `setGcalPointer_(tabName, recordId, gcalEventId, detail)` — a **locked** single-cell writer
  (mirrors `readTableForWrite_`'s adoption write: `withLock_` → `readTable_` → find row → set the
  `gcalEventId` cell via `getRange(row, col+1)` with `setNumberFormat('@')` then `setValue`) that
  appends one `appendLog_('system','gcal-sync', recordId, detail)` row (research D9);
  `applyReminders_(calEvent, minutesBefore)` → `resetRemindersToDefault()`/`removeAllReminders()`
  then `addPopupReminder(minutesBefore)`; and a `tagEntry_(calEvent, kind, id)` helper
  (`setTag('hhqKind', kind)`, `setTag('hhqId', id)`).

- [X] T005 In `backend/SelfTest.js`, add a **unit block** (no Sheet/Calendar) asserting:
  `buildEntryTitle_('jaz','Vet')` === `'[Jaz] Vet'`; `ownerLabel_` for all three owners;
  `ownerColor_` maps to the three distinct `EventColor`s; `isTaskDesired_` true for
  open+future-dated, false for done / undated / past; `isEventDesired_` boundary at today;
  `taskReminderMinutesFromMidnight_('09:00')` === 540. Register it in `runSelfTest()`.

**Checkpoint**: `runSelfTest()` passes the new unit block; no mirroring wired yet.

---

## Phase 3: User Story 1 — Events mirror to the calendar (Priority: P1) 🎯 MVP

**Goal**: Creating/editing/deleting an event in the app creates/updates/removes exactly one
matching entry on the Household calendar, with owner prefix+color and a pre-start reminder.

**Independent test**: Create→edit→delete an event; confirm one calendar entry tracks it (or
none after delete), re-sync makes no duplicate (spec US1 Acceptance 1–5).

- [X] T006 [US1] In `backend/CalendarSync.js`, implement `syncCalendarForEvent_(event, actor)`
  (research D2/D3; data-model.md lifecycle): resolve `getHouseholdCalendar_()` (null ⇒ return,
  FR-014); read `event.gcalEventId`; if **not desired** → if pointer set, delete the resolved
  entry + `setGcalPointer_(EVENTS, id, '')` + log; if **desired** → if pointer blank or resolves
  to null, `createEvent(buildEntryTitle_, start, end)`, `setColor`/`applyReminders_(…,
  gcalEventReminderMin)`/`tagEntry_('event', id)`, then `setGcalPointer_` with the new id; if it
  resolves, update in place (`setTitle`/`setTime`/`setColor`/reminders). Times via `getTimezone_`
  (FR-008). Wrap each Calendar op so one failure is contained.

- [X] T007 [US1] In `backend/Api.js`, call `syncCalendarForEvent_` from `createEvent_` (on the
  re-read created event), `updateEvent_` (on the merged event), and `deleteEvent_` (build a
  minimal `{id, gcalEventId}` from the pre-delete record so the entry can be removed) — each
  inside a `try/catch` that `console.error`s and swallows so a Calendar failure never fails the
  API write (contracts/api-007.md; FR-010). `deleteEvent_` must capture the event's
  `gcalEventId` **before** `deleteRecordById_` removes the row.

- [X] T008 [US1] In `backend/SelfTest.js`, add a **guarded live block** (skip + log when
  `householdCalendarId` blank; self-cleaning): create a temp future event via `createEvent_`,
  assert exactly one calendar entry with title `[Owner] …` and the mapped color, and a non-blank
  `gcalEventId`; update its start, assert the same entry id moved (no duplicate); call
  `syncCalendarForEvent_` again, assert no change; blank the pointer cell by hand and re-sync,
  assert re-create (stale-pointer path); delete the event, assert the entry is gone. Delete any
  stray created calendar events in a `finally`.

**Checkpoint**: US1 fully works — events mirror end-to-end and are idempotent. This is the MVP.

---

## Phase 4: User Story 2 — Dated tasks mirror as all-day entries (Priority: P2)

**Goal**: A task with a due date appears as an all-day entry with a morning-of reminder;
undated tasks don't; completing/deleting/undating removes it; a date change moves it.

**Independent test**: Create a dated task + an undated task; only the dated one appears; change
its date (moves), complete it (removed), reopen (reappears) — spec US2 Acceptance 1–5.

- [X] T009 [US2] In `backend/CalendarSync.js`, implement `syncCalendarForTask_(task, actor)`:
  same pointer/desired branching as T006 but using `isTaskDesired_` and
  `createAllDayEvent(buildEntryTitle_, dateFromYmd_(task.dueDate))`; reminder =
  `applyReminders_(entry, taskReminderMinutesFromMidnight_(gcalTaskReminderTime))` (research D5,
  morning-of); `tagEntry_('task', id)`; pointer stored on the **Tasks** tab. On date change,
  update the all-day date in place (or delete+recreate if the API can't move an all-day event
  cleanly — keep it one entry). Not-desired (done/undated/past/deleted) ⇒ delete + clear pointer.

- [X] T010 [US2] In `backend/Api.js`, call `syncCalendarForTask_` (try/catch, swallow) from
  `createTask_` (created task), `updateTask_` (merged task — covers dueDate change / clear /
  owner change), `completeTask_` and `reopenTask_` (on the returned task when `changed`), and the
  tasks delete path (`deleteEntity_(TABS.TASKS,…)` — capture `gcalEventId` before the row is
  removed, mirroring T007's delete handling). Note: `completeTask_`/`reopenTask_` currently
  return `{task, changed}` — mirror only when `changed` (a no-op completion needn't re-sync).

- [X] T011 [US2] In `backend/SelfTest.js`, add a **guarded live block** (self-cleaning): create a
  dated future task → assert one all-day entry `[Owner] …`, mapped color, non-blank
  `gcalEventId`; create an undated task → assert no entry; change the due date → assert the same
  entry moved; `completeTask_` → assert entry removed + pointer cleared; `reopenTask_` → assert
  entry re-created; delete → assert gone. Clean up in `finally`.

**Checkpoint**: US1 + US2 both work — events and dated tasks both mirror with notifications.

---

## Phase 5: User Story 3 — Self-healing nightly reconcile + orphan sweep (Priority: P3)

**Goal**: A scheduled job brings the calendar into agreement with the Sheet with no duplicates,
including deleting entries whose backing row was removed directly in the Sheet.

**Independent test**: Hand-delete/rename calendar entries and hand-delete a Sheet row; run the
reconcile; confirm re-create/correct/orphan-delete and a `gcal-sync` log per action (spec US3).

- [X] T012 [US3] In `backend/CalendarSync.js`, implement the **public** trigger entry point
  `syncCalendar()` (no trailing underscore — CLAUDE.md): iterate `listRecords_(TABS.EVENTS)` →
  `syncCalendarForEvent_` and `listRecords_(TABS.TASKS)` → `syncCalendarForTask_`, each in a
  per-record `try/catch` (isolation, mirroring `generatePrepTasks`); then the **orphan sweep** —
  build the desired-id set (all current event/task ids), `calendar.getEvents(graceStart, farFuture)`,
  keep only entries with a `getTag('hhqId')`, and `deleteEvent()` any whose `hhqId` ∉ desired set
  (FR-010, hand-deleted rows) with a `gcal-sync` log. Also add the **public**
  `installCalendarTrigger()` (idempotent: delete any existing `syncCalendar` trigger, then
  `newTrigger('syncCalendar').timeBased().atHour(GCAL_TRIGGER_HOUR).everyDays(1).create()`),
  mirroring `installRecurringTrigger`/`installPrepTrigger`.

- [X] T013 [US3] In `backend/SelfTest.js`, add a **guarded live block** (self-cleaning): seed an
  event + dated task and sync; delete one calendar entry by hand and rename another, run
  `syncCalendar()`, assert re-create + correction; create a tagged calendar entry with an
  `hhqId` that matches no row (or delete a Sheet row that has a pointer), run `syncCalendar()`,
  assert the orphan is deleted. Verify a `gcal-sync` ActivityLog row exists per action. Clean up
  in `finally`.

**Checkpoint**: All three stories work; the sync is hands-off and self-healing.

---

## Phase 6: Polish & Cross-Cutting

- [X] T014 [P] Update `backend/README.md`: document `CalendarSync.js` (the mirror brain, the
  immediate + nightly paths, the pointer/tag idempotency model), the one-time setup
  (`setupDatabase()` re-run for the column/Settings, set `householdCalendarId`,
  `installCalendarTrigger()`, the shared account's `calendar`-scope re-auth), the `gcal-sync` log
  action, and the hand-clear-`gcalEventId` repair lever.

- [ ] T015 Deploy + live-validate per [quickstart.md](quickstart.md): `clasp push --force` +
  redeploy, re-authorize the shared account, re-run `setupDatabase()`, set `householdCalendarId`,
  run `installCalendarTrigger()`, then walk Scenarios A–G (incl. the Scenario D reminder-timing
  check on both phones, with the research-D5 all-day→timed fallback if the morning popup
  misfires). **User-run** (browser OAuth + phones).

---

## Dependencies & execution order

- **Setup (T001, T002)** — parallelizable (different files); both precede everything.
- **Foundational (T003 → T004 → T005)** — sequential (same new file, then its unit test).
  **Blocks US1/US2/US3.**
- **US1 (T006 → T007 → T008)** — sequential (CalendarSync brain → Api wiring → SelfTest). MVP.
- **US2 (T009 → T010 → T011)** — depends only on Foundational; independent of US1 (different
  brain function + different Api handlers), but T009/T006 share `CalendarSync.js` and T010/T007
  share `Api.js`, so in practice run after US1 to avoid edit collisions.
- **US3 (T012 → T013)** — depends on US1 + US2 (its reconcile calls both brains).
- **Polish (T014 [P], T015)** — after the stories; T015 is the user-run deploy/validation gate.

## Parallel opportunities

- **T001 ‖ T002** (Config.js ‖ appsscript.json).
- Across stories, `SelfTest.js` blocks (T005/T008/T011/T013) are logically independent but edit
  one file → keep sequential.
- **T014** can be drafted in parallel with late implementation.

## Implementation strategy

- **MVP = Phase 1 + Phase 2 + Phase 3 (US1)**: events mirror to the calendar with notifications —
  a complete, shippable slice of the feature's value on its own.
- Then **US2** (dated tasks) and **US3** (self-healing reconcile) layer on incrementally, each
  independently testable via its guarded SelfTest block before the live quickstart.
