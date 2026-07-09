---
description: "Task list for feature 005 events-and-prep-templates"
---

# Tasks: Events and Prep Templates

**Input**: Design documents from `/specs/005-events-and-prep-templates/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-005.md — all
present. Features 001 (schema/API/envelope/idempotent `createRecord_`), 002 (verified `actor` +
shared-account `actingPerson` on writes), 003 (task lifecycle + feed; Events CRUD handlers), and
004 (recurring engine; `addDays_`, deterministic-id + trigger patterns) are deployed.

**Tests**: As in 001–004, the plan chooses a manually-run `selfTest()` over a TDD runner (Apps
Script has none; "keep it boring"). The prep-id + offset date math are exercised as in-process
units; generation, idempotency, non-resurrection, re-date/retag/delete-purge, and template CRUD
are exercised with live Sheet round-trips; the token/HTTP path is proven in the quickstart. No
pre-written failing-test tasks.

**Organization**: Tasks are grouped by user story (spec.md priorities). This feature is
**backend-only** — the UI is feature 006. **One schema column is added** (`prepGeneratedFor` on
Events) via a general, idempotent header-migration in `setupDatabase()`; no new tab, no new
Settings key.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1–US4 for user-story-phase tasks only
- All paths are repo-relative; the Apps Script project is flat under `backend/`

## Path & shared-file note

Apps Script has no folders — every source file lives directly in `backend/`. Because several
tasks edit the same file, they are **sequential** (no `[P]`):

- `backend/PrepTasks.js` — **new file**; **T003, T008, T010** (pure helpers → `syncPrepForEvent_`
  brain → nightly generator + trigger installer) → sequential.
- `backend/Api.js` — **T004, T006, T009, T012** (event guard → template CRUD → wire prep into
  events → `deleteEvent_` purge) → sequential.
- `backend/SelfTest.js` — **T005, T007, T011, T013** (new assertion blocks) → sequential.
- `backend/Config.js` (**T001**), `backend/Setup.js` (**T002**), and `backend/README.md`
  (**T014**) are each touched once.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Constants, the new Events column in the schema, and the required-fields list the
template CRUD reads. One file.

- [X] T001 [P] Update `backend/Config.js`: (a) append `'prepGeneratedFor'` to
  `HEADERS.Events` (data-model.md §Events — plain text, generator-managed marker); (b) add
  `REQUIRED_ON_CREATE.TaskTemplates = ['eventType','taskTitle','offsetDays','defaultOwner']`;
  (c) add the nightly hour `PREP_TRIGGER_HOUR = 4` (research D7 — offset from 004's hour 3 so the
  two nightly jobs don't contend); (d) bump `API_VERSION` `'1.1.0'` → `'1.2.0'` (additive —
  contracts/api-005.md §Versioning). No `FIELD_TYPES` change (`prepGeneratedFor` is free text;
  `TaskTemplates.offsetDays`/`defaultOwner` types already present).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: (1) Physically land the new column on the live Events tab — without it every
`events.*` fails `SCHEMA_MISMATCH` in `buildHeaderMap_`. (2) The pure, dependency-free
prep-id + offset date math the generator (US3) and cleanup (US4) are built on.

**⚠️ CRITICAL**: All event operations depend on T002; US3/US4 depend on T003.

- [X] T002 Extend `backend/Setup.js` `setupDatabase()` with a general **header migration**: for
  each provisioned tab whose row 1 is **non-empty**, compare row 1's names against `HEADERS[tab]`
  and **append any missing expected header** to the end of row 1 (set plain-text `@` on the new
  cells first, then write the names), leaving all existing columns and data untouched. Idempotent
  (a tab already carrying every header is unchanged) and general (future column adds ride the same
  path); mark `changed = true` and let the existing `provision` log fire only when it actually adds
  a column. This makes re-running `setupDatabase()` append `prepGeneratedFor` to the live Events
  tab (data-model.md §Schema change & migration). Depends on T001 (the header must be in `HEADERS.Events`).
- [X] T003 [P] Create `backend/PrepTasks.js` with pure helpers (no Sheet/network — unit
  testable):
  - `prepTaskId_(eventId, stepId)` → `'p' + hex(MD5(eventId + '|' + stepId))` via
    `Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, …)` (research D1) — the idempotency
    key; date-independent so re-dating updates the same row.
  - `isPrepTaskId_(id)` → tests `^p[0-9a-f]{32}$` (research D1) — distinguishes a generated prep
    task from a user's manually event-linked task (a `getUuid()` has hyphens / wrong length).
  - `prepDueDate_(eventStart, offsetDays)` → `addDays_(String(eventStart).substring(0,10),
    Number(offsetDays))` (research D5), reusing `addDays_` from `Recurring.js` (Principle IV — no
    duplicate date math). Signed offset: `-2` → two days before; result may be in the past (FR-018),
    no clamping.
  Keep everything straight-line; comment the id-shape and date-part choices.

---

## Phase 3: User Story 1 — Put an event on the household calendar (Priority: P1) 🎯 MVP

**Goal**: Event create/edit/delete with owner tagging works and is logged, and the
generator-managed `prepGeneratedFor` marker cannot be forged by a client.

**Independent Test**: Through the handlers, create an event, read it back, edit each field
including owner, and delete it — asserting persistence, attribution in the log, and that a
client-supplied `prepGeneratedFor` on create/update is refused (spec US1 Independent Test;
quickstart §3 marker check). (Basic Events CRUD already exists from 003; this story rounds it out
for the new column.)

- [X] T004 [US1] In `backend/Api.js`, harden `createEvent_` and `updateEvent_` against the new
  marker: before building the record/patch, if the payload has a non-blank `prepGeneratedFor`,
  `fail_('BAD_REQUEST', 'prepGeneratedFor is generator-managed; do not set it.',
  'prepGeneratedFor')` (research D9, mirroring 004's `lastGenerated` guard). `rejectUnknownFields_`
  now *allows* `prepGeneratedFor` (it is a column), so this explicit refusal is required. Leave the
  existing `end >= start` invariant and owner/date validation as-is. (Prep side effects are wired
  in T009; this task is only the guard.)
- [X] T005 [US1] In `backend/SelfTest.js` add `liveEventCrud_()` (call from `selfTest()`):
  `createEvent_({ title, start:'2026-07-25T17:00', end:'2026-07-27T12:00', owner:'both' },
  'selftest')` → assert stored with blank `prepGeneratedFor`; `updateEvent_` the title and owner →
  assert persisted; assert `createEvent_`/`updateEvent_` with `prepGeneratedFor:'x'` throw
  `BAD_REQUEST`; assert `end < start` throws `VALIDATION_FAILED`. Delete via
  `deleteRecordById_(TABS.EVENTS, id, 'selftest')` and assert gone. Clean up. (Runs before the prep
  wiring in T009 so it exercises the guard in isolation.)

**Checkpoint**: US1 is independently testable — event CRUD round-trips, validates, logs, and the
marker is server-owned.

---

## Phase 4: User Story 2 — Keep a library of reusable prep checklists (Priority: P1)

**Goal**: Create/edit/delete TaskTemplates steps over the JSON API, validated and logged; a
"checklist" is the set of steps sharing an `eventType`.

**Independent Test**: Through the handlers, create a step, read the library back, edit each field,
and delete a step — asserting persistence, that an unknown field and a non-integer `offsetDays`
are rejected, and that each change is logged (spec US2 Independent Test; quickstart §2).

- [X] T006 [US2] In `backend/Api.js` add `createTemplate_(payload, actor)` and
  `updateTemplate_(payload, actor)` (mirroring `createTask_`/`updateTask_`): create —
  `rejectUnknownFields_(TABS.TEMPLATES, payload)`; `requireFields_(payload,
  REQUIRED_ON_CREATE.TaskTemplates)`; `validateFields_(TABS.TEMPLATES, payload)`;
  `fullRecord_(TABS.TEMPLATES, payload)`; `createRecord_(TABS.TEMPLATES, rec, actor)`. update —
  `rejectUnknownFields_`; `requireFields_(payload, ['id'])`; `validateFields_`;
  `mutablePatch_(TABS.TEMPLATES, payload)`; `updateRecordById_(TABS.TEMPLATES, id, patch, actor)`.
  Register three `HANDLERS`: `'templates.create': (p, actor) => ({ template: createTemplate_(p,
  actor) })`, `'templates.update': (p, actor) => ({ template: updateTemplate_(p, actor) })`,
  `'templates.delete': (p, actor) => ({ id: deleteEntity_(TABS.TEMPLATES, p, actor) })` (reuses the
  generic `deleteEntity_` — TEMPLATES is an `ID_TAB`). Leave the existing `templates.list`
  untouched. No prep regeneration on template edits (research D8).
- [X] T007 [US2] In `backend/SelfTest.js` add `liveTemplateCrud_()` (call from `selfTest()`):
  `createTemplate_({ eventType:'selftest-visit', taskTitle:'Clean', offsetDays:'-2',
  defaultOwner:'both' }, 'selftest')` → assert stored; `updateTemplate_` the owner → assert
  persisted; assert an unknown field throws `BAD_REQUEST`, `offsetDays:'soon'` throws
  `VALIDATION_FAILED`, `defaultOwner:'dog'` throws `VALIDATION_FAILED`, and `updateTemplate_` on a
  bad id throws `NOT_FOUND`. Delete via `deleteRecordById_(TABS.TEMPLATES, id, 'selftest')`; assert
  gone. Clean up.

**Checkpoint**: US2 is independently testable — checklist-step CRUD round-trips, validates, logs.

---

## Phase 5: User Story 3 — Tag an event and get its prep tasks automatically (Priority: P1)

**Goal**: Tagging an event with a `templateId` materializes one dated prep task per checklist
step, idempotently, attributed to `system`, linked by `eventId`, without ever resurrecting a
hand-deleted prep task.

**Independent Test**: Seed a checklist (via `createRecord_(TABS.TEMPLATES, …)`) and a future
event tagged with it, run generation, and assert exactly one prep task per step (title/owner from
the step, `dueDate = start+offsetDays`, `eventId` back-link, `p…` id, `prepGeneratedFor` set); a
re-run makes no duplicate; deleting one prep task and re-running does not re-create it (spec US3
Independent Test; quickstart §3, §6).

- [X] T008 [US3] In `backend/PrepTasks.js` add `syncPrepForEvent_(event, actor)` — the one
  idempotent brain (research D3). Read `T = event.templateId`, `G = event.prepGeneratedFor`;
  the event's existing prep `P = listRecords_(TABS.TASKS).filter(t => t.eventId === event.id &&
  isPrepTaskId_(t.id))`; the checklist `S = listRecords_(TABS.TEMPLATES).filter(s => s.eventType
  === T)` (empty if `T` blank). Build the **desired set**: for each `s` in `S`, `{ id:
  prepTaskId_(event.id, s.id), title: s.taskTitle, dueDate: prepDueDate_(event.start,
  s.offsetDays), owner: s.defaultOwner, status:'open', eventId: event.id }`.
  - **Transition (`T !== G`)**: for each outstanding (`status==='open'`) task in `P` whose id is
    **not** in the desired-id set, `deleteRecordById_(TABS.TASKS, id, actor)` (retire the old
    template's leftovers; keep completed — FR-016). Then `createRecord_(TABS.TASKS, d, 'system')`
    for each desired `d` (deterministic id → a surviving completed one replays, no dup — FR-011).
    Then `updateRecordById_(TABS.EVENTS, event.id, { prepGeneratedFor: T }, 'system')`. (If `T`
    is blank the desired set is empty → this removes outstanding prep and clears the marker.)
  - **Steady state (`T === G`)**: create nothing (no resurrection — FR-014). For each desired `d`
    matching an **outstanding** task in `P` whose `dueDate !== d.dueDate`,
    `updateRecordById_(TABS.TASKS, d.id, { dueDate: d.dueDate }, 'system')` (re-date on move —
    FR-015). Leave completed prep untouched.
  No outer lock — each `createRecord_`/`updateRecordById_`/`deleteRecordById_` locks itself and is
  idempotent (Principle V). Return nothing (callers re-read as needed).
- [X] T009 [US3] In `backend/Api.js` wire prep into the event handlers: at the end of
  `createEvent_`, after `createRecord_`, call `syncPrepForEvent_(created, actor)` and return the
  event reflecting the set marker (re-read via `findRecord_`/`listRecords_` or set
  `created.prepGeneratedFor = created.templateId` when a template ran). At the end of
  `updateEvent_`, after the patch, call `syncPrepForEvent_(merged, actor)` (covers re-date on a
  `start` move and the set-swap on a `templateId` change — FR-015/016) and return the merged event.
  Both are inside the handler (post-write); the guard from T004 still rejects a client marker.
- [X] T010 [US3] In `backend/PrepTasks.js` add `generatePrepTasks()` — the nightly trigger entry
  point (also editor-runnable; public name, no trailing underscore per the CLAUDE.md gotcha): for
  each `event` in `listRecords_(TABS.EVENTS)`, call `syncPrepForEvent_(event, 'system')` guarded by
  try/catch so one bad event can't abort the run (`console.error` and continue, like
  `generateRecurringTasks`). Then add `installPrepTrigger()` (one-time, editor-run): delete any
  existing trigger whose `getHandlerFunction() === 'generatePrepTasks'`, then
  `ScriptApp.newTrigger('generatePrepTasks').timeBased().atHour(PREP_TRIGGER_HOUR).everyDays(1)
  .create()` — idempotent (research D7); reuses 004's `script.scriptapp` scope (no new auth). Add a
  header comment that it is run once from the editor after deploy.
- [X] T011 [US3] In `backend/SelfTest.js` add `unitPrepMath_()` and `livePrepGeneration_()` (call
  both from `selfTest()`). **Unit**: `prepTaskId_('e1','s1')` deterministic (equal on repeat),
  starts `'p'`, and `isPrepTaskId_` accepts it but rejects a UUID; `prepDueDate_('2026-07-25T17:00',
  '-2') === '2026-07-23'` and `('2026-07-25T17:00','-1') === '2026-07-24'`. **Live**: seed two
  template steps (`eventType:'selftest-visit'`, offsets `-2`/`-1`) and a future event tagged
  `templateId:'selftest-visit'` via `createRecord_`; run `syncPrepForEvent_(event,'selftest')` (or
  `generatePrepTasks()`); assert exactly two prep tasks with `eventId===event.id`, `p…` ids,
  correct titles/owners/`dueDate`s, and the event's `prepGeneratedFor==='selftest-visit'`. **Re-run**
  and assert the prep count is unchanged (no duplicate — SC-003). **Delete** one prep task via
  `deleteRecordById_(TABS.TASKS,…)`, re-run, and assert it is **not** re-created (steady state —
  FR-014). Clean up every seeded template/event/prep task.

**Checkpoint**: US3 is independently testable — prep generation is correct, dated, linked,
idempotent, and non-resurrecting.

---

## Phase 6: User Story 4 — Prep keeps up when the event changes (Priority: P2)

**Goal**: Moving an event re-dates outstanding prep (completed untouched); retagging swaps the
set (completed from the old set kept); deleting the event purges all its prep.

**Independent Test**: Generate prep, then (a) move `start` and assert outstanding prep re-dates
while completed prep is unmoved; (b) change `templateId` and assert the set swaps, keeping
completed old-set prep; (c) delete the event and assert all its prep (done + outstanding) is gone
(spec US4 Independent Test; quickstart §4, §5, §7).

- [X] T012 [US4] In `backend/Api.js` add `deleteEvent_(payload, actor)` and route
  `'events.delete'` to it (replacing the generic `deleteEntity_(TABS.EVENTS, …)`): `requireFields_
  (payload, ['id'])`; capture the id; delete the event row via `deleteRecordById_(TABS.EVENTS, id,
  actor)`; then delete **all** of the event's prep tasks — `listRecords_(TABS.TASKS).filter(t =>
  t.eventId === id && isPrepTaskId_(t.id))`, calling `deleteRecordById_(TABS.TASKS, t.id, actor)`
  for each (completed and outstanding alike — FR-017). A user's manual (non-prep-id)
  event-linked tasks are left untouched. Return `{ id }` (Api handler shape unchanged).
- [X] T013 [US4] In `backend/SelfTest.js` add `livePrepLifecycle_()` (call from `selfTest()`):
  seed a checklist + tagged event and generate (as in T011). **(a) Move**: complete one prep task,
  then `updateEvent_({ id, start:<+2 days> }, 'selftest')`; assert the outstanding prep task's
  `dueDate` advanced by 2 days and the completed one's `dueDate` is unchanged (FR-015). **(b)
  Retag**: seed a second checklist (`eventType:'selftest-dinner'`), `updateEvent_({ id,
  templateId:'selftest-dinner' }, 'selftest')`; assert the outstanding old-set prep is gone, the
  new-set prep exists, and the completed old-set prep still remains (FR-016). **(c) Delete**:
  `deleteEvent_({ id }, 'selftest')`; assert **no** task with `eventId===id` and a `p…` id remains
  (done + outstanding purged — FR-017), while a manually-created task linked to the event (seed one
  with a UUID id + that `eventId`) **survives**. Clean up.

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T014 [P] Update `backend/README.md`: document the Event `prepGeneratedFor` marker and the
  `setupDatabase()` header-migration; the `templates.create/update/delete` actions; the prep side
  effects on `events.create/update/delete`; the nightly generator + `installPrepTrigger()`; and the
  idempotency/non-resurrection design (deterministic `p…` ids + the `prepGeneratedFor` transition
  gate). Cross-link `specs/005-events-and-prep-templates/contracts/api-005.md`.
- [X] T015 Deploy & validate: `cd backend && clasp push && clasp deploy -i <deploymentId>`; in the
  editor run `setupDatabase()` (appends `prepGeneratedFor` to the live Events tab — confirm the
  header and that existing rows/data are intact), `selfTest()` (expect `ALL PASS`), and
  `installPrepTrigger()` (confirm exactly one `generatePrepTasks` trigger under Triggers, alongside
  004's); then walk `specs/005-events-and-prep-templates/quickstart.md` §2–9 against the live URL
  with a real token (no new scopes → no re-auth).

---

## Dependencies & Execution Order

- **Setup (T001)** → the column in `HEADERS.Events`, template required-fields, trigger hour,
  version. Blocks T002 (migration reads `HEADERS`).
- **Foundational (T002, T003)** → T002 lands the column on the live sheet (blocks all `events.*`);
  T003's pure helpers block US3 (T008) and US4 (T012). T003 is `[P]` vs T001/T002 (new file).
- **US1 (P1)** → the MVP guard: T004 (Api.js) → T005 (SelfTest.js). Needs T001 (column) + T002.
- **US2 (P1)** → independent of prep: T006 (Api.js, after T004 in that file) → T007 (SelfTest.js).
  Needs T001's `REQUIRED_ON_CREATE.TaskTemplates`.
- **US3 (P1)** → the headline: T008 (PrepTasks.js, after T003) → T009 (Api.js, after T006) → T010
  (PrepTasks.js, after T008) → T011 (SelfTest.js, after T007; needs T008/T010).
- **US4 (P2)** → move/retag behavior is inherent in T008; new code is T012 (Api.js, after T009) →
  T013 (SelfTest.js, after T011).
- **Polish (T014–T015)** → after the stories they document/validate.

Cross-file parallelism is limited (flat backend, three main files). Genuinely parallel: **T001**
(Config.js), **T003** (new PrepTasks.js), and **T014** (README.md) are the `[P]` tasks — distinct
single-touch/new files. Everything else serializes on `Api.js`, `PrepTasks.js`, or `SelfTest.js`.

## Implementation strategy

- **MVP = Setup + Foundational + US1 + US2 + US3** (T001–T011): the generator materializes prep
  idempotently with the transition/tombstone gate — the feature's whole reason to exist — plus the
  event-marker guard and the checklist-management API. Checklists and events can also be seeded by
  hand in the Sheet (SC-006).
- **Increment 2 = US4** (T012–T013): the messy-real-world upkeep — re-date on move, swap on retag,
  purge on delete.
- **Polish (T014–T015)**: document, deploy, run the migration, install the trigger, validate live.
