---
description: "Task list for feature 019 — Task & Event Details + Collaboration"
---

# Tasks: Task & Event Details + Collaboration

**Input**: Design documents from `/specs/019-details-collaboration/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md), [quickstart.md](quickstart.md)

**Tests**: Included — this repo's Definition of Done requires `npm run test` green and a
passing `selfTest()`, and quickstart references new tests. Tests are proportionate, not TDD-strict.

**Organization**: Grouped by the four user stories. US1 (task notes) and US2 (acknowledge)
are P1; US3 (event notes) and US4 (event location) are P2. Each story is independently
testable. Note the **shared-file coupling** called out in Dependencies — several UI files
(`quickAdd.ts`, `QuickAddSheet.tsx`, `useMutations.ts`, `EventEditSheet.tsx`,
`EventDetailSheet.tsx`, `TaskDetailSheet.tsx`, `SelfTest.js`) are touched by more than one
story, so those cross-story tasks are **not** parallel with each other.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 (task notes), US2 (acknowledge), US3 (event notes), US4 (event location)

---

## Phase 1: Setup (Shared Schema & Types)

**Purpose**: Land the schema/enum/type additions every story reads. `Config.js` `HEADERS`
must name the new columns before any backend path maps them; the physical Sheet columns are
added by running `setupDatabase()` during deploy (Phase 7 / quickstart Scenario A).

- [x] T001 In `backend/Config.js`: add `notes`, `ackBy`, `ackAt` to `HEADERS.Tasks` (after `gcalEventId`); add `location` to `HEADERS.Events` (after `prepGeneratedFor`); add `acknowledge: 'committed to'` to `ACTION_VERBS`; add `acknowledge` to the `isWriteAction_` regex alternation.
- [x] T002 [P] In `frontend/src/types/domain.ts`: add `notes?`, `ackBy?: Owner`, `ackAt?: string` to `Task`; add `location?: string` to `Event`.

**Checkpoint**: Schema names and types exist; stories can build against them.

---

## Phase 2: Foundational (Shared Link Rendering — blocks US1 & US3)

**Purpose**: The `http(s)://` linkify used identically by task notes (US1) and event notes (US3).

- [x] T003 [P] Create `frontend/src/lib/linkify.ts` — pure `linkify(text)` returning ordered segments `{type:'text',value}` | `{type:'link',href}`, matching `/\bhttps?:\/\/[^\s<]+/gi` and trimming trailing `.,;:!?)]}` off each URL (research R1).
- [x] T004 [P] Create `frontend/src/lib/linkify.test.ts` — cases: plain text, one/multiple URLs, trailing punctuation, bare `www.`/domain stays plain, empty string.
- [x] T005 Create `frontend/src/components/ui/NotesText.tsx` — renders `linkify` segments as React children, links as `<a href target="_blank" rel="noreferrer noopener">` (never `dangerouslySetInnerHTML`); preserves whitespace/line breaks. Depends on T003.

**Checkpoint**: Notes can be rendered safely with tappable links anywhere.

---

## Phase 3: User Story 1 — Notes on tasks (Priority: P1) 🎯 MVP

**Goal**: Capture a free-text note (with tappable `http(s)://` links) on a task at create and
edit time; both users see it.

**Independent Test**: Quickstart Scenario A — create a task with a note containing a URL,
reopen, confirm text persists and the URL is a tappable link; edit the note and confirm it
updates. (Backend needs only the T001 header; `notes` flows through existing create/update.)

- [x] T006 [US1] In `frontend/src/lib/quickAdd.ts`: add `notes?` to `NewOneTimeTaskInput`; `buildOneTimeTaskPayload` includes `notes` when non-empty.
- [x] T007 [US1] In `frontend/src/components/quickadd/QuickAddSheet.tsx`: add a notes textarea to the task quick-add form, wired into the one-time-task input. Depends on T006.
- [x] T008 [US1] In `frontend/src/hooks/useMutations.ts`: extend `useUpdateTask` payload type + call to accept `notes?`.
- [x] T009 [US1] In `frontend/src/components/task/TaskEditSheet.tsx`: add a notes textarea (seeded from the task), submit `notes` via `useUpdateTask`. Depends on T008.
- [x] T010 [US1] In `frontend/src/components/task/TaskDetailSheet.tsx`: render the note via `NotesText` in read mode; make it editable in edit mode. Depends on T005, T008.
- [x] T011 [P] [US1] In `backend/SelfTest.js`: add a case asserting `tasks.create` + `tasks.update` round-trip `notes` (stored, returned, hand-editable).
- [x] T012 [US1] Update `frontend/src/components/task/TaskDetailSheet.test.tsx` and `TaskEditSheet.test.tsx` for notes display/edit.

**Checkpoint**: Task notes with links fully work end-to-end.

---

## Phase 4: User Story 2 — Acknowledge / commit (Priority: P1)

**Goal**: A task assigned to the other single person reads "not yet committed" until that
person taps **I've got it**, which pings the assigner and posts a dismissible dashboard notice.

**Independent Test**: Quickstart Scenarios B–E — uncommitted badge visible to both; assignee's
"I've got it" clears it, pings the assigner's phone, and shows a persistent dismissible notice;
idempotent replay; reassignment resets; no ack on `both`/self/done.

### Backend

- [x] T013 [US2] In `backend/Sheets.js`: add `setTaskAcknowledge_(id, actor)` — locked, sets `ackBy`/`ackAt`, appends one `acknowledge` log row, idempotent no-change when `ackBy === owner` (model on `setTaskSnooze_`). Returns `{task, changed}`.
- [x] T014 [US2] In `backend/Ntfy.js`: add `pingAcknowledge_(task)` — recipient `otherPerson_(task.owner)`, message `"<Assignee> has it: <title>"`, reuse `postToNtfy_`/`ntfyTopicFor_`/`ntfyEnabled` gate, log every outcome, never throw (model on `pingCompletion_`).
- [x] T015 [US2] In `backend/Api.js`: add `acknowledgeTask_` handler + `'tasks.acknowledge'` in `HANDLERS` (require `id`, verify `actor === owner` and `owner ∈ {max,jaz}` else `VALIDATION_FAILED`, call `setTaskAcknowledge_`, best-effort `pingAcknowledge_` + `rereadTask_` on change); reject `ackBy`/`ackAt` in `createTask_` and `updateTask_` (extend the `status`/`completedBy`/`completedAt` guard); in `updateTask_`, when payload changes `owner`, clear `ackBy`/`ackAt` in the patch. Depends on T013, T014.
- [x] T016 [P] [US2] In `backend/SelfTest.js`: add cases — acknowledge transition (ackBy set, log, changed); idempotent replay (changed:false, no dup log); reassign clears ack; reject client-supplied ackBy/ackAt; reject ack on `both`/non-owner.

### Frontend

- [x] T017 [P] [US2] In `frontend/src/lib/tasks.ts`: add `isUncommitted(task, viewer)` and `canAcknowledge(task, viewer)` per data-model predicates.
- [x] T018 [P] [US2] In `frontend/src/lib/tasks.test.ts`: cover the predicates (single-owner open/snoozed uncommitted; `both`/self/done excluded; acknowledged clears).
- [x] T019 [P] [US2] Create `frontend/src/lib/ackDismissals.ts` — localStorage get/add of dismissed `"<taskId>:<ackAt>"` keys (+ small test).
- [x] T020 [US2] Create `frontend/src/lib/ackNotices.ts` — `ackNotices(tasks, viewer)` deriving assigner notices (owner≠viewer, `ackBy===owner`) minus dismissed keys. Depends on T019.
- [x] T021 [US2] In `frontend/src/hooks/useMutations.ts`: add `useAcknowledgeTask` (`tasks.acknowledge`), optimistic set of `ackBy`, invalidate `['tasks']` on settle.
- [x] T022 [US2] In `frontend/src/components/task/TaskRow.tsx`: show "not yet committed" badge (both users) and inline **I've got it** (assignee only) using the predicates + `useAcknowledgeTask`. Depends on T017, T021.
- [x] T023 [US2] In `frontend/src/components/task/TaskDetailSheet.tsx`: add the badge + **I've got it** action. Depends on T017, T021 (same file as T010 — sequence after it).
- [x] T024 [US2] Create `frontend/src/components/dashboard/AckNotices.tsx` — dismissible "X has it" notices from `ackNotices`, dismiss via `ackDismissals`. Depends on T020.
- [x] T025 [US2] In `frontend/src/components/dashboard/DashboardHome.tsx`: render `<AckNotices>` at the top, passing tasks + resolved viewer. Depends on T024.
- [x] T026 [US2] Add/adjust component tests for `TaskRow`, `AckNotices`, and the `DashboardHome` integration.

**Checkpoint**: The acknowledge/commit loop works across both channels and resets on reassignment.

---

## Phase 5: User Story 3 — Event notes create/edit (Priority: P2)

**Goal**: Capture/edit a note on events (create + `EventEditSheet`), rendered with the same
tappable links as task notes.

**Independent Test**: Quickstart Scenario F — create an event with a URL note, confirm it
displays with a tappable link, edit it, confirm persistence. Reuses `NotesText` (Phase 2).

- [x] T027 [US3] In `frontend/src/lib/quickAdd.ts`: add `notes?` to `NewEventInput`; `buildEventPayload` includes `notes` when non-empty. (Same file as T006 — sequence after it.)
- [x] T028 [US3] In `frontend/src/components/quickadd/QuickAddSheet.tsx`: add a notes textarea to the event quick-add form. (Same file as T007.)
- [x] T029 [US3] In `frontend/src/hooks/useMutations.ts`: extend `useUpdateEvent` payload to accept `notes?`. (Same file as T008/T021.)
- [x] T030 [US3] In `frontend/src/components/event/EventEditSheet.tsx`: add a notes textarea (seeded from the event), submit via `useUpdateEvent`. Depends on T029.
- [x] T031 [US3] In `frontend/src/components/event/EventDetailSheet.tsx`: render `notes` via `NotesText` (replacing the plain-text display). Depends on T005.
- [x] T032 [US3] Update `frontend/src/components/event/EventDetailSheet.test.tsx` for the linkified note.

**Checkpoint**: Event notes are capturable on create + edit and render links.

---

## Phase 6: User Story 4 — Event location + calendar mapping (Priority: P2)

**Goal**: Capture/edit a location on events, display it, and mirror it onto the synced
Google Calendar event so directions work.

**Independent Test**: Quickstart Scenario G — set a location, confirm it shows in the detail
sheet and lands on the mirrored calendar event; clear it and confirm the calendar location empties.

- [x] T033 [US4] In `backend/CalendarSync.js`: in `syncCalendarForEvent_`, call `setLocation(event.location || '')` on both the update-in-place branch and the newly-created event (before storing the pointer). Handles set + clear (research R5).
- [x] T034 [P] [US4] In `backend/SelfTest.js`: add a case for location→calendar mapping (set and cleared), or a pure guard if the calendar isn't configured in the test env.
- [x] T035 [US4] In `frontend/src/lib/quickAdd.ts`: add `location?` to `NewEventInput`; `buildEventPayload` includes it when non-empty. (Same file as T006/T027.)
- [x] T036 [US4] In `frontend/src/components/quickadd/QuickAddSheet.tsx`: add a location input to the event quick-add form. (Same file as T007/T028.)
- [x] T037 [US4] In `frontend/src/hooks/useMutations.ts`: extend `useUpdateEvent` payload to accept `location?`. (Same file as T029.)
- [x] T038 [US4] In `frontend/src/components/event/EventEditSheet.tsx`: add a location input, submit via `useUpdateEvent`. (Same file as T030.)
- [x] T039 [US4] In `frontend/src/components/event/EventDetailSheet.tsx`: display `location` in the detail sheet. (Same file as T031.)

**Checkpoint**: Event location is captured, displayed, and mirrored to the calendar (incl. clear).

---

## Phase 7: Polish & Cross-Cutting (Deploy, Migrate, Validate)

- [x] T040 `cd frontend && npm run build && npm run test` — no type errors, all tests green (269/269).
- [x] T041 `/impeccable audit` on all new/changed UI — found and fixed one real WCAG AA contrast gap (a new `text-accent` link/button color at 4.05:1, below the 4.5:1 body-text floor); everything else (touch targets, tokens, ARIA roles, owner color) checked clean. See audit summary below.
- [x] T042 `cd backend && clasp push && clasp deploy -i <id>` done (deployed @15). `setupDatabase()`/`selfTest()` require the Apps Script editor (no API-executable deployment configured for `clasp run`) — **awaiting Max/Jaz to run these manually**, see pause note.
- [ ] T043 Execute `quickstart.md` scenarios A–H on device — deferred pending T042's manual step and real Google OAuth (sandbox can't exercise sign-in), matching the 016/017/018/022 precedent.
- [ ] T044 Update `BACKLOG.md` — stage `implemented, pending PR`, then merged + PR link after merge.

---

## Dependencies & Execution Order

### Phase order

- **Phase 1 (Setup)** → **Phase 2 (Foundational: linkify/NotesText)** → user stories → **Phase 7 (Polish)**.
- Phase 2 blocks US1 and US3 (both use `NotesText`). US2 and US4 do not need Phase 2.

### Story independence & shared-file coupling

- **US1 (P1)** and **US2 (P1)** are the MVP. US1 backend is essentially free (T001 header).
- Shared files touched across stories (implement sequentially, do **not** parallelize across
  stories): `frontend/src/lib/quickAdd.ts` (T006→T027→T035),
  `QuickAddSheet.tsx` (T007→T028→T036), `useMutations.ts` (T008→T021→T029→T037),
  `EventEditSheet.tsx` (T030→T038), `EventDetailSheet.tsx` (T031→T039),
  `TaskDetailSheet.tsx` (T010→T023), `backend/SelfTest.js` (T011, T016, T034).
- Despite shared files, each story remains independently *testable* by its quickstart scenario.

### Within a story

- Backend helper → API handler → SelfTest. Frontend lib/predicate → hook → component → test.
- linkify (T003) before NotesText (T005); ackDismissals (T019) before ackNotices (T020);
  useUpdateTask/useAcknowledgeTask before the components that call them.

## Parallel Opportunities

- T002 [P] (types) alongside T001.
- T003/T004 [P] (linkify + its test) together.
- Backend SelfTest additions (T011, T016, T034 marked [P]) are independent of frontend work
  in their phases, though they share `SelfTest.js` so serialize the edits to that file.
- T017/T018/T019 [P] (predicates, their test, dismissals) are independent new files.

## Implementation Strategy

### MVP (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1 task notes) → validate Scenario A.
3. Phase 4 (US2 acknowledge) → validate Scenarios B–E.
4. Deploy + migrate (T042), then the P2 stories.

### Incremental delivery

US3 (event notes) and US4 (event location) each add value on top without touching US1/US2
behavior; ship after the P1 MVP is green. Run `setupDatabase()` once (T042) — it lands all
four columns together, so it need not be repeated per story.

## Notes

- No new backend action beyond `tasks.acknowledge`; no new OAuth scope; no new Sheet tab.
- `notes`/`location` require no backend code beyond the `HEADERS` addition — they flow
  through `fullRecord_`/`mutablePatch_` automatically.
- Commit after each task or logical group; keep the Sheet hand-editable (Scenario H regression).
