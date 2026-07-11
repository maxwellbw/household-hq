# Feature Specification: UX Fix Batch — Task Editing & Dead Controls

**Feature Branch**: `016-ux-fix-batch`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "UX fix batch (frontend-only): four confirmed bugs from Jaz's feedback round 2. (1) Quick Add force-dates blank-date tasks to today, defeating the Someday list. (2) TaskRow's 'Edit due' menu item is dead. (3) Tasks cannot be edited or reassigned anywhere. (4) Calendar items don't open on tap."

## Overview

Four confirmed defects surfaced after living with features 012–015. Each has a root cause already located in the frontend; every backend capability these need already exists (`tasks.update` accepts title, owner, and dueDate, and can clear the date). This feature is UI wiring and fixes only — no new backend surface, no schema change.

## Clarifications

### Session 2026-07-10

- Q: How should editing work inside the task detail sheet (title / owner / due date)? → A: The sheet opens read-only (as today); an explicit **Edit** button reveals editable fields with a clear Save/Cancel commit. No inline always-editable fields.
- Q: When a user picks "Edit due" from a task row's overflow menu, what should open? → A: The **same task detail sheet** used elsewhere, entered in its editing state focused on the due date — not a separate lightweight date picker. One editor, one code path.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A task added without a date lands in Someday (Priority: P1)

When a household member quick-adds a one-time task and leaves the due date blank, they mean "someday, no date yet." Today the app silently stamps it with today's date, so it never reaches the Someday list — which is why that list looks empty despite feature 013 shipping.

**Why this priority**: This is a data-integrity bug that defeats an entire shipped feature (013 Someday list). Every blank-date task since 013 has been mis-dated to "today," so the Someday surface has been effectively dead. Fixing it restores a feature users already believe they have.

**Independent Test**: Quick-add a task with the date field left empty; confirm the task is created with no due date and appears in the Someday section, not on today.

**Acceptance Scenarios**:

1. **Given** the Quick Add task form with the due-date field left blank, **When** the user submits, **Then** the task is created with no due date and appears in the Someday list.
2. **Given** the Quick Add task form with a due date filled in, **When** the user submits, **Then** the task is created with that exact date (unchanged behavior).
3. **Given** a task created with no due date, **When** the user views the calendar, **Then** the task does not appear on today (or any date) in the calendar.

---

### User Story 2 - Edit and reassign a task from its detail view (Priority: P1)

A household member opens a task's details and needs to fix its title, hand it to the other person (or to "both"), or change/clear its due date. Today the detail sheet shows only snooze history — there is nowhere in the app to edit a task, even though the backend has always accepted these changes.

**Why this priority**: "Tasks can't be edited or reassigned anywhere" is the single largest gap in the current task experience — a typo or a wrong owner is unfixable without editing the Sheet by hand. It unblocks everyday coordination (reassigning chores) that the product exists to serve.

**Independent Test**: Open a task's detail sheet, tap Edit, change its title, owner, and due date, save, and confirm all three changes persist and are reflected across the app (task list, calendar) without a manual refresh.

**Acceptance Scenarios**:

0. **Given** a task detail sheet just opened, **When** the user has not tapped Edit, **Then** the sheet is read-only and no field can be changed accidentally.
1. **Given** a task detail sheet in edit mode, **When** the user edits the title and saves, **Then** the new title persists and shows everywhere the task appears.
2. **Given** a task detail sheet, **When** the user changes the owner to the other person or to "both" and saves, **Then** the task's owner color/identity updates everywhere.
3. **Given** a dated task's detail sheet, **When** the user changes the due date and saves, **Then** the task moves to the new date on the calendar.
4. **Given** a dated task's detail sheet, **When** the user clears the due date and saves, **Then** the task becomes undated and moves to the Someday list.
5. **Given** an undated (Someday) task's detail sheet, **When** the user sets a due date and owner and saves, **Then** the task moves from Someday onto the calendar.
6. **Given** an edit in progress, **When** the user cancels or closes without saving, **Then** no change is made.
7. **Given** the existing snooze/un-snooze behavior, **When** the detail sheet gains editing, **Then** snooze history and the Un-snooze action remain available for snoozed tasks.

---

### User Story 3 - The "Edit due" quick action works (Priority: P2)

From a task row's overflow menu, "Edit due" should let the user change that task's due date directly. Today the menu item renders but does nothing — its handler is never wired.

**Why this priority**: A visibly present control that does nothing erodes trust in the whole interface. It is a small fix, and it gives a one-tap path to the most common single edit (rescheduling) without opening the full editor. Lower than US2 only because US2 delivers the same capability through the detail sheet.

**Independent Test**: Open a task row's overflow menu, choose "Edit due," and confirm the task detail sheet opens in its editing state focused on the due date; change the date, save, and confirm the task's due date changes.

**Acceptance Scenarios**:

1. **Given** a task row overflow menu, **When** the user selects "Edit due," **Then** the task detail sheet opens in edit mode focused on the due date (rather than nothing happening).
2. **Given** the detail sheet opened via "Edit due," **When** the user picks a new date and saves, **Then** the task's due date updates and the change is reflected in the list and calendar.
3. **Given** the detail sheet opened via "Edit due," **When** the user cancels or closes without saving, **Then** the due date is unchanged.

---

### User Story 4 - Calendar items open their details on tap (Priority: P2)

Tapping an item on the calendar should open its details. Today, event chips are wired to open the event detail sheet but do not reliably open on tap (reported on both mobile and desktop), and task chips are explicitly ignored — tapping a task on the calendar does nothing.

**Why this priority**: The calendar is the product's organizing metaphor; items that can't be opened make it feel decorative. Grouped below US2 because the task-editing gap is felt more often day to day, but this restores the calendar's core affordance.

**Independent Test**: On both mobile and desktop, tap an event on the calendar and confirm its detail sheet opens; tap a task on the calendar and confirm its detail sheet opens.

**Acceptance Scenarios**:

1. **Given** the calendar on desktop, **When** the user taps an event, **Then** the event's detail sheet opens.
2. **Given** the calendar on mobile, **When** the user taps an event, **Then** the event's detail sheet opens.
3. **Given** the calendar (mobile or desktop), **When** the user taps a task, **Then** the task's detail sheet opens (the same detail experience as from the task list).
4. **Given** a task detail sheet opened from the calendar, **When** the user edits the task (per US2), **Then** the change is reflected on the calendar on save.

---

### Edge Cases

- **Blank vs. whitespace title on edit**: Saving an empty or whitespace-only title must be prevented (a task must keep a title).
- **Clearing the date on a snoozed task**: Editing due date interacts with snooze state — the detail sheet must not present contradictory state (e.g., "snoozed until X" while the date is being cleared). Editing resolves to the plain task state the backend records.
- **Owner "both"**: Reassigning to "both" is valid and must be selectable, matching creation.
- **No-op save**: Saving with no fields changed should not error and should not create a misleading activity-log entry beyond what the backend already does.
- **Concurrent staleness**: If the task changed underneath the user (e.g., completed elsewhere), the app should reflect the latest state after save rather than silently clobbering — relying on the app's existing refetch-on-success behavior.
- **Calendar tap target**: The whole visible chip (event or task) should be tappable, including on mobile where hit areas are small.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A one-time task quick-added with no due date MUST be created with no due date (it MUST NOT be defaulted to today or any other date).
- **FR-002**: A one-time task quick-added with a due date MUST be created with exactly that date (unchanged).
- **FR-003**: Undated tasks created via Quick Add MUST appear in the Someday list and MUST NOT appear on the calendar.
- **FR-004**: The task detail view MUST open read-only by default, with an explicit **Edit** button that reveals editable fields; no field is editable until Edit is engaged.
- **FR-005**: In edit mode, users MUST be able to edit a task's title.
- **FR-006**: In edit mode, users MUST be able to reassign a task's owner (max / jaz / both).
- **FR-007**: In edit mode, users MUST be able to change a task's due date, including clearing it (making the task undated / Someday).
- **FR-008**: A single **Save** action MUST persist all changed fields together and reflect them everywhere the task appears (task list, calendar, dashboard) without requiring a manual page refresh; a **Cancel** action MUST discard all pending edits and return the sheet to read-only.
- **FR-009**: The edit flow MUST prevent saving an empty or whitespace-only title.
- **FR-010**: The task detail view MUST retain the existing snooze history display and Un-snooze action for snoozed tasks.
- **FR-011**: The "Edit due" overflow-menu action on a task row MUST open the task detail sheet in its editing state focused on the due date (it MUST NOT be a no-op and MUST NOT be a separate one-off date picker).
- **FR-012**: Saving after "Edit due" MUST update the task's due date and reflect it in the list and calendar; cancelling MUST leave it unchanged.
- **FR-013**: Tapping an event on the calendar MUST open that event's detail sheet, on both mobile and desktop.
- **FR-014**: Tapping a task on the calendar MUST open that task's detail sheet (the same detail/edit experience available from the task list).
- **FR-015**: Every task change made through these flows MUST record activity via the existing backend path (no new logging concept; the backend already appends to ActivityLog on `tasks.update`).
- **FR-016**: These changes MUST NOT introduce any new backend action, Sheet column, or auth concept — they use existing `tasks.update` and existing detail/event surfaces.

### Key Entities

- **Task**: An assignable to-do owned by max / jaz / both, with a title, an optional due date (absent = Someday), and lifecycle state (open / snoozed / done). This feature adds no fields — it exposes editing of title, owner, and dueDate that the data model already supports.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of one-time tasks added with a blank date are created undated and appear in the Someday list (0% mis-dated to today).
- **SC-002**: A user can change a task's title, owner, and due date and see all three reflected across the app within one interaction, with no manual refresh.
- **SC-003**: Every control visible on a task row and on a calendar item performs its stated action — zero dead controls remain among "Edit due," calendar event tap, and calendar task tap.
- **SC-004**: Tapping an event or a task on the calendar opens its details on the first tap, on both mobile and desktop.
- **SC-005**: No regression to existing task behaviors (complete/reopen, snooze/un-snooze, someday scheduling) — the existing frontend test suite remains green and the build passes with no type errors.

## Assumptions

- **Reuse the existing task detail sheet**: The task detail experience opened from the calendar is the same one used from the task list, so editing works identically in both places.
- **Editing scope is title, owner, and due date only.** Deleting a task and changing lifecycle status (complete/reopen) are out of scope for this feature — completion keeps its dedicated path, and deletion is not requested here.
- **Reassigning to "both" is allowed**, matching task creation, since owner is a first-class identity value.
- **The calendar event-open bug is a wiring/rendering issue, not a data issue** — the investigation happens during planning; the requirement (FR-013) is that taps open the sheet, however that is achieved.
- **The "Edit due" quick action and the detail-sheet date editor may share the same underlying date-change mechanism** — they are two entry points to one capability.
- **No change to the shared-account actor resolution or allowlist** — edits are attributed via the existing acting-person plumbing.
