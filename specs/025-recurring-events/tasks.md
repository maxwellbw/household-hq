---
description: "Task list for feature 025 recurring-events"
---

# Tasks: Recurring Events

**Input**: Design documents from `/specs/025-recurring-events/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/recurring-events.md
— all present. Features 001 (schema/API/envelope/idempotent `createRecord_`), 002 (verified
`actor`), 004 (recurrence engine + occurrence math), and 005 (event prep templates +
`syncPrepForEvent_`) are deployed.

**Tests**: As in 004/005, the plan uses a manually-run `selfTest()` (Apps Script has no TDD
runner; "keep it boring") for the backend, plus Vitest for new frontend units. Occurrence
math and timing derivation are exercised as in-process units; generation, idempotency,
never-resurrect, prep, cascade-delete, and rule CRUD are exercised with live Sheet
round-trips; the token/HTTP path is proven in the quickstart. No pre-written failing-test
tasks.

**Organization**: Tasks are grouped by user story (spec.md priorities — US1, US2, US3 are
all P1). One backend file is added and small additive edits touch shared files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1–US3 for user-story-phase tasks only
- All paths are repo-relative; the Apps Script project is flat under `backend/`

## Path & shared-file note

Apps Script has no folders — every source file lives directly in `backend/`. Files touched
by multiple tasks run **sequentially** (no `[P]`):

- `backend/RecurringEvents.js` — **new file**; **T004, T005, T006, T009, T011** (math →
  generator → trigger → prep wiring → rule CRUD) → sequential.
- `backend/SelfTest.js` — **T008, T010, T013** (new assertion blocks) → sequential.
- `backend/Config.js` (**T001**), `backend/Validation.js` (**T002**), `backend/Setup.js`
  (**T003**), `backend/Api.js` (**T012**) each touched once.
- Frontend: `domain.ts` (**T014**) → `useRecurringEvents.ts` (**T015**) →
  `RecurringEventsManager.tsx` (**T016**) → `MoreView.tsx` (**T017**) form a dependency
  chain; the component test (**T018**) follows the component.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema, enums, constants, and the one Settings key the generator + CRUD read.

- [X] T001 Update `backend/Config.js`: (a) add `TABS.RECURRING_EVENTS = 'RecurringEvents'`;
  (b) add `HEADERS.RecurringEvents = ['id','title','cadence','anchorDate','startTime',
  'durationMinutes','defaultOwner','templateId','location','notes','seasonStart','seasonEnd',
  'lastGenerated']`; (c) append `'recurringEventId'` to `HEADERS.Events`; (d) add
  `TABS.RECURRING_EVENTS` to `ID_TABS`; (e) `FIELD_TYPES.RecurringEvents = { cadence:
  'cadence', anchorDate:'date', startTime:'time', durationMinutes:'posint', defaultOwner:
  'owner', seasonStart:'month', seasonEnd:'month', lastGenerated:'date' }` and change
  `FIELD_TYPES.Events.start`/`.end` to `'datetimeOrDate'`; (f) `REQUIRED_ON_CREATE.
  RecurringEvents = ['title','cadence','anchorDate','defaultOwner']`; (g)
  `RECURRING_EVENTS_LOOKAHEAD_DEFAULT_DAYS = 60` and `RECURRING_EVENTS_TRIGGER_HOUR = 2`
  (research D5/D6); (h) append `['recurringEventsLookaheadDays','60','feature 025; days
  ahead the recurring-events generator materializes. Blank/≤0 ⇒ 60']` to `SETTINGS_SEED`.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New validation types and Sheet provisioning that every story depends on.

- [X] T002 [P] Update `backend/Validation.js`: add `case 'time'` to `isValidType_`
  (`value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)`) and `case 'datetimeOrDate'`
  (`isIsoDateTime_(value) || isIsoDate_(value)`), so a recurring-event `startTime` validates
  and Events `start`/`end` accept an all-day (date-only) value (data-model §All-day
  acceptance, research D2).
- [X] T003 Update `backend/Setup.js`: confirm `setupDatabase()` provisions the new
  `RecurringEvents` tab, appends the `recurringEventId` column to an existing `Events` tab,
  and seeds `recurringEventsLookaheadDays` — extend the provisioning helpers if any of the
  three is not already additive (must never delete/clear existing data or hand edits).

**Checkpoint**: `setupDatabase()` then `selfTest()` run clean; the new tab/column/setting
exist; validation accepts `time` + all-day event dates.

---

## Phase 3: User Story 1 — Occurrences generate on their own (Priority: P1) 🎯 MVP

**Goal**: A recurring-event rule materializes dated occurrence Events (all-day or timed)
within the events lookahead, idempotently, linked to the rule, with never-resurrect.

**Independent Test**: Hand-add a yearly rule to `RecurringEvents`, run
`generateRecurringEvents()`, confirm exactly the expected occurrences appear (title, owner,
timing, `recurringEventId`), re-run yields no duplicates, delete one occurrence + re-run
never recreates it.

- [X] T004 [US1] Create `backend/RecurringEvents.js` — pure helpers (no Sheet access):
  `recurringEventOccurrenceId_(ruleId, date)` (`'v'+hex(MD5(ruleId+'|'+date))`),
  `isRecurringEventId_(id)` (`/^v[0-9a-f]{32}$/`), and `occurrenceStartEnd_(date, startTime,
  durationMinutes)` returning `{start,end}` — all-day `{date,date}` when `startTime` blank,
  else `{date+'T'+startTime, addMinutesToDateTime_(start, durationMinutes||60)}` with a local
  `addMinutesToDateTime_` helper. Reuse `occurrencesInWindow_`, `inSeason_`, `monthOf_`,
  `addDays_` from `backend/Recurring.js` (do not duplicate).
- [X] T005 [US1] In `backend/RecurringEvents.js` add `generateRecurringEvents()` (trigger
  entry, no trailing underscore) + `generateForEventRule_(rule, today, windowEnd)`: read
  `recurringEventsLookaheadDays` (fallback 60), compute window `[lastGenerated||today-1,
  today+lookahead]`, get occurrences, skip out-of-season (still advance watermark), build the
  occurrence event per data-model (`id`, `recurringEventId`, title/owner/location/notes/
  templateId, `prepGeneratedFor:''`, derived start/end), `createRecord_(TABS.EVENTS, occ,
  'system')`, advance `lastGenerated` via `updateRecordById_`. Isolate per-rule failures
  (try/catch + `console.error`) like `generateRecurringTasks`.
- [X] T006 [US1] In `backend/RecurringEvents.js` add `installRecurringEventsTrigger()`
  (public name): idempotently remove any existing `generateRecurringEvents` handler, then
  create a nightly time-based trigger at `RECURRING_EVENTS_TRIGGER_HOUR` (2). Reuses the
  `script.scriptapp` scope (no manifest/scope change).
- [X] T007 [US1] Add a `recurringEvents.list` handler in `backend/Api.js`
  (`{ recurringEvents: listRecords_(TABS.RECURRING_EVENTS) }`) so occurrences' rules can be
  read (used by the frontend and manual validation).
- [X] T008 [US1] Add US1 assertions to `backend/SelfTest.js`: occurrence timing derivation
  (all-day date-only vs timed start/end, duration default 60, month-clamp via reused math),
  deterministic id, live generate → exactly the expected occurrences with `recurringEventId`,
  idempotent re-run (no duplicates, watermark advanced), season skip, delete-occurrence +
  re-run never-resurrect.

**Checkpoint**: US1 fully testable via `selfTest()` — the MVP (occurrences appear and stay
correct without prep).

---

## Phase 4: User Story 2 — Each occurrence brings its prep checklist (Priority: P1)

**Goal**: A rule with a `templateId` gives every generated occurrence its prep tasks, dated
by offset, idempotent and per-occurrence independent; no/deleted template ⇒ no prep, no error.

**Independent Test**: Attach a template to a yearly rule, generate, confirm each occurrence
has the template's prep tasks at the right dates; re-run yields no duplicate prep; a rule
with no/deleted template generates plain occurrences with no error.

- [X] T009 [US2] In `backend/RecurringEvents.js` `generateForEventRule_`, after each
  occurrence `createRecord_`, call `syncPrepForEvent_(created, 'system')` (reuse
  `backend/PrepTasks.js` unchanged) so prep is generated inline — mirrors `createEvent_`.
  Guard the call so a still-idempotent re-run of an already-materialized occurrence re-syncs
  without duplicating (deterministic prep ids handle this).
- [X] T010 [US2] Add US2 assertions to `backend/SelfTest.js`: rule with template → occurrence
  carries `templateId` and its prep tasks exist at offset dates; idempotent re-run (no
  duplicate prep); two occurrences have independent prep; rule with blank `templateId` and
  rule with a non-existent `templateId` both generate plain occurrences with no prep, no
  throw (FR-012).

**Checkpoint**: US1 + US2 testable — occurrences arrive complete with their prep.

---

## Phase 5: User Story 3 — Manage the recurring-event rules (Priority: P1)

**Goal**: Create/read/edit/delete recurring-event rules over the JSON API; edits/deletes
affect only future occurrences; deleting an occurrence event cascade-cleans outstanding prep.

**Independent Test**: Through the API, create a rule, read it back, edit each field, delete
it — each change persists and is logged; edits/deletes leave existing occurrences intact;
deleting an occurrence event removes its open prep, keeps completed prep.

- [X] T011 [US3] In `backend/RecurringEvents.js` add `createRecurringEvent_(payload, actor)`
  and `updateRecurringEvent_(payload, actor)` mirroring `createRecurring_`/`updateRecurring_`:
  `rejectUnknownFields_`, `requireFields_(REQUIRED_ON_CREATE.RecurringEvents)`,
  `validateFields_`, `validateSeasonWindow_` (merged on update), `mutablePatch_`, and the
  `lastGenerated`-is-generator-managed guard (BAD_REQUEST on create/update). `templateId`
  stays lenient (unvalidated).
- [X] T012 [US3] Update `backend/Api.js`: register `recurringEvents.create/update/delete` in
  `HANDLERS` (`create`/`update` → the T011 helpers returning `{ recurringEvent }`, `delete` →
  `deleteEntity_(TABS.RECURRING_EVENTS, …)` returning `{ id }`). No change to `deleteEvent_`
  needed — it already cascades all prep tasks on any event delete (feature 005 FR-017;
  research D7 correction).
- [X] T013 [US3] Add US3 assertions to `backend/SelfTest.js`: create/read/update/delete rule
  round-trip with ActivityLog attribution; `lastGenerated` guard rejects; edit changes only
  future occurrences (existing untouched); delete rule leaves existing occurrences + prep;
  deleting an occurrence event via `deleteEvent_` removes all of its prep tasks (confirms
  the existing 005 cascade covers occurrences too).

**Checkpoint**: All three P1 stories done and self-tested; backend feature-complete.

---

## Phase 6: Frontend — rule manager + all-day rendering

**Goal**: Household can create/edit/delete recurring-event rules from the More hub; the
calendar renders occurrences (all-day chips or timed) with prep tethered — no calendar change
needed (reuses `isAllDay`).

- [X] T014 Update `frontend/src/types/domain.ts`: add `RecurringEventRule` interface
  (id, title, cadence: `Cadence`, anchorDate, startTime?, durationMinutes?, defaultOwner:
  `Owner`, templateId?, location?, notes?, seasonStart?, seasonEnd?, lastGenerated?) and add
  optional `recurringEventId?` to `Event`.
- [X] T015 Create `frontend/src/hooks/useRecurringEvents.ts` mirroring
  `frontend/src/hooks/useRecurring.ts`: `useRecurringEvents` (query `recurringEvents.list`) +
  create/update/delete mutations calling `recurringEvents.*`, invalidating
  `['recurringEvents']` (and `['events']` where occurrences may appear).
- [X] T016 [P] Create `frontend/src/components/more/RecurringEventsManager.tsx` mirroring
  `RecurringManager.tsx`: list + create/edit form + delete-with-confirm. Fields add an
  optional time (blank ⇒ all-day) + duration, a `templateId` picker sourced from
  `templates.list`, and optional location/notes. Reuse the owner selector, cadence select,
  and season inputs. Follow `DESIGN.md`/`PRODUCT.md` (owner color = identity).
- [X] T017 Update `frontend/src/components/more/MoreView.tsx`: add a "Recurring Events"
  section rendering `<RecurringEventsManager />` and a Manage-hub link, alongside the existing
  Recurring Rules / Prep Templates sections.
- [X] T018 [P] Create `frontend/src/components/more/RecurringEventsManager.test.tsx` (Vitest +
  Testing Library) covering create (all-day + timed), edit, delete-confirm, and field
  validation errors, mirroring `RecurringManager.test.tsx`.

---

## Phase 7: Polish & Cross-Cutting

- [X] T019 [P] Update `backend/README.md` (and any setup notes) documenting the
  `RecurringEvents` tab, the `Events.recurringEventId` column, `recurringEventsLookaheadDays`,
  `installRecurringEventsTrigger()`, and the post-deploy `setupDatabase()` + `selfTest()`
  step.
- [X] T020 Run `cd frontend && npm run build` (no type errors) and an `/impeccable audit` on
  the new Recurring Events UI; fix findings before PR.
- [ ] T021 Deploy (`clasp push && clasp deploy`), run `setupDatabase()`, `selfTest()`,
  `installRecurringEventsTrigger()`, then walk `quickstart.md` Scenarios A–E live; capture
  results for the validation pause.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002, T003)** block everything.
- **US1 (T004→T005→T006, T007, T008)** is the MVP; T004 before T005 before T006 (same file);
  T007 (Api) and T008 (SelfTest) after the generator exists.
- **US2 (T009→T010)** builds on US1's generator (same file, after T005).
- **US3 (T011→T012, T013)** — T011 before T012 (T012 registers T011's helpers); both after
  the file exists.
- **Frontend (T014→T015→T016→T017, T018)** depends on the backend `recurringEvents.*`
  contract (T007/T011/T012) being defined; T014→T015→T016→T017 is a dependency chain, T018
  after T016.
- **Polish (T019–T021)** last; T021 is the live-validation gate.

## Parallel Opportunities

- T002 [P] (Validation.js) alongside T001-adjacent work once constants land.
- T016 [P] (component) and T018 [P] (its test) are the natural frontend parallel once the
  hook (T015) exists; T019 [P] (docs) can proceed anytime after the backend lands.
- Cross-file backend tasks are mostly serialized by the shared `RecurringEvents.js` /
  `SelfTest.js` files — expected for a flat Apps Script project.

## Implementation Strategy

**MVP = US1** (Phases 1–3): occurrences generate correctly, idempotently, never-resurrect —
delivers the core "birthdays/anniversaries stop being hand-entered" value even before prep.
Layer **US2** (prep) and **US3** (CRUD + cascade) next; both are P1 and small. Ship the
**frontend** manager once the API contract is live, then polish + live quickstart validation.
