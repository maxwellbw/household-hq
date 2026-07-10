# Feature Specification: Someday List (someday-list)

**Feature Branch**: `013-someday-list`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Someday list — undated tasks (no due date, already supported by the Tasks API but currently invisible in the UI) shown as a list below the calendar. Users can schedule a someday task by tapping it (opens a mini-dialog) or, on desktop, dragging it onto a calendar date. Scheduling ALWAYS opens a mini-dialog asking for date + owner explicitly — no implicit ownership from who dragged, no implicit date. Desktop drag-and-drop may pre-fill the date field but the dialog still asks for confirmation and owner. Seed examples of someday tasks: air-duct cleaning, carpet cleaning. This is a frontend feature — the backend already supports undated tasks and task updates."

## Clarifications

### Session 2026-07-10

- Q: When the scheduling dialog opens, what should the owner field default to? → A: **No pre-selection** — owner starts unset; the user must actively pick Max / Jaz / Both, and confirm stays disabled until they do. Strictly honors "never implicit ownership."
- Q: Should the date field start empty or pre-filled with today? → A: **Empty** — no date pre-filled on tap-to-schedule; confirm stays disabled until a date is chosen. (Desktop drag-onto-a-day still pre-fills that drop date.)
- Q: Should undated tasks attached to an event appear in the Someday list? → A: **Exclude event-attached** — Someday shows only standalone undated tasks; event-attached ones already surface inside their event.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See and manage undated "someday" tasks (Priority: P1)

Jaz has a running mental list of things the household will get to eventually — air-duct cleaning, carpet cleaning — that don't belong on any particular day yet. Today a task created without a due date is written to the database but never appears anywhere in the app: it's invisible, so there's no way to see it, act on it, or even remember it exists. After this story, undated tasks appear in a clearly labelled **Someday** list below the calendar on the home view, each showing its title and owner, so the household can see at a glance what's parked-but-not-forgotten. A someday task can be completed or reopened right from the list, and the list respects the same owner filter (Max / Jaz / Both) used elsewhere.

**Why this priority**: The whole point of this feature is to surface a category of data the backend already stores but the UI hides. Just making someday tasks visible and completable is independently valuable — you can finally see your parking lot — even before any scheduling flow exists.

**Independent Test**: Create a task with no due date via the existing add flow, open the home view, and confirm it appears in the Someday list with its owner; complete it and confirm it reflects as done; reopen it and confirm it returns to the list.

**Acceptance Scenarios**:

1. **Given** a task exists with no due date and status open, **When** the user opens the home view, **Then** the task appears in the Someday list showing its title and owner.
2. **Given** a task has a due date, **When** the user views the Someday list, **Then** that task does **not** appear there (dated tasks live on the calendar, not in Someday).
3. **Given** someday tasks exist for different owners, **When** the user changes the owner filter (Max / Jaz / Both), **Then** the Someday list shows only tasks matching the filter, consistent with how the filter scopes the rest of the home view.
4. **Given** a someday task in the list, **When** the user completes it, **Then** it is marked done and reflects the completer; **When** the user reopens it, **Then** it returns to the Someday list as open.
5. **Given** there are no undated tasks for the current filter, **When** the user views the home view, **Then** the Someday list shows a calm empty state rather than disappearing without explanation.

---

### User Story 2 - Schedule a someday task by tapping it (Priority: P1)

Max decides it's finally time to book the air-duct cleaning. He taps the "Air-duct cleaning" entry in the Someday list. A small dialog opens asking two things explicitly: **which date** to schedule it for and **who owns it** (Max / Jaz / Both). Neither is guessed for him — the date starts empty (or on a neutral default he can change) and the owner is asked outright rather than inherited silently. He picks a date and an owner, confirms, and the task leaves the Someday list and now appears on the calendar on the chosen day, owned by the chosen person.

**Why this priority**: Surfacing someday tasks (Story 1) is only half the value; the reason to keep a parking lot is so you can pull items out of it onto real days. Tap-to-schedule is the primary, universal path (works on phone and desktop alike), so it ships alongside Story 1 as core.

**Independent Test**: From the Someday list, tap a task, and in the dialog choose a date and an owner and confirm; verify the task disappears from Someday, appears on the calendar on that date, and shows the chosen owner. Cancel the dialog on another task and verify nothing changed.

**Acceptance Scenarios**:

1. **Given** a someday task, **When** the user taps it to schedule, **Then** a dialog opens asking for a date and an owner, with the owner **not** pre-decided by any implicit rule.
2. **Given** the scheduling dialog is open, **When** the user has not chosen a date, **Then** the confirm action is unavailable until a date is provided (a task cannot be "scheduled" to no date).
3. **Given** the user selects a date and owner and confirms, **When** the change is saved, **Then** the task gains that due date and owner, leaves the Someday list, and appears on the calendar on that date.
4. **Given** the scheduling dialog is open, **When** the user cancels or dismisses it, **Then** no change is made and the task remains in the Someday list unchanged.
5. **Given** the save fails (e.g., network error), **When** the user confirms, **Then** the user is told it didn't save and the task remains in the Someday list.

---

### User Story 3 - Drag a someday task onto a calendar day (desktop) (Priority: P3) — ⛔ DEFERRED

> **Deferred 2026-07-10.** Investigated and explicitly deferred per constitution IV (boring/debuggable).
>
> **Why:** Schedule-X month-grid cells (`sx__month-grid-day`) expose no `data-date` attribute. The only day information available is the text content of `sx__month-grid-day__header-date`, which is just the day number (1–31). Reconstructing the full ISO date from that number requires knowing which month the cell belongs to — but the `is-leading-or-trailing` class used to detect adjacent-month days is driven by `selectedDate.month`, not the currently *viewed* month. Navigating to any month other than today's makes this class unreliable, so the day → ISO-date reconstruction silently produces wrong dates for navigated months. All class names are internal dist strings with no public stability guarantee.
>
> **Commitment:** US1 + US2 (tap-to-schedule on every device) are the shipped deliverable. US3 can be revisited if Schedule-X exposes a stable `data-date` on month-grid cells in a future release, or if the desktop view switches to the week grid (which does expose `data-date`), or via a wrapper `onEventDrop` plugin. No code was written for T013–T015; no reopening of the spec is needed.



On her laptop, Jaz drags "Carpet cleaning" from the Someday list onto a Saturday in the calendar. Because she dropped it on a specific day, the scheduling dialog opens with **that date pre-filled** — but it still opens, and it still asks her to confirm the date and choose an owner before anything is saved. Dropping is a shortcut for entering the date, never a silent commit and never an inference of who owns it.

**Why this priority**: Drag-and-drop is a desktop-only convenience layered on top of tap-to-schedule. It's the most implementation-heavy path and delivers the least incremental value (it only saves a couple of taps over Story 2), so it's lowest priority and can ship last or be deferred without blocking the feature.

**Independent Test**: On a desktop-width screen, drag a someday task onto a specific calendar day; confirm the same scheduling dialog opens with that day pre-filled as the date, the owner still unset/asked, and that no change is saved until the user confirms in the dialog.

**Acceptance Scenarios**:

1. **Given** a desktop-width screen and a someday task, **When** the user drags it onto a specific calendar day and drops it, **Then** the scheduling dialog opens with that day pre-filled as the proposed date.
2. **Given** the dialog opened from a drag, **When** the user looks at the owner field, **Then** it is still unset/asked — the identity of who dragged does not set the owner.
3. **Given** the dialog opened from a drag, **When** the user cancels, **Then** no due date is applied and the task stays in the Someday list.
4. **Given** the dialog opened from a drag, **When** the user changes the pre-filled date to a different day and confirms, **Then** the task is scheduled to the edited date, not the drop target.

---

### Edge Cases

- **Snoozed tasks**: A snoozed task has a (future) due date, so it is a dated task and does **not** appear in the Someday list. Someday is strictly "no due date."
- **Tasks tied to an event**: An undated task that belongs to an event is out of normal flow; the Someday list shows household someday tasks and should not double-show event-attached tasks that already appear inside their event. (See Assumptions.)
- **Completing vs. scheduling**: Completing a someday task removes it from the open Someday list without ever assigning a date — "done" and "scheduled" are different exits.
- **Empty date on confirm**: The dialog must not allow confirming with no date; there is no such thing as scheduling to nothing.
- **Long lists**: If many someday tasks accumulate, the list stays readable (scannable, doesn't overwhelm the calendar it sits below).
- **Concurrent change**: If the other user schedules or completes the same someday task first, the list reflects the current state after refresh and the second action doesn't resurrect a stale entry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home view MUST display a distinct **Someday** list, positioned below the calendar, containing the household's open, **standalone** tasks that have no due date (event-attached undated tasks are excluded — they surface inside their event).
- **FR-002**: Each someday task entry MUST show at least its title and its owner, using the same owner colour/identity treatment used elsewhere in the app.
- **FR-003**: The Someday list MUST respect the active owner filter (Max / Jaz / Both), showing only matching tasks, consistent with the rest of the home view.
- **FR-004**: A task that has a due date MUST NOT appear in the Someday list; only undated open tasks appear there.
- **FR-005**: Users MUST be able to complete and reopen a someday task directly from the list, using the same completion control and semantics used for tasks elsewhere.
- **FR-006**: Tapping a someday task MUST open a scheduling dialog that asks for **both** a date and an owner before any change is saved.
- **FR-007**: The scheduling dialog MUST NOT infer the owner implicitly (not from the current signed-in user, not from who dragged, not from the task's existing owner); the owner starts with **no pre-selection** and the user must actively choose Max / Jaz / Both.
- **FR-008**: The scheduling dialog MUST prevent confirmation until **both** a date and an owner are selected. On tap-to-schedule the date starts **empty**; on desktop drag-onto-a-day it starts pre-filled with the drop date (still editable, still requiring owner + confirmation).
- **FR-009**: On confirmation, the system MUST set the task's due date and owner to the chosen values, after which the task leaves the Someday list and appears on the calendar on the chosen date.
- **FR-010**: Cancelling or dismissing the scheduling dialog MUST make no change; the task remains an unmodified someday task.
- **FR-011**: On desktop, users MUST be able to drag a someday task onto a calendar day; doing so MUST open the same scheduling dialog with that day pre-filled as the proposed date, still requiring explicit owner selection and confirmation before saving.
- **FR-012**: Drag-and-drop MUST NOT be required on mobile/touch; tap-to-schedule MUST work as the universal path on all form factors.
- **FR-013**: When there are no someday tasks for the current filter, the list MUST show a clear empty state rather than vanishing.
- **FR-014**: A failed schedule save MUST leave the task in the Someday list and inform the user it did not save.
- **FR-015**: Every scheduling of a someday task MUST be recorded to the household activity log consistent with other task changes (actor, action, target).

### Key Entities *(include if feature involves data)*

- **Someday task**: Not a new entity — it is an existing household **Task** whose due date is empty and whose status is open. "Someday" is a view over tasks, defined by the absence of a due date, not a new field or status. Scheduling a someday task is a plain update that fills in its due date (and possibly changes its owner); completing it is the existing completion action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of open tasks with no due date are visible in the Someday list for the appropriate owner filter (no undated task is invisible in the app anymore).
- **SC-002**: A user can schedule a someday task — from tapping it to it appearing on the calendar — in under 15 seconds and no more than 3 interactions (open dialog, pick date, pick owner + confirm).
- **SC-003**: In 100% of scheduling actions, the user is explicitly asked for the owner (owner is never silently assigned).
- **SC-004**: A someday task can never be scheduled without a date **and** an owner — 0% of confirmations succeed with either field unset.
- **SC-005**: After scheduling, the task appears on the calendar on the chosen date and is gone from the Someday list on the next view of the home screen, with no manual refresh required beyond normal app behaviour.
- **SC-006**: The Someday list and scheduling dialog meet the project accessibility target (WCAG 2.1 AA) — keyboard-operable dialog, labelled fields, sufficient contrast.

## Assumptions

- **Backend is sufficient as-is.** Undated tasks (`dueDate` empty) and updating a task's due date + owner (`tasks.update`) already exist and are exercised by other features; this feature is frontend-only and adds no new backend action.
- **Someday = open + no due date.** The list is scoped to open, undated tasks. Done tasks leave the open list on completion; snoozed tasks carry a due date and are therefore not "someday."
- **Home view is the calendar screen.** "Below the calendar" means the existing calendar-first home view; this feature does not move or rerank the home view (the home-dashboard reversal is feature 014's concern, not this one).
- **Owner default in the dialog.** Resolved by clarification: the owner field has **no pre-selection**; the user must actively choose Max / Jaz / Both, and confirm is disabled until they do.
- **Event-attached undated tasks.** Resolved by clarification: **excluded** from the Someday list — only standalone undated tasks appear there; event-attached ones already surface inside their event.
- **Drag-and-drop is progressive enhancement.** It targets desktop/pointer input only; touch users rely on tap-to-schedule. Drag can ship after the tap path or be deferred without invalidating the feature.
- **Two users only.** Owner choices are Max / Jaz / Both — no other assignees exist.
- **Seed examples.** "Air-duct cleaning" and "carpet cleaning" are illustrative of the someday category; seeding actual starter someday tasks is not required by this feature (starter chore packs are feature 015).
