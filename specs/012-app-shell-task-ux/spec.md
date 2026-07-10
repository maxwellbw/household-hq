# Feature Specification: App Shell & Task UX (app-shell-task-ux)

**Feature Branch**: `012-app-shell-task-ux`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "App shell & task UX (frontend-only; every backend piece already exists). Deliver working Tasks / Feed / More navigation on mobile AND desktop (feature 006 shipped these as disabled stubs). Let a user complete/reopen a task from anywhere it appears (today only TaskRow inside EventDetailSheet has a checkbox). Snooze/defer a task with visible history (backend `snoozed` status + `snoozeHistory` already exist). Add event end date to create/edit (the Sheet has the column but the UI never asks). Add management screens under More for Recurring rules and TaskTemplates (list/edit/delete — answers 'where do I set up templates?'). Two users (Max, Jaz) only; calendar remains the home view. Follows DESIGN.md and PRODUCT.md."

## Clarifications

### Session 2026-07-09

- Q: Snooze/defer has no backend write path (a `snoozed` status + `snoozeHistory` column exist, but no action sets them). How should "snooze with visible history" be delivered? → A: **Add a minimal backend action** — an idempotent `tasks.snooze` / `tasks.unsnooze` that sets status, moves the due date, and appends to `snoozeHistory` + ActivityLog. Full snooze semantics with a visible trail; 012 is therefore *mostly* frontend with one small backend addition.
- Q: How should the four sections (Calendar/Tasks/Feed/More) be navigated on desktop? → A: **Left sidebar rail** beside the ~1100px content column on desktop; the bottom tab bar stays on mobile.
- Q: What should the Tasks section show and how is it organized? → A: **All household tasks**, grouped Open (by due date, overdue first) then a collapsed Done section, respecting the existing owner filter chips (Max/Jaz/Both).
- Q: What CRUD depth should the More management screens have? → A: **Create + edit + delete** for both recurring rules and prep templates (the backend already supports create).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reach every section of the app on any device (Priority: P1)

Max opens Household HQ on his phone and Jaz opens it on her laptop. On the phone the **bottom tab bar** and on the laptop a **left sidebar rail** both let them move between **Calendar**, **Tasks**, **Feed**, and **More**. Today only Calendar is reachable — the other three are greyed-out stubs left over from the calendar build, and on desktop there is no navigation at all. After this story, tapping or clicking any of the four takes you to a real screen, the current section is clearly marked, and Calendar remains the screen you land on when you open the app.

**Why this priority**: Every other capability in this feature lives behind one of these destinations. Until the navigation actually moves between working sections on both form factors, none of the other work is reachable, so this is the foundation and ships first.

**Independent Test**: On a phone-width and a desktop-width screen, start on Calendar, then visit Tasks, Feed, and More in turn; confirm each shows its own content (not a dead stub), the active section is visually indicated, and reloading the app returns you to Calendar.

**Acceptance Scenarios**:

1. **Given** the app is open on a phone-width screen, **When** the user taps Tasks, Feed, or More, **Then** the corresponding section is shown and marked as the current section.
2. **Given** the app is open on a desktop-width screen, **When** the user activates any of the four destinations via the left sidebar rail, **Then** navigation is available and reaches the same sections as the mobile bottom bar (no destination is desktop-only or mobile-only).
3. **Given** the user is on any section, **When** they reopen or reload the app, **Then** they land on Calendar (the home view is unchanged).
4. **Given** the user is on a section other than Calendar, **When** they look at the navigation, **Then** exactly one destination is indicated as current.

---

### User Story 2 - Complete or reopen any task, not just ones inside an event (Priority: P1)

Jaz wants to check off "Buy flea meds," a standalone task with no event attached. Today the only checkbox in the whole app lives inside an event's detail sheet, so a task that isn't tied to an event can't be completed from the UI at all. After this story there is a **Tasks** section listing **all** the household's tasks — grouped Open (by due date, overdue first) then a collapsed Done section, and honoring the existing owner filter chips (Max/Jaz/Both) — each with the same check-off control used on event tasks, so either person can mark any task done, and reopen it if it was checked by mistake, from a single place. Completing a task shows immediate confirmation and the task reflects who completed it.

**Why this priority**: The backlog's core gap is that "the backend outran the UI" — completion is trapped inside event sheets. A standalone Tasks list that can complete/reopen closes that gap and is independently valuable even before snooze, end-dates, or management screens exist.

**Independent Test**: Create a standalone task (no event) via the existing add flow, open the Tasks section, mark it done and confirm it shows as completed and records the completer; reopen it and confirm it returns to open — all without opening any event.

**Acceptance Scenarios**:

1. **Given** a standalone task with no event, **When** the user opens the Tasks section, **Then** the task appears in the Open group with a check-off control.
1a. **Given** open and done tasks exist, **When** the user opens the Tasks section, **Then** open tasks are grouped by due date (overdue first) above a collapsed Done section, and the owner filter chips scope which tasks are shown.
2. **Given** an open task in the Tasks list, **When** the user checks it off, **Then** it is marked done, the completer is recorded, and the user sees immediate confirmation.
3. **Given** a completed task, **When** the user reopens it, **Then** it returns to open and no longer shows as done.
4. **Given** a task is completed or reopened from the Tasks list, **When** the user views that same task inside its event (if any) or in the Feed, **Then** its state is consistent everywhere it appears.

---

### User Story 3 - Snooze a task and see its snooze history (Priority: P2)

A task is due today but Max can't get to it, so instead of leaving it nagging as overdue he **snoozes/defers** it to a later day. The task steps out of today's view until the new date, and its record keeps a visible trail of each time it was snoozed (from → to, and when), so the household can see a chore that keeps getting pushed. Either person can bring it back (un-snooze) at any time.

**Why this priority**: Snooze is a real relief valve for the two-person load, and the data model already carries a `snoozed` status and a snooze-history field. It builds on the Tasks list from US2, so it ships after the list exists. A minimal backend snooze/un-snooze write path is added as part of this story (see Clarifications 2026-07-09); everything else in the feature remains frontend-only.

**Independent Test**: From the Tasks list, snooze an open task to a future date, confirm it leaves the active/today view until that date, view its snooze history and see the deferral recorded, then un-snooze it and confirm it returns to the active list.

**Acceptance Scenarios**:

1. **Given** an open, dated task, **When** the user snoozes it to a later date, **Then** the task moves out of the current/active view until that date and its status reflects that it is snoozed.
2. **Given** a task that has been snoozed one or more times, **When** the user views the task's detail, **Then** a readable history of each deferral (previous date → new date, and when) is shown.
3. **Given** a snoozed task, **When** the user un-snoozes it, **Then** it returns to the active task list as open.
4. **Given** a task is snoozed, **When** the household activity is reviewed, **Then** the deferral is recorded consistently with other task actions.

---

### User Story 4 - Give an event a distinct end date and time (Priority: P2)

Max is adding "Friends visiting" that runs Friday through Sunday. Today the create/edit form never asks for an end, so multi-hour or multi-day events can't be entered accurately even though the calendar and the underlying record already support an end. After this story, creating or editing an event lets the user set an **end date/time** alongside the start, the app prevents an end that is before the start, and the event then displays across its true span.

**Why this priority**: A visible correctness gap — the storage and calendar already handle ends, only the form is missing the field. It is self-contained and does not depend on the Tasks work, but it is a smaller slice than the navigation/task-completion foundation, so it is P2.

**Independent Test**: Create an event with an end later than its start and confirm it saves and displays across the full span; attempt to save an end earlier than the start and confirm the app prevents it with a clear message; edit an existing event's end and confirm the change is reflected.

**Acceptance Scenarios**:

1. **Given** the event create form, **When** the user sets a start and a later end, **Then** the event saves and displays across the full start→end span.
2. **Given** the event create or edit form, **When** the user sets an end earlier than the start, **Then** the app prevents saving and explains why.
3. **Given** an existing event, **When** the user edits its end, **Then** the updated span is saved and shown.
4. **Given** an event created without an explicit end, **When** it is saved, **Then** it uses a sensible default span and remains editable later (no regression to existing single-instant events).

---

### User Story 5 - Review recent household activity in the Feed (Priority: P3)

Jaz wants a quick "what's been happening" glance without opening each event: who completed what, what was added, what got snoozed. The **Feed** section shows a reverse-chronological, human-readable stream of household activity, attributed to Max or Jaz (never the shared account).

**Why this priority**: Awareness-of-others is a stated product value, and the activity history already exists on the backend. It is a read-only view that depends on the navigation shell (US1) but nothing else, so it ships after the shell and the task list.

**Independent Test**: Perform a few actions (complete a task, add an event), open the Feed, and confirm each action appears in reverse-chronological order with a plain-language description and the correct person attributed.

**Acceptance Scenarios**:

1. **Given** recent household actions have occurred, **When** the user opens the Feed, **Then** they see those actions in reverse-chronological order.
2. **Given** a feed entry, **When** the user reads it, **Then** it states who did what in plain language and is attributed to Max or Jaz, not the shared account.
3. **Given** no activity yet, **When** the user opens the Feed, **Then** a friendly empty state is shown rather than a blank screen.

---

### User Story 6 - Manage recurring rules and prep templates from More (Priority: P3)

Jaz asks "where do I set up the friends-visiting prep checklist, or change the trash pickup rule?" Today those live only in the spreadsheet. Under **More**, this story adds management screens to **create, edit, and delete** the household's recurring chore rules and its event prep-checklist templates, so both people can set up and maintain them in the app.

**Why this priority**: It answers a concrete "where do I do this?" gap and completes the app shell, but it is the least-used, most-advanced destination and depends on navigation (US1), so it is last.

**Independent Test**: From More, open the recurring-rules screen and the templates screen; create/edit/delete an entry in each and confirm the change persists and is reflected where that rule or template is used.

**Acceptance Scenarios**:

1. **Given** the More section, **When** the user opens recurring-rule management, **Then** existing rules are listed and the user can create a new rule and edit or delete each one.
2. **Given** the More section, **When** the user opens prep-template management, **Then** existing templates are listed and the user can create a new template and edit or delete each one.
3. **Given** the user edits or deletes a rule or template, **When** the change is saved, **Then** it persists and is reflected wherever that rule/template is used (e.g., future recurring tasks, event prep generation).
4. **Given** a destructive delete, **When** the user initiates it, **Then** they are asked to confirm before it is removed.

---

### Edge Cases

- **Deep-linking / refresh on a non-home section**: reloading always returns to Calendar (the home view); there is no requirement to restore the last-viewed section.
- **Task shown in two places**: a task visible both in its event sheet and in the Tasks list must stay in sync — completing it in one place reflects in the other.
- **Snooze with no due date**: how an undated task is snoozed/deferred (does it require picking a date first?) — see Assumptions.
- **Repeated snoozes**: a chore snoozed many times must still show the full trail, not just the latest deferral.
- **End equals start**: an event whose end equals its start is treated as a zero-length / single-instant event (allowed); only end *before* start is rejected.
- **All-day vs timed end**: setting an end date without a time on an all-day-style event should behave sensibly (span of days) rather than forcing a time-of-day.
- **Deleting a template/rule still in use**: deleting a prep template or recurring rule does not retroactively remove tasks/events it already generated; only future generation is affected.
- **Empty sections**: Tasks, Feed, and each management screen show a friendly empty state, never a blank or broken screen.
- **Shared-account actor**: any action taken while signed in on the shared account is attributed to the resolved person (Max or Jaz) everywhere it is displayed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide working navigation between Calendar, Tasks, Feed, and More on both phone-width (bottom tab bar) and desktop-width (left sidebar rail) screens (no destination may be permanently disabled or available on only one form factor).
- **FR-002**: The app MUST clearly indicate the currently active section.
- **FR-003**: The app MUST retain Calendar as the landing/home view on open and on reload.
- **FR-004**: Users MUST be able to complete an open task from a dedicated Tasks section, not only from within an event.
- **FR-005**: Users MUST be able to reopen a completed task from the Tasks section.
- **FR-006**: The Tasks section MUST include standalone tasks that have no associated event.
- **FR-006a**: The Tasks section MUST show all household tasks grouped as Open (ordered by due date, overdue first) above a collapsed Done section, and MUST honor the existing owner filter chips (Max/Jaz/Both).
- **FR-007**: Completing or reopening a task MUST record the acting person and give immediate visible confirmation, consistent with existing task-completion behavior.
- **FR-008**: A task's completed/open/snoozed state MUST be consistent everywhere it is displayed (Tasks list, event detail, Feed).
- **FR-009**: Users MUST be able to snooze/defer a task to a later date so it leaves the current/active view until that date; the task's status becomes `snoozed` via a dedicated, idempotent snooze action.
- **FR-010**: Users MUST be able to un-snooze a task, returning it to the active list as open.
- **FR-011**: Each snooze MUST append to the task's `snoozeHistory` (previous date → new date, and when) and record the deferral in ActivityLog, and the app MUST show that history in readable form.
- **FR-012**: Users MUST be able to set an event's end date/time when creating and when editing an event.
- **FR-013**: The app MUST prevent saving an event whose end is before its start, with a clear explanation.
- **FR-014**: Events MUST display across their full start→end span once an end is set.
- **FR-015**: The Feed section MUST present household activity in reverse-chronological, human-readable form, attributed to Max or Jaz (never the shared account).
- **FR-016**: The More section MUST let users list, create, edit, and delete recurring chore rules.
- **FR-017**: The More section MUST let users list, create, edit, and delete event prep-checklist templates.
- **FR-018**: Destructive deletions (rules, templates) MUST require explicit confirmation.
- **FR-019**: Editing or deleting a rule/template MUST persist and affect only future generation, not already-generated tasks/events.
- **FR-020**: Every screen that can be empty (Tasks, Feed, management screens) MUST present a friendly empty state.
- **FR-021**: All new UI MUST follow DESIGN.md and PRODUCT.md (warm calm palette, owner color coding as identity, calendar-first, WCAG 2.1 AA).
- **FR-022**: The feature MUST NOT introduce any concept of more than two people, roles, tenancy, or scale.

### Key Entities *(include if feature involves data)*

- **Task**: a to-do owned by Max, Jaz, or both; has a status (open / done / snoozed), an optional due date, an optional linked event, a completer + completion time when done, and a snooze history (the trail of deferrals). This feature surfaces and manipulates existing tasks; it does not change their shape beyond what already exists.
- **Event**: a calendar item with a start and an **end**, an owner, and optional prep-template linkage. This feature exposes the already-stored end to the create/edit UI.
- **Recurring rule**: the definition of a repeating chore (cadence, owner, window). This feature provides list/edit/delete UI over existing rules.
- **Prep template**: a named checklist of steps attached to an event type. This feature provides list/edit/delete UI over existing templates.
- **Activity entry**: a timestamped record of a household action (actor, action, target) shown in the Feed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four sections (Calendar, Tasks, Feed, More) are reachable and show real content on both a phone-width and a desktop-width screen — zero permanently-disabled navigation stubs remain.
- **SC-002**: A standalone task (no event) can be completed and reopened entirely from the Tasks section without opening any event.
- **SC-003**: A task can be snoozed to a later date and later un-snoozed, and its deferral history is visible; every snooze of the same task is retained in the trail.
- **SC-004**: An event with a distinct end (including a multi-day span) can be created and edited, displays across its full span, and an end-before-start entry is rejected 100% of the time.
- **SC-005**: Recurring rules and prep templates can each be listed, edited, and deleted from the app, with delete requiring confirmation.
- **SC-006**: The Feed shows recent actions in reverse-chronological order, each attributed to Max or Jaz, with a friendly empty state when there is nothing yet.
- **SC-007**: New UI passes the project's design/accessibility bar (`/impeccable audit`, WCAG 2.1 AA) before merge.

## Assumptions

- **Feature order & number**: This is feature **012** per BACKLOG.md's Phase 2.5 UX-completion sequence (012–015), branch `012-app-shell-task-ux`, even though it is the 10th spec folder.
- **"Frontend-only" caveat — snooze write path (resolved)**: The backend already models a `snoozed` **status** and a `snoozeHistory` **column**, but has **no API action to snooze a task** (`tasks.update` rejects status changes; the lifecycle helper only handles done/open). Per the 2026-07-09 clarification, this feature adds a **minimal, idempotent `tasks.snooze` / `tasks.unsnooze` backend action** (sets status, moves due date, appends `snoozeHistory` + ActivityLog). This is the one backend addition; everything else is frontend-only.
- **Feed = ActivityLog**: The Feed shows the existing ActivityLog stream (there is an `activity.list` capability); no new activity data is introduced.
- **Navigation model**: Section switching is in-app (client-side view state), landing on Calendar; persisting the last-viewed section across reloads is out of scope.
- **Management screens read existing CRUD**: Recurring-rule and template management use the already-existing list/create/update/delete capabilities (features 004/005); this feature adds only the screens, not new backend endpoints.
- **End-date default**: An event saved without an explicit end keeps today's default-span behavior so existing single-instant events do not regress.
- **Two users forever**: No roles, tenancy, or multi-household concepts; the shared account is always resolved to Max or Jaz for display and attribution.
- **Design source of truth**: DESIGN.md and PRODUCT.md govern all visual/UX decisions; the constitution wins on any conflict.

## Dependencies

- Existing backend capabilities for tasks (list/create/complete/reopen), events (create/update with end), recurring rules (CRUD), templates (CRUD), and activity (list) — all present from features 001–009.
- **One new backend action** added by this feature: idempotent `tasks.snooze` / `tasks.unsnooze` (see Clarifications 2026-07-09). No other backend changes.
