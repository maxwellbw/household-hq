---
description: "Task list for feature 013 — Someday List"
---

# Tasks: Someday List

**Input**: Design documents from `/specs/013-someday-list/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-tasks-schedule.md, quickstart.md

**Tests**: Only the pure logic is unit-tested (selector, confirm gate, payload builder) per plan.md; UI is validated via quickstart + `/impeccable audit`. No backend/SelfTest tasks — no backend code changes.

**Organization**: Tasks grouped by user story (US1/US2 are P1; US3 is P3 and deferrable).

## Path Conventions

Web app, **frontend-only** for this feature. All paths under `frontend/`. `backend/` is untouched (scheduling reuses the existing `tasks.update` action).

---

## Phase 1: Setup

- [X] T001 Confirm no new dependencies are needed and establish a clean baseline: from `frontend/`, run `npm install`, `npm run build` (zero type errors), and start the dev server against the live backend. Sign in and hand-create two open, standalone, undated tasks in the Tasks tab for validation (`Air-duct cleaning`/`both`, `Carpet cleaning`/`jaz`).

---

## Phase 2: Foundational (blocking prerequisites for US1 + US2 + US3)

**Purpose**: Pure, unit-testable primitives every story builds on. No UI here.

- [X] T002 [P] Add a pure `somedayTasks(model, visibleOwners)` selector to `frontend/src/lib/tether.ts` returning `model.standaloneTasks.filter(t => t.status === 'open' && !t.dueDate && visibleOwners.has(t.owner))`, sorted by `title.localeCompare`. Export it alongside `buildCalendarModel` (data-model.md "SomedayTask").
- [X] T003 [P] Create `frontend/src/lib/schedule.ts` with the pure `ScheduleDraft` type and helpers `canConfirm(draft) = draft.date !== '' && draft.owner !== null` and `buildSchedulePayload(draft) = { id, dueDate: draft.date, owner: draft.owner }` (data-model.md "ScheduleDraft"/"buildSchedulePayload").
- [X] T004 [P] Unit-test the primitives: extend `frontend/src/lib/tether.test.ts` for `somedayTasks` (excludes dated, done, snoozed, and event-attached tasks; respects owner filter; disjoint from dated standalone tasks) and add `frontend/src/lib/schedule.test.ts` for `canConfirm` (false unless date AND owner set) and `buildSchedulePayload`.

**Checkpoint**: `npm run build` + `npm run test` green; primitives ready.

---

## Phase 3: User Story 1 — See and manage undated "someday" tasks (Priority: P1) 🎯 MVP

**Goal**: Undated open standalone tasks appear in a Someday list below the calendar, owner-filtered, completable/reopenable in place.

**Independent Test**: Create an undated task; it shows in Someday with its owner; toggling owner chips scopes it; a dated task never appears; complete → leaves list, reopen → returns; empty filter shows a calm empty state.

- [X] T005 [US1] Create `frontend/src/components/task/SomedayList.tsx`: consume `useTasks()` + `useSettings()` + `buildCalendarModel`, derive rows via `somedayTasks(model, visibleOwners)`, render each with the existing `TaskRow` (title + owner chip + check-off), under a labelled "Someday" heading with list semantics. Accept `visibleOwners` as a prop.
- [X] T006 [US1] Render `<SomedayList visibleOwners={visibleOwners} />` in `frontend/src/App.tsx` inside the `active === 'calendar'` branch, below `<CalendarHome/>`, and adjust that branch's layout so the calendar takes a bounded height and the Someday list flows/scrolls beneath it — no nested fighting scrollbars, no horizontal scroll at 375px (research.md R2).
- [X] T007 [US1] Confirm complete/reopen works from Someday rows by reusing `TaskRow`'s existing `useCompleteTask`/`useReopenTask`; verify a completed task leaves the open Someday list (status filter) and reopening returns it, undated (FR-005).
- [X] T008 [US1] Add the empty state (calm copy when no undated tasks match the current filter, FR-013) and loading/error handling consistent with the rest of the home view; ensure owner chip uses identity color tokens, not decoration (PRODUCT.md).

**Checkpoint**: US1 fully usable on its own — the MVP. Someday is visible, filtered, and completable.

---

## Phase 4: User Story 2 — Schedule a someday task by tapping it (Priority: P1)

**Goal**: Tapping a someday task opens a dialog asking date (empty) + owner (no pre-selection); confirm disabled until both set; on confirm the task is scheduled and moves to the calendar.

**Independent Test**: Tap a task → dialog with empty date + unselected owner; confirm disabled until both chosen; owner not inferred from signed-in user; confirm → task leaves Someday, appears on calendar with chosen owner, logs an update; cancel → no change; error → stays in Someday with a toast.

- [X] T009 [P] [US2] Add `useScheduleTask()` to `frontend/src/hooks/useMutations.ts`, cloning `useUpdateEvent()`: `apiCall('tasks.update', buildSchedulePayload(draft), { token, actingPerson })`, `onSuccess` → invalidate `['tasks']`, errors via `handleAuthError` then re-throw (contracts/api-tasks-schedule.md).
- [X] T010 [P] [US2] Create `frontend/src/components/task/ScheduleTaskDialog.tsx`: labelled native `<input type="date">` (empty default, `min` = today in household tz), a 3-option owner segmented control with **no** pre-selected option (Max/Jaz/Both, owner color tokens), Confirm disabled via `canConfirm`, and Cancel. Focus-trapped, keyboard-operable, `prefers-reduced-motion`, ≥44px targets (research.md R5, SC-006).
- [X] T011 [US2] Wire tapping a Someday row to open `ScheduleTaskDialog` for that task (pass `taskId`, `date: ''`, `owner: null`); on Confirm call `useScheduleTask`, show pending state, close on success, and on failure keep the task in Someday with a "couldn't schedule — try again" toast (FR-010/FR-014). Cancel discards with no write.
- [ ] T012 [US2] Validate the surface transition end-to-end: after a successful schedule the task drops out of Someday and appears on the calendar on the chosen day without manual refresh (invalidate → refetch), and an `update` row appears in ActivityLog/Feed (FR-009/FR-015, SC-005). No code beyond the invalidate should be needed — confirm the emergent behavior.

**Checkpoint**: US1 + US2 together are the committed deliverable — see and schedule undated tasks on any device.

---

## Phase 5: User Story 3 — Drag a someday task onto a calendar day (desktop) (Priority: P3, optional/deferrable) — ⛔ DEFERRED

> **Deferred 2026-07-10.** No code written. US3 was investigated (T015 gate) and found too fragile to ship without coupling to Schedule-X internals that produce wrong dates on month navigation. See spec.md US3 for the full rationale. Revisit if Schedule-X exposes `data-date` on month-grid cells.

- [~] T013 [US3] ~~Deferred — no draggable attribute added.~~
- [~] T014 [US3] ~~Deferred — no drop handler added.~~
- [~] T015 [US3] **Executed.** Investigated drop-date resolution: `sx__month-grid-day` has no `data-date`; `sx__month-grid-day__header-date` renders day number only; `is-leading-or-trailing` class is keyed to `selectedDate` month (not viewed month), making reconstruction wrong when navigating. US3 deferred per constitution IV. Deferral recorded in spec.md + BACKLOG.md.

**Checkpoint**: US3 explicitly deferred; US1 + US2 are the committed deliverable.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T016 [P] Run `/impeccable audit` on `SomedayList` + `ScheduleTaskDialog` and resolve findings against DESIGN.md/PRODUCT.md and WCAG 2.1 AA (contrast on owner tints, focus rings, 375px no horizontal scroll, calm warmth).
- [ ] T017 [P] Final `npm run build` (zero type errors) and `npm run test` (selector + schedule helpers) green.
- [ ] T018 Update `BACKLOG.md` — set 013 stage and add the PR link per the "start feature NNN" loop; note US3 status (shipped or deferred).

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T004)** → **US1 (T005–T008)** → **US2 (T009–T012)** → **US3 (T013–T015, optional)** → **Polish (T016–T018)**.
- US2 UI wiring (T011) depends on the US1 list existing; its hook (T009) and dialog (T010) are independent files and can be built in parallel with US1.
- US3 reuses the US2 dialog, so it depends on US2.

### Parallel opportunities

- Foundational: T002, T003, T004 are independent files → run together.
- US2: T009 (hook) and T010 (dialog) are different files with no interdependency → run together, then T011 wires them.
- Polish: T016 and T017 in parallel.

## Implementation Strategy

- **MVP = Phase 1–3 (US1)**: undated tasks become visible and completable — already closes the core "invisible data" gap.
- **Committed release = + Phase 4 (US2)**: tap-to-schedule on every device.
- **Stretch = Phase 5 (US3)**: desktop drag, shipped only if the drop-date resolution is clean; otherwise deferred without reopening the spec.
