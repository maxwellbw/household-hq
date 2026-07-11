# Tasks: UX Fix Batch — Task Editing & Dead Controls

**Input**: Design documents from `/specs/016-ux-fix-batch/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contract.md, quickstart.md

**Tests**: Included — the `frontend` package has an established Vitest suite and the DoD requires it stays green (SC-005).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US4 map to the spec's user stories
- All paths are under `frontend/` (frontend-only feature; no backend change)

## Path Conventions

Web app — frontend at `frontend/src/`. Backend untouched.

---

## Phase 1: Setup

**Purpose**: Establish a green baseline before changes.

- [X] T001 Confirm baseline is green: run `npm test` and `npm run build` in `frontend/` and note the current passing count (regression baseline for SC-005).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared mutation used by US2, US3, and the calendar task-edit path in US4. No user story that edits a task can proceed without it.

- [X] T002 Add `useUpdateTask` to `frontend/src/hooks/useMutations.ts`: a mutation taking `{ id: string; title?: string; owner?: Owner; dueDate?: string }` that calls `apiCall('tasks.update', payload, …)` with `session.token`/`actingPerson`, routes errors through `handleAuthError`, and `onSuccess` invalidates `queryKey: ['tasks']`. Mirror the shape of the existing `useUpdateEvent`. (`dueDate: ''` clears the date per research R2.)

**Checkpoint**: `useUpdateTask` compiles and is importable; no UI wired yet.

---

## Phase 3: User Story 1 — Undated quick-add lands in Someday (Priority: P1) 🎯 MVP

**Goal**: A one-time task quick-added with a blank date is created undated and appears in Someday, not on today.

**Independent test**: Quick-add a task with the date field empty → it appears in Someday and on no calendar date; adding with a date still lands on that date.

- [X] T003 [US1] Fix `frontend/src/lib/quickAdd.ts` `buildOneTimeTaskPayload`: only include `dueDate` when the input provides one (omit the key when blank) instead of `input.dueDate || todayKey(timezone)`. Update the function/JSDoc ("defaults to today" is no longer true); leave `timezone` handling consistent with `useCreateOneTimeTask`'s call site (drop the now-unused param only if it can be done without touching the caller's contract).
- [X] T004 [P] [US1] Update `frontend/src/lib/quickAdd.test.ts`: assert a blank/undefined `dueDate` yields a payload with **no** `dueDate` key (not today's date), and a provided `dueDate` passes through unchanged.

**Checkpoint**: US1 independently shippable — blank-date tasks reach Someday.

---

## Phase 4: User Story 2 — Edit & reassign a task from its detail view (Priority: P1) 🎯 MVP

**Goal**: The task detail sheet opens read-only with an Edit button that reveals title/owner/dueDate editing (dueDate clearable), Save commits via `tasks.update`, Cancel discards; snooze history + Un-snooze remain.

**Independent test**: Open a task, Edit, change title + owner + due date, Save → all reflected in list and calendar without refresh; clearing the date moves it to Someday; blank title blocks Save.

**Depends on**: T002 (`useUpdateTask`).

- [X] T005 [US2] Create `frontend/src/components/task/TaskEditSheet.tsx` mirroring `EventEditSheet.tsx`: fields **Title** (required, non-empty after trim → inline `role="alert"` error), **Who** (max/jaz/both selector reusing `ALL_OWNERS`/`ownerStyle`, `aria-pressed`), and **Due date** (`type="date"`, with an explicit **Clear date** affordance that sends `dueDate: ''`). Submit calls `useUpdateTask.mutateAsync({ id, title, owner, dueDate })`, surfaces `ApiError` field errors, and calls `onClose` on success. Reuse `useDialogA11y`, 44px targets, and the accent Save button styles from `EventEditSheet`.
- [X] T006 [US2] Rework `frontend/src/components/task/TaskDetailSheet.tsx`: add `showEdit` state and an **Edit** button in the header (mirror `EventDetailSheet`'s pattern); when `showEdit`, render `TaskEditSheet` for the task; keep the read-only view (owner chip, due, snooze history, Un-snooze) as the default. Add an optional `initialEdit?: boolean` prop that seeds `showEdit` (consumed by US3).
- [X] T007 [P] [US2] Add `frontend/src/components/task/TaskEditSheet.test.tsx`: (a) empty/whitespace title blocks submit with an error and fires no mutation; (b) changing owner and saving calls `tasks.update` with the new owner; (c) Clear date sends `dueDate: ''`; (d) Cancel/close fires no mutation.
- [X] T008 [P] [US2] Add/extend `frontend/src/components/task/TaskDetailSheet.test.tsx`: sheet opens read-only (no editable fields until Edit); tapping **Edit** reveals the form; a successful save closes the sheet; snooze history + Un-snooze still render for a snoozed task.

**Checkpoint**: US2 independently shippable — tasks are fully editable from the list's detail sheet.

---

## Phase 5: User Story 3 — "Edit due" quick action works (Priority: P2)

**Goal**: The `TaskRow` overflow "Edit due" opens the same `TaskDetailSheet` already in edit mode (not a no-op, not a separate picker).

**Independent test**: Row ⋮ → Edit due → detail sheet opens in edit mode; pick a date, Save → due date updates; Cancel leaves it unchanged.

**Depends on**: T006 (`initialEdit` prop on `TaskDetailSheet`).

- [X] T009 [US3] Wire `onEditDue` in `frontend/src/components/task/TasksView.tsx`: add state to open the detail sheet in edit mode (e.g. `detailEdit` boolean alongside `detailTask`), pass `onEditDue={() => { setDetailTask(task); setDetailEdit(true) }}` to each `TaskRow`, and pass `initialEdit={detailEdit}` to `TaskDetailSheet` (reset on close). Ensure the existing title-tap path opens read-only (`initialEdit={false}`).
- [X] T010 [P] [US3] Add a test in `frontend/src/components/task/` (TasksView-level or extend TaskRow test): selecting **Edit due** from the overflow menu opens the detail sheet already in edit mode (form visible), and the menu item is no longer a no-op.

**Checkpoint**: US3 shippable — no dead "Edit due" control remains.

---

## Phase 6: User Story 4 — Calendar items open their details on tap (Priority: P2)

**Goal**: Tapping an event opens `EventDetailSheet` (desktop month-grid + mobile month-agenda); tapping a task opens `TaskDetailSheet` (same edit experience).

**Independent test**: On desktop and mobile, tap an event → event sheet opens; tap a task → task sheet opens; edit that task → reflected on the calendar.

**Depends on**: T006 (`TaskDetailSheet` usable standalone).

- [X] T011 [US4] In `frontend/src/components/calendar/CalendarHome.tsx`, handle task taps: add `selectedTaskId` state; in `onEventClick`, when the id starts with `task-`, strip the prefix, look up the task in `visibleStandaloneTasks`, and set `selectedTaskId`; render `TaskDetailSheet` for the selected task (with `onClose` clearing it). Keep event handling intact.
- [X] T012 [US4] Investigate & fix event-tap not opening the sheet (research R4b) using the preview tools: click an event chip in `month-grid` (desktop) and `month-agenda` (mobile) and confirm whether `onEventClick` fires. Apply the minimal fix so both views open `EventDetailSheet` on first tap (likely registering the agenda custom component key and/or correcting the handler); record the confirmed root cause in a one-line comment and in research.md R4b.
- [X] T013 [P] [US4] Add tests in `frontend/src/components/calendar/CalendarHome.test.tsx`: simulating the click callback with an event id opens `EventDetailSheet`; with a `task-<id>` id opens `TaskDetailSheet`; guards against re-introducing the ignored-task-tap regression.

**Checkpoint**: US4 shippable — every calendar item opens its details.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Verify the whole batch, a11y, and no regressions.

- [X] T014 Run `npm test` and `npm run build` in `frontend/`; both must be green with no type errors and no drop from the T001 baseline (SC-005).
- [X] T015 Run the [quickstart.md](quickstart.md) validation end-to-end on a desktop viewport **and** a mobile viewport (all four stories, including the regression sweep for complete/reopen, snooze/un-snooze, and Someday scheduling).
- [X] T016 `/impeccable audit` the new `TaskEditSheet` and the edited `TaskDetailSheet`/`CalendarHome` surfaces (WCAG 2.1 AA, owner-color identity, 44px targets) and fix any findings before PR.
- [X] T017 Update `BACKLOG.md` (016 stage + PR link) per the CLAUDE.md loop; note that no backend deploy was required (frontend-only).

---

## Dependencies & Execution Order

- **Setup (T001)** → baseline.
- **Foundational (T002)** blocks US2, US3, and US4's task-edit path. Do it first.
- **US1 (T003–T004)** is fully independent — can run in parallel with everything (no dependency on T002).
- **US2 (T005–T008)** depends on T002; T006 must land before US3 (needs `initialEdit`) and before US4's task sheet reuse (T011).
- **US3 (T009–T010)** depends on T006.
- **US4 (T011–T013)** depends on T006; T012 is independent of the others and can proceed in parallel.
- **Polish (T014–T017)** last.

### Parallel opportunities

- T003+T004 (US1) can proceed alongside T002/US2 work — different files.
- Test tasks marked [P] (T004, T007, T008, T010, T013) touch their own files and can be written in parallel with sibling implementation once the component under test exists.
- T012 (event-tap investigation) is independent of T011 and can run in parallel.

## Implementation Strategy

- **MVP = US1 + US2** (both P1): restores the Someday list and makes tasks editable — the two highest-impact gaps. Shippable on their own.
- **Increment 2 = US3** (P2): eliminates the dead "Edit due" control (small, builds on US2).
- **Increment 3 = US4** (P2): restores calendar tap-to-open for events and tasks.
- Each story has its own checkpoint and independent test; land and verify per checkpoint before moving on.
