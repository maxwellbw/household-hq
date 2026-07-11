---
description: "Task list for feature 022 — UX fix batch 2"
---

# Tasks: UX Fix Batch 2

**Input**: Design documents from `specs/022-ux-fix-batch-2/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED — this project ships Vitest + RTL suites per feature (DoD: "Frontend passes `npm run build` with no type errors"; existing `*.test.tsx` suites stay green). Test tasks are written alongside their implementation.

**Organization**: Grouped by user story. Frontend-only; no backend or `clasp` work. All paths under `frontend/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (snooze from calendar), US2 (delete), US3 (collapse Open)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new deps or scaffolding — confirm the baseline is green before touching anything.

- [X] T001 Confirm baseline green: from `frontend/` run `npm run build` and `npm run test` and note the current passing count (touch nothing until both pass). — build clean, 202/202 tests pass.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: There is **no cross-story foundational work** — US1 reuses the existing `SnoozeDialog`, US3 is self-contained in `TasksView`, and US2's shared pieces (`ConfirmDialog`, delete hooks) are scoped to US2 and live in its phase. No global blocker exists; user stories may proceed independently after Phase 1.

*(intentionally empty — see note above)*

---

## Phase 3: User Story 1 — Snooze a task from the calendar (Priority: P1) 🎯 MVP

**Goal**: `TaskDetailSheet` (opened by calendar task chips and Tasks-tab rows) gains a Snooze action that opens the existing `SnoozeDialog`, so a task can be pushed out without leaving the calendar.

**Independent Test**: Open a calendar task chip → detail → Snooze → pick a date → task moves to that date and the snooze appears in history, all without visiting the Tasks tab.

### Implementation for User Story 1

- [X] T002 [US1] In `frontend/src/components/task/TaskDetailSheet.tsx`, add local `showSnooze` state and a **Snooze** button in the read-only view (shown for tasks with a `dueDate`, in any status; sits alongside the existing Un-snooze which stays gated on `status === 'snoozed'`). Style/touch-target/focus-ring consistent with the existing Un-snooze button (min 44px, focus-visible outline).
- [X] T003 [US1] In the same file, render `<SnoozeDialog task={task} onClose={...} />` stacked over the sheet (mirror the existing `showEdit`/`TaskEditSheet` pattern). Deviation from plan: closing the snooze sub-dialog (cancel OR success) just returns to the read-only detail (`setShowSnooze(false)`) rather than closing the whole sheet — matches the Edit sub-sheet's behavior and avoids closing everything on a mere Cancel. Import `SnoozeDialog`.

### Tests for User Story 1

- [X] T004 [US1] In `frontend/src/components/task/TaskDetailSheet.test.tsx`, add cases: (a) a dated open task shows a Snooze button; (b) clicking it opens the snooze dialog (assert the "Snooze task" dialog / date input appears); (c) an already-snoozed task shows **both** Snooze and Un-snooze. — 3 new tests, all passing (8/8 in file).

**Checkpoint**: Snooze reachable from the calendar; US1 independently shippable.

---

## Phase 4: User Story 2 — Delete an event or task from its detail view (Priority: P1)

**Goal**: A confirmed Delete action on `TaskDetailSheet` and `EventDetailSheet`, wired to existing `tasks.delete` / `events.delete`. Recurring-generated task → instance-only copy; event → prep-count copy; failures fail gracefully.

**Independent Test**: Delete a throwaway task and a throwaway event through the UI with a confirm step, without touching the spreadsheet; recurring occurrence delete leaves the rule intact.

### Foundational for User Story 2 (shared within this story)

- [X] T005 [US2] Create `frontend/src/components/ui/ConfirmDialog.tsx` — a reusable confirm modal modeled on `SnoozeDialog`: overlay, `role="dialog"` + `aria-modal`, `useDialogA11y(panelRef, onClose)` focus trap + Esc, props `{ title, body?, confirmLabel, onConfirm, onClose, isPending?, destructive? }`, Cancel + a destructive-styled Confirm button, initial focus on Cancel. `body` accepts a string/ReactNode so the recurring + prep-count lines can be passed in.
- [X] T006 [US2] In `frontend/src/hooks/useMutations.ts`, add `useDeleteTask` (`authedCall('tasks.delete', { id })`, invalidate `['tasks']`) and `useDeleteEvent` (`authedCall('events.delete', { id })`, invalidate **both** `['events']` and `['tasks']` since prep tasks are purged server-side). Plain pending→invalidate (no optimistic removal), `handleAuthError(err)` in the catch, matching the other hooks. On error the caller shows a toast + the invalidate refreshes the list (FR-012).

### Implementation for User Story 2

- [X] T007 [US2] In `frontend/src/components/task/TaskDetailSheet.tsx`, add a **Delete** button in the read-only view (next to Snooze, not behind Edit) that opens `ConfirmDialog`. Confirm body branches on `task.recurringId`: non-empty → "This deletes only this occurrence. The recurring rule keeps making new ones (manage rules in More → Recurring)."; else "Delete this task?". On confirm call `useDeleteTask`; on success toast + `onClose()`; on error toast "Couldn't delete — it may have already been removed" + `onClose()` (invalidate already refreshes). (Depends on T005, T006; same file as T002/T003 — sequential.)
- [X] T008 [US2] In `frontend/src/components/event/EventDetailSheet.tsx`, add a **Delete** button opening `ConfirmDialog`. Body: "Delete this event?" plus, when `event.tasks.length > 0`, "Its N prep task{s} will also be removed." (singular/plural on N). On confirm call `useDeleteEvent`; success toast + `onClose()`; error toast + `onClose()`. (Depends on T005, T006.)
- [X] T009 [US2] Verify `frontend/src/components/calendar/CalendarHome.tsx` — no change needed. `selectedEvent`/`selectedTask` are derived via `.find()` on the live query data every render, and delete already calls the sheet's `onClose` (nulling `selectedEventId`/`selectedTaskId`) on both success and failure paths, so there's no stale-prop window. (renders `EventDetailSheet`) closes the sheet cleanly after a delete — the deleted event must not linger via stale props; adjust the `onClose`/selected-event state only if needed (likely no change).

### Tests for User Story 2

- [X] T010 [P] [US2] In `frontend/src/components/task/TaskDetailSheet.test.tsx`, add cases: Delete button opens confirm; a task **with** `recurringId` shows the instance-only/rule-keeps-generating copy; confirming calls the delete action (mock) and closes; Cancel deletes nothing. — also added `useDeleteTask` to the mock and a `beforeEach(vi.clearAllMocks)` (mock call-count leaked across tests without it). 6 new tests.
- [X] T011 [P] [US2] Added `frontend/src/components/event/EventDetailSheet.test.tsx` (new file): Delete opens confirm; body shows the exact prep-task count when the event has prep tasks (singular + plural), and omits that clause when it has none (scoped query with `within(dialog)` — the sheet's own "No prep tasks for this event." text otherwise false-matches); confirm calls the delete action (mock) and closes; Cancel deletes nothing. 6 tests. Also added `useDeleteTask`/`useDeleteEvent` mocks to `CalendarHome.test.tsx` and `useDeleteTask` to `TasksView.test.tsx` — both render the detail sheets unconditionally and the new hooks are called on every render, not just on Delete click.

**Checkpoint**: Events and tasks deletable in-app with correct confirm copy; recurring rules untouched.

---

## Phase 5: User Story 3 — Collapse the Open tasks section (Priority: P2)

**Goal**: The Open section on the Tasks tab becomes collapsible, matching Done's chevron affordance (defaults expanded).

**Independent Test**: On the Tasks tab, collapse Open → tasks hide, "Open (N)" header stays; expand → tasks return; affordance matches Done.

### Implementation for User Story 3

- [X] T012 [US3] In `frontend/src/components/task/TasksView.tsx`, add `openExpanded` state (default `true`). Replace the static "Open" `<h2>` with the same `aria-expanded` chevron-header button pattern Done uses, showing "Open (N)" with N = open count; wrap the existing Open body (including the empty / no-filter / all-caught-up branches) so it renders only when `openExpanded`. Keep Done's behavior unchanged; ensure the header is a 44px touch target with a focus ring.

### Tests for User Story 3

- [X] T013 [US3] In `frontend/src/components/task/TasksView.test.tsx`, add cases: Open header toggles `aria-expanded`; collapsing hides the open task rows while the "Open" header/count stays; expanding shows them again. — 3 new tests, all passing.

**Checkpoint**: Open and Done behave identically; pattern ready for feature 021's Someday section.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 Run `npm run build` (no type errors) and `npm run test` (all suites green, count ≥ baseline from T001 plus the new tests) from `frontend/`. — build clean, 219/219 tests pass (baseline 202 + 17 new).
- [X] T015 Run `/impeccable audit` on the changed sheets/dialogs (new Snooze/Delete buttons, `ConfirmDialog`, collapsible Open header) and fix any WCAG 2.1 AA findings (contrast, focus order, touch targets, `aria-*`). — Live browser pass blocked by the sandboxed OAuth wall (documented existing limitation — same as 016/017/018); did a code-level audit instead. Found and fixed one real issue: the new `ConfirmDialog`'s Cancel/Confirm buttons were under the 44px touch target (matched `SnoozeDialog`'s pre-existing gap instead of `TaskEditSheet`'s `min-h-[44px]` pattern) — added `min-h-[44px]`, since it's a new component gating a destructive action. Verified contrast: `text-danger` on white ≈6.35:1, `text-ink-muted` body copy ≈5.68:1 — both pass AA. No new color tokens, no AI-slop patterns introduced. Full suite re-run green after the fix (219/219).
- [X] T016 Walk `specs/022-ux-fix-batch-2/quickstart.md` US1/US2/US3 + regression sanity against the running app (`npm run dev` / preview); record results for the PR. — Live walkthrough blocked by the sandboxed OAuth wall (same documented limitation as 016/017/018 — "the sandboxed preview can't do real Google OAuth"). Verified all quickstart scenarios instead via the Vitest/RTL suites, which exercise the same DOM interactions the quickstart script describes (button presence, dialog open/confirm/cancel, copy branching on `recurringId` and prep count, collapse/expand). **A live desktop + mobile pass against the deployed app is still recommended before merge**, per the existing pattern for prior frontend-only features — flagging as a follow-up, not a blocker (matches how 016/017/018 shipped).

---

## Dependencies & Execution Order

### Phase / story dependencies

- **Phase 1 (Setup)**: none — do first.
- **Phase 2 (Foundational)**: empty; no global blocker.
- **US1 (Phase 3)**, **US2 (Phase 4)**, **US3 (Phase 5)**: each independent and independently testable. US1 and US2 both touch `TaskDetailSheet.tsx`, so within a single working copy do US1's edits (T002–T003) before US2's (T007) to avoid conflicting edits to that file.
- **Polish (Phase 6)**: after all desired stories.

### Within stories

- US2: T005 + T006 (ConfirmDialog + hooks) before T007/T008 (consumers). T007 after US1's T002/T003 (same file). T010/T011 after their components exist.

### Parallel opportunities

- T010 and T011 are `[P]` — different test files, once their components are done.
- Across stories with multiple people: US3 (T012–T013) is fully independent of US1/US2 and can run in parallel. US1 and US2 share `TaskDetailSheet.tsx`, so serialize those file edits.

---

## Implementation Strategy

### MVP first

1. Phase 1 (baseline green).
2. US1 (snooze from calendar) → validate → shippable MVP.
3. US2 (delete) → validate.
4. US3 (collapse Open) → validate.
5. Phase 6 polish (build/test, audit, quickstart) before PR.

### Notes

- Frontend-only: no `clasp push`/`deploy`; backend actions (`tasks.snooze`, `tasks.delete`, `events.delete`) already exist and are self-tested.
- Reuse over rebuild: `SnoozeDialog` and the `useDialogA11y`/overlay pattern are the references; `ConfirmDialog` is the only new component.
- Commit after each story; stop at any checkpoint to validate independently.
