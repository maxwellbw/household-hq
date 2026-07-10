---
description: "Task list for feature 012 — App Shell & Task UX"
---

# Tasks: App Shell & Task UX

**Input**: Design documents from `/specs/012-app-shell-task-ux/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-tasks-snooze.md, quickstart.md

**Tests**: Included only where the Definition of Done names them — pure-logic Vitest units (task grouping/sort, snoozeHistory parse/format, end-before-start guard) and backend `SelfTest.js` cases for the new snooze action. No broad UI test suite.

**Organization**: By user story (US1–US6) in priority order. Almost all work is `/frontend`; US3 adds the feature's single backend change.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US6 for story-phase tasks; setup/foundational/polish carry no story label

## Path Conventions

Web app: `frontend/src/…` and `backend/…` at repo root (per plan.md Structure Decision).

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 [P] Create the shared nav definition + `NavSection` type (`'calendar' | 'tasks' | 'feed' | 'more'`, each with lucide icon + label) in `frontend/src/components/shell/navItems.ts`, exported for both the mobile bottom bar and the desktop rail.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The navigation plumbing every section plugs into. **⚠️ No section is reachable until this is done.**

- [ ] T002 Lift active-section state into `frontend/src/App.tsx` (`useState<NavSection>('calendar')`, always defaulting to Calendar on load) and render a section switch that mounts `CalendarHome` for `calendar` and the section view components for `tasks`/`feed`/`more`; pass `active` + `onNavigate` into `AppShell`.
- [ ] T003 Refactor `frontend/src/components/shell/AppShell.tsx` to render the mobile bottom tab bar (all four tabs enabled — remove the `disabled` stub logic) and a desktop **left sidebar rail** (`sm:` and up) from `navItems`, both driven by the active-section props, with `aria-current="page"` on the active item, ≥44px targets, and focus rings.

**Checkpoint**: Nav toggles sections on mobile and desktop; Calendar remains home. (Sections may be lean until their stories land.)

---

## Phase 3: User Story 1 - Reach every section on any device (Priority: P1) 🎯 MVP

**Goal**: All four destinations show real content on mobile and desktop; Calendar is home.

**Independent Test**: Quickstart Scenario A — visit Tasks/Feed/More at 375px and ~1200px; each shows real content with active indication; reload lands on Calendar.

- [ ] T004 [P] [US1] Create `frontend/src/components/task/TasksView.tsx` rendering all tasks (via existing `useTasks` + `TaskRow`) as a real screen with a loading + empty state (grouping/filter added in US2).
- [ ] T005 [P] [US1] Create `frontend/src/hooks/useActivity.ts` (`activity.list`) and `frontend/src/components/feed/FeedView.tsx` rendering entries newest-first with a friendly empty state.
- [ ] T006 [P] [US1] Create `frontend/src/components/more/MoreView.tsx` as a hub (rows linking to Recurring rules and Templates managers — wired in US6 — plus signed-in-as / sign-out surfaced here).
- [ ] T007 [US1] Confirm the App.tsx switch mounts T004–T006, verify each destination shows real content + `aria-current`, and do an `/impeccable critique` pass on the shell (bottom bar + rail).

**Checkpoint**: US1 independently functional (Scenario A passes).

---

## Phase 4: User Story 2 - Complete/reopen any task, with grouping (Priority: P1)

**Goal**: A Tasks section that lists all tasks grouped Open→collapsed Done, honors owner-filter chips, and completes/reopens standalone tasks.

**Independent Test**: Quickstart Scenario B — a standalone task is completed and reopened entirely from Tasks; grouping and owner filter behave.

- [ ] T008 [P] [US2] Implement pure grouping/sort in `frontend/src/lib/tasks.ts`: partition Open (`status !== 'done'`) vs Done (`status === 'done'`); sort Open by `dueDate` asc with overdue first and undated last; Done by `completedAt` desc.
- [ ] T009 [P] [US2] Unit tests in `frontend/src/lib/tasks.test.ts` for grouping/sort edge cases (overdue, undated, snoozed-in-open, empty, all-done).
- [ ] T010 [US2] Enhance `frontend/src/components/task/TasksView.tsx`: render Open group + collapsed Done group from `lib/tasks.ts`; integrate `useOwnerFilter` + `OwnerFilterChips`; friendly empty state (FR-020).
- [ ] T011 [US2] Verify standalone tasks (no `eventId`) complete/reopen from the list via existing `useCompleteTask`/`useReopenTask`, and that state stays in sync with `EventDetailSheet` for event-tethered tasks (FR-008).
- [ ] T012 [US2] Add an accessible overflow (kebab) menu to `frontend/src/components/task/TaskRow.tsx` with **Snooze** (placeholder → wired in US3) and **Edit due** entries (button, ≥44px, focus ring, aria-label).

**Checkpoint**: Scenario B passes; US1+US2 both work.

---

## Phase 5: User Story 3 - Snooze a task and see its history (Priority: P2)

**Goal**: Snooze/un-snooze with a permanent, visible deferral trail — the feature's one backend change plus its UI.

**Independent Test**: Quickstart Scenarios C and G — snooze, see two-entry history, un-snooze, feed shows verbs, shared account attributes correctly.

### Backend (the single backend change)

- [ ] T013 [US3] Add a `setTaskSnooze_`/unsnooze write path in `backend/Sheets.js` modeled on `setTaskLifecycle_`: inside `withLock_`, idempotent no-change when already in target state; snooze sets `status='snoozed'` + new `dueDate` + appends one `snoozeHistory` entry (`<oldDue|∅>→<newDue> @ <nowIso>`); unsnooze sets `status='open'` (history preserved); both append one ActivityLog row.
- [ ] T014 [US3] Register `tasks.snooze` and `tasks.unsnooze` handlers in `backend/Api.js` HANDLERS.
- [ ] T015 [US3] In `backend/Config.js`, add `snooze`/`unsnooze` to `ACTION_VERBS` and extend `isWriteAction_` to also match the lifecycle verbs `complete|reopen|snooze|unsnooze` (correct shared-account attribution; also hardens complete/reopen).
- [ ] T016 [US3] Add snooze/unsnooze cases to `backend/SelfTest.js` per contract §SelfTest (idempotence, history append, ActivityLog row, shared-account `ACTING_PERSON_REQUIRED` + resolved actor).

### Frontend

- [ ] T017 [P] [US3] Add `useSnoozeTask` + `useUnsnoozeTask` to `frontend/src/hooks/useMutations.ts` (optimistic status flip + `['tasks']` invalidate, mirroring the complete/reopen pattern).
- [ ] T018 [P] [US3] Add `parseSnoozeHistory` + `formatSnoozeHistory` to `frontend/src/lib/tasks.ts` and tolerant-parse/empty tests to `frontend/src/lib/tasks.test.ts` (per data-model.md encoding).
- [ ] T019 [US3] Create `frontend/src/components/task/SnoozeDialog.tsx` (presets Tomorrow / Next week + date picker constrained to ≥ today) calling `useSnoozeTask`.
- [ ] T020 [US3] Create `frontend/src/components/task/TaskDetailSheet.tsx` showing task info + readable snooze history + an Un-snooze action; de-emphasize snoozed rows in `TasksView` with "snoozed until <date>".
- [ ] T021 [US3] Wire TaskRow overflow **Snooze** → `SnoozeDialog` and open `TaskDetailSheet` from the row; then `cd backend && clasp push && clasp deploy -i <deploymentId>` and validate Scenarios C + G.

**Checkpoint**: Scenarios C + G pass.

---

## Phase 6: User Story 4 - Event end date on create + edit (Priority: P2)

**Goal**: Set an event's end (incl. multi-day) on create and via a new minimal edit sheet; reject end < start.

**Independent Test**: Quickstart Scenario D.

- [ ] T022 [P] [US4] Add a pure `end`-before-`start` validator to `frontend/src/lib/datetime.ts` + a unit test in `frontend/src/lib/datetime.test.ts`.
- [ ] T023 [US4] In `frontend/src/components/quickadd/QuickAddSheet.tsx`, add an optional end date/time to the event path with a clear end<start guard (keep the existing end=start+1h default via `buildEventPayload`).
- [ ] T024 [US4] Add `useUpdateEvent` (`events.update`, invalidate `['events']`) to `frontend/src/hooks/useMutations.ts`.
- [ ] T025 [US4] Create `frontend/src/components/event/EventEditSheet.tsx` (title/start/end/owner) using `useUpdateEvent`, validating end ≥ start.
- [ ] T026 [US4] Add an Edit affordance to `frontend/src/components/event/EventDetailSheet.tsx` opening `EventEditSheet`; validate Scenario D.

**Checkpoint**: Scenario D passes.

---

## Phase 7: User Story 5 - Review activity in the Feed (Priority: P3)

**Goal**: Polished reverse-chron feed with attribution and empty state (basic feed shipped in US1).

**Independent Test**: Quickstart Scenario E.

- [ ] T027 [US5] Polish `frontend/src/components/feed/FeedView.tsx`: confirm newest-first, plain-language summaries with Max/Jaz attribution (never shared account), snooze/unsnooze verbs render (from US3), and the friendly empty state; validate Scenario E.

**Checkpoint**: Scenario E passes.

---

## Phase 8: User Story 6 - Manage recurring rules & templates from More (Priority: P3)

**Goal**: Full create/edit/delete for recurring rules and prep templates under More.

**Independent Test**: Quickstart Scenario F.

- [ ] T028 [P] [US6] Create `frontend/src/hooks/useRecurring.ts` holding `recurring.list` plus create/update/delete mutations (self-contained to avoid `useMutations.ts` conflicts).
- [ ] T029 [P] [US6] Create `frontend/src/hooks/useTemplates.ts` holding `templates.list` plus create/update/delete mutations.
- [ ] T030 [US6] Create `frontend/src/components/more/RecurringManager.tsx`: list rules + create/edit form (title/cadence/anchorDate/defaultOwner, optional season) + delete-with-confirm (FR-016/018/019).
- [ ] T031 [US6] Create `frontend/src/components/more/TemplatesManager.tsx`: list templates + create/edit form (eventType/taskTitle/offsetDays/defaultOwner) + delete-with-confirm (FR-017/018/019).
- [ ] T032 [US6] Wire both managers into `MoreView.tsx` navigation; validate Scenario F.

**Checkpoint**: Scenario F passes; all stories functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T033 [P] Run `/impeccable audit` across all new UI (WCAG 2.1 AA: contrast on owner tints, 44px targets, focus rings, `aria-current`, focus-trapped sheets/dialogs, `prefers-reduced-motion`).
- [ ] T034 [P] Ensure `npm run build` is clean (tsc + Vite, zero type errors) and all Vitest units green.
- [ ] T035 Update `BACKLOG.md` (stage/PR link), refresh any README/spec deltas discovered during build, and run the full `quickstart.md` against the live deployment.

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T003)** blocks every user story.
- **US1 (T004–T007)** depends on Foundational; it is the MVP and creates the section files US2/US5/US6 later enrich.
- **US2 (T008–T012)** depends on US1 (enriches `TasksView`, adds `TaskRow` menu).
- **US3 (T013–T021)** depends on US2 (needs the Tasks list + `TaskRow` overflow menu and `lib/tasks.ts`). Backend T013–T016 can proceed in parallel with frontend T017–T018.
- **US4 (T022–T026)** depends only on Foundational + existing event components — independent of US2/US3.
- **US5 (T027)** depends on US1 (basic feed) and benefits from US3 (snooze verbs).
- **US6 (T028–T032)** depends on US1 (`MoreView` hub).
- **Polish (T033–T035)** after all desired stories.

### Parallel Opportunities

- US1: T004, T005, T006 are different files → run together.
- US2: T008 (`lib/tasks.ts`) + T009 (test) alongside; then T010–T012.
- US3: backend T013–T016 in parallel with frontend T017 + T018 (different files); converge at T019–T021.
- US6: T028 + T029 (separate hook files) in parallel; then T030–T032.

---

## Implementation Strategy

### MVP (US1)

Setup → Foundational → US1 → **stop & validate Scenario A**. Ships a navigable shell on both form factors (already a visible win over today's dead stubs).

### Incremental delivery

US2 (task completion everywhere) → US3 (snooze; deploy backend once) → US4 (event end/edit) → US5 (feed polish) → US6 (More managers). Each is an independently testable increment mapping to one quickstart scenario; deploy/demo at any checkpoint.

---

## Notes

- Only US3 touches `/backend`; deploy it once (T021) with `clasp deploy -i <deploymentId>` to keep the stable URL, and re-authorize is **not** needed (no `appsscript.json` scope change).
- `[P]` = different files, no incomplete-task dependency.
- Commit after each task or logical group; every backend write stays idempotent + locked + ActivityLog-logged.
- Definition of done per task: matches spec, `npm run build` clean, `/impeccable audit` before PR, spec/README updated on any behavior change.
