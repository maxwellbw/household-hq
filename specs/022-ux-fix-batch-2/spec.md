# Feature Specification: UX Fix Batch 2

**Feature Branch**: `022-ux-fix-batch-2`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "UX fix batch 2 — three frontend-only fixes, every backend piece already exists. (a) Snooze from the calendar: TaskDetailSheet (which calendar task chips open) gains a Snooze action that opens the existing SnoozeDialog — today it only offers Un-snooze. (b) Delete events & tasks in the UI: wire events.delete/tasks.delete (already in Api.js, with gcal mirror cleanup) into the detail/edit sheets behind a confirm dialog; for recurring-generated tasks, delete the instance only + confirm (the rule keeps generating; rules are deleted in More → Recurring as today). (c) Collapsible Tasks-tab sections: the Open section becomes collapsible like Done already is."

## Clarifications

### Session 2026-07-11

- Q: When deleting an event (which also purges all its prep tasks, done and outstanding), what should the confirmation say? → A: Show the exact prep-task count in the confirmation (e.g., "Its 3 prep tasks will also be removed").
- Q: Where should the Delete action live for tasks and events? → A: In the read-only detail view, alongside Snooze — reachable without entering edit mode.

## User Scenarios & Testing *(mandatory)*

This is a batch of three independent, user-facing gap fixes. Each closes a case where the app already has the underlying capability but never surfaces it in a place the user naturally reaches for it. All three are frontend-only; no household data model or backend behavior changes.

### User Story 1 - Snooze a task from the calendar (Priority: P1)

Max or Jaz is looking at the calendar, sees a task chip for something they can't get to today, and wants to push it out a few days. Today, tapping the task chip opens its detail view, but the only date-shifting action offered there is "Un-snooze" — there is no way to *start* a snooze from the calendar. The user has to leave the calendar and go to the Tasks tab to snooze. This story adds a Snooze action to the task detail view opened from the calendar so the task can be pushed out without leaving the calendar context.

**Why this priority**: This is the most-used of the three flows — snoozing is a routine, near-daily coordination action, and the calendar is where scheduled items are reviewed. The gap forces a context switch on a common task, which is exactly the friction this batch exists to remove.

**Independent Test**: Open the calendar, tap a task chip to open its detail, invoke Snooze, pick a new date, and confirm the task moves to that date (and the snooze is reflected in its history) — all without navigating to the Tasks tab.

**Acceptance Scenarios**:

1. **Given** a task chip is visible on the calendar, **When** the user taps it and opens the detail view, **Then** a Snooze action is available alongside the existing actions.
2. **Given** the task detail view opened from the calendar, **When** the user invokes Snooze, **Then** the same snooze date picker used elsewhere in the app opens.
3. **Given** the snooze picker is open, **When** the user selects a new date and confirms, **Then** the task's due date moves to the chosen date, the change appears in the task's snooze history, and the calendar reflects the task at its new date.
4. **Given** a task that is already snoozed, **When** the user opens its detail from the calendar, **Then** both Snooze (push out further) and the existing Un-snooze action are available.

---

### User Story 2 - Delete an event or task from its detail view (Priority: P1)

Something was created by mistake, is no longer happening, or was a duplicate. The user opens that event or task and wants to remove it. Today there is no delete control anywhere in the UI, even though the capability exists — the only way to remove an item is to hand-edit the underlying spreadsheet. This story adds a Delete action, guarded by a confirmation step, to the detail/edit views for both events and tasks. Deleting an event also removes its mirrored copy from the shared Google Calendar (existing cleanup behavior).

**Why this priority**: The absence of any in-app delete is a hard blocker for normal use — mistakes and cancellations are unavoidable, and dropping to the spreadsheet defeats the point of the app. It ties for most important with Story 1.

**Independent Test**: Create a throwaway event and a throwaway task, open each, use Delete, confirm at the prompt, and verify both disappear from the app (and the event from the mirrored calendar) — with no spreadsheet editing.

**Acceptance Scenarios**:

1. **Given** an event's detail view is open, **When** the user chooses Delete, **Then** the confirmation prompt names how many of the event's prep tasks will also be removed (or omits that clause when there are none), and on confirm the event, its prep tasks, and its mirrored shared-calendar copy are removed and the deletion is recorded in the activity log.
2. **Given** a task's detail/edit view is open, **When** the user chooses Delete and confirms at the prompt, **Then** the task is removed from the app and the deletion is recorded in the activity log.
3. **Given** the confirmation prompt is showing, **When** the user cancels it, **Then** nothing is deleted and the item remains unchanged.
4. **Given** a task that was generated by a recurring rule, **When** the user deletes it and confirms, **Then** only that single occurrence is removed; the recurring rule is untouched and continues to generate future occurrences.
5. **Given** the user is about to delete a recurring-generated task, **When** the confirmation prompt appears, **Then** it makes clear that only this one occurrence is being deleted and that the rule keeps running (rules are still managed under More → Recurring).

---

### User Story 3 - Collapse the Open tasks section (Priority: P2)

On the Tasks tab, the Done section can already be collapsed to get it out of the way. The Open section cannot, so a long list of open tasks always takes the full height and can't be tucked away when the user wants to focus on another section. This story makes the Open section collapsible with the same expand/collapse affordance the Done section already uses.

**Why this priority**: A convenience and consistency fix rather than a blocker — the Open list is still fully usable today. It's lower priority than the two capability gaps above, but it removes an obvious inconsistency and sets the pattern the upcoming Someday section (feature 021) will adopt.

**Independent Test**: On the Tasks tab, collapse the Open section and confirm its tasks hide while its header/count stays visible; expand it and confirm the tasks return — matching how Done behaves.

**Acceptance Scenarios**:

1. **Given** the Tasks tab with open tasks, **When** the user collapses the Open section, **Then** its tasks are hidden while the section header (and its count) remains visible, matching the Done section's behavior.
2. **Given** the Open section is collapsed, **When** the user expands it, **Then** its tasks are shown again.
3. **Given** the Open and Done sections, **When** the user views the Tasks tab, **Then** both sections present the same collapse/expand affordance in a consistent way.

---

### Edge Cases

- **Snoozing a task with no current due date** (an undated / Someday task opened from another surface): out of scope here — snooze from the calendar concerns tasks that appear as chips, which are dated. Snoozing an undated task is not introduced by this feature.
- **Deleting an item that was already deleted or changed** (e.g., a stale sheet open on another device): the delete action should fail gracefully — the user sees that the item is already gone rather than a broken state, and the list refreshes.
- **Deleting an event that has attached prep tasks**: the confirmation states the exact count of prep tasks that will be removed with the event (FR-008a); the feature does not change the purge behavior, only surfaces it. Manually event-linked tasks that are not prep tasks are left untouched (existing backend behavior).
- **Collapse state persistence**: whether the Open section remembers being collapsed across visits should match whatever the Done section already does, so the two stay consistent.
- **Accidental deletion**: the confirmation step is the guard; there is no separate undo introduced by this feature.

## Requirements *(mandatory)*

### Functional Requirements

**Snooze from the calendar (Story 1)**
- **FR-001**: The task detail view reachable from a calendar task chip MUST offer a Snooze action, placed in the read-only detail view so it is reachable without entering edit mode.
- **FR-002**: Invoking Snooze MUST open the same snooze date picker the app already uses elsewhere, with no divergent behavior.
- **FR-003**: Confirming a snooze MUST move the task's due date to the chosen date and record the change in the task's visible snooze history.
- **FR-004**: For a task that is already snoozed, the detail view MUST offer both Snooze (push further out) and the existing Un-snooze action.

**Delete events & tasks (Story 2)**
- **FR-005**: Users MUST be able to delete an event from its read-only detail view (the delete control lives there, alongside the item's other actions, not gated behind edit mode).
- **FR-006**: Users MUST be able to delete a task from its read-only detail view, alongside Snooze.
- **FR-007**: Every delete MUST require an explicit confirmation step before the item is removed; cancelling the confirmation MUST leave the item unchanged.
- **FR-008**: Deleting an event MUST also remove its mirrored copy from the shared household calendar (existing cleanup behavior — not re-implemented).
- **FR-008a**: Deleting an event also purges all of its prep tasks (both completed and outstanding — existing backend behavior). The confirmation MUST state the exact number of prep tasks that will be removed alongside the event (e.g., "Its 3 prep tasks will also be removed"); when the event has no prep tasks, the confirmation omits that clause.
- **FR-009**: Deleting a recurring-generated task MUST remove only that single occurrence and MUST NOT alter or stop the recurring rule.
- **FR-010**: When the item being deleted is a recurring-generated task, the confirmation MUST clearly state that only this occurrence is affected and that the rule continues (managed under More → Recurring).
- **FR-011**: Every deletion MUST be recorded in the activity log, consistent with other state changes.
- **FR-012**: A delete that targets an item already removed or changed elsewhere MUST fail gracefully and refresh the view rather than leaving the UI in a broken state.

**Collapsible Open section (Story 3)**
- **FR-013**: The Open section on the Tasks tab MUST be collapsible and expandable.
- **FR-014**: When collapsed, the Open section MUST keep its header and count visible while hiding its tasks, matching the Done section's behavior.
- **FR-015**: The Open and Done sections MUST present a consistent collapse/expand affordance; any collapse-state persistence MUST match the Done section's existing behavior.

**Batch-wide**
- **FR-016**: This feature MUST NOT change the household data model, the backend, or any existing behavior beyond surfacing the actions described; it reuses existing capabilities.

### Key Entities

- **Task**: An assignable to-do (owner max / jaz / both), optionally dated, optionally snoozed with a visible snooze history, and optionally generated by a recurring rule. This feature surfaces snooze-start and delete actions for tasks.
- **Event**: A scheduled calendar item, optionally mirrored to the shared household Google Calendar. This feature surfaces a delete action that also cleans up the mirror.
- **Recurring rule**: The definition that generates task occurrences. Out of scope for editing here — deleting a generated occurrence never touches the rule, which stays managed under More → Recurring.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can snooze a task to a new date entirely from the calendar surface, without navigating to the Tasks tab.
- **SC-002**: A user can delete both an event and a task through the app with a confirmation step, without ever opening the underlying spreadsheet.
- **SC-003**: Deleting a recurring-generated occurrence leaves the recurring rule intact — a later generation still produces the next occurrence.
- **SC-004**: The Open and Done sections on the Tasks tab behave identically with respect to collapsing and expanding.
- **SC-005**: No existing flow (create, edit, complete, reopen, calendar sync, digests) regresses as a result of this batch.

## Assumptions

- **Backend is complete**: `events.delete` and `tasks.delete` already exist server-side (including Google Calendar mirror cleanup and activity-log writes); this feature only wires the existing actions into the UI.
- **Existing snooze mechanics are reused**: the snooze date picker and history behavior used on the Tasks tab are the ones surfaced on the calendar; no new snooze semantics are introduced.
- **Recurring deletion is instance-only by design** (clarified 2026-07-11): deleting a generated task removes just that occurrence; rule deletion stays under More → Recurring.
- **Done's collapse behavior is the reference**: the Open (and future Someday) sections match whatever affordance and persistence the Done section already implements.
- **Two users only**: no roles, permissions, or per-user delete restrictions — either person can snooze or delete any item, consistent with the rest of the app.
