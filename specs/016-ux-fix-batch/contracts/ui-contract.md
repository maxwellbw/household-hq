# UI Behavior Contract: UX Fix Batch

No new API surface. This documents the frontend behavior contract and the existing backend calls it uses.

## Backend calls used (all pre-existing)

| Action | Payload | When |
|--------|---------|------|
| `tasks.create` | `{ title, owner }` (no `dueDate`) | Quick-add with blank date → undated task (US1). |
| `tasks.create` | `{ title, owner, dueDate }` | Quick-add with a date (unchanged). |
| `tasks.update` | `{ id, title?, owner?, dueDate? }` (`dueDate:''` clears) | Save from task edit sheet (US2/US3). |

All `tasks.*` calls already append to ActivityLog and (for date/owner changes) update the calendar mirror on the backend. No new action, column, scope, or auth path.

## Interaction contract (per requirement)

### US1 — undated quick-add
- **C1**: Submitting the quick-add task form with the date field empty → `tasks.create` payload has **no** `dueDate` key. (FR-001)
- **C2**: With a date → `dueDate` equals the entered value exactly. (FR-002)
- **C3**: Resulting undated task renders in Someday, never on the calendar. (FR-003)

### US2 — task detail edit
- **C4**: `TaskDetailSheet` opens read-only; no field mutable until **Edit** is pressed. (FR-004)
- **C5**: In edit mode the user can change title, owner, and due date (including clear). (FR-005..007)
- **C6**: **Save** issues one `tasks.update` with all changed fields; on success the sheet closes/returns to read-only and `['tasks']` is invalidated → change visible in list, calendar, dashboard without refresh. (FR-007)
- **C7**: **Cancel/close** issues no request and discards pending edits. (FR-008)
- **C8**: Empty/whitespace title blocks Save with an inline field error (no request). (FR-009)
- **C9**: Snooze history + Un-snooze remain available in the read-only view for snoozed tasks. (FR-010)

### US3 — "Edit due" quick action
- **C10**: Choosing "Edit due" from a `TaskRow` overflow menu opens `TaskDetailSheet` already in edit mode, focused on the due date. Not a no-op, not a separate picker. (FR-011)
- **C11**: Save/cancel behavior identical to C6/C7. (FR-012)

### US4 — calendar taps
- **C12**: Tapping an event on the calendar opens `EventDetailSheet` — on **both** `month-grid` (desktop) and `month-agenda` (mobile), first tap. (FR-013)
- **C13**: Tapping a task on the calendar opens `TaskDetailSheet` (same detail/edit experience as the list). (FR-014)
- **C14**: Editing a task opened from the calendar and saving reflects on the calendar via `['tasks']` invalidation. (US4 scenario 4)

## Non-regression contract
- **C15**: Complete/reopen, snooze/un-snooze, and Someday scheduling (feature 013) behave exactly as before. (SC-005)
- **C16**: `npm run build` passes with no type errors; existing Vitest suite stays green. (SC-005)
