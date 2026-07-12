# Feature Specification: Task & Event Details + Collaboration

**Feature Branch**: `019-details-collaboration`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Task & event details + collaboration. (a) Notes on tasks with tappable links; (b) Acknowledge/commit on assigned tasks with dashboard notification + ntfy ping; (c) Event notes create/edit UI; (d) Event location with calendar-sync mapping."

## Clarifications

### Session 2026-07-11

- Q: Where should the "not yet committed" state and the "I've got it" action surface for a task assigned to the other person? → A: On task cards in the Tasks tab and Home dashboard **and** in the detail sheet (the "I've got it" button appears inline on the assignee's card and in the detail sheet); calendar chips stay clean — the state is visible when the chip is tapped into the detail sheet.
- Q: Which text should be turned into tappable links inside notes? → A: Only strings with an explicit `http://` or `https://` scheme; all other text (including bare `www.`/domain strings) renders as plain text.
- Q: How long should the assigner's dashboard acknowledgement notice ("Max has it") live? → A: Persists across reloads until the assigner dismisses it; dismissal is remembered so it never reappears (does not auto-clear on task completion).

## User Scenarios & Testing *(mandatory)*

This feature closes four gaps in how Max and Jaz capture context on, and coordinate around, the shared household's tasks and events. All four are independently valuable; each can ship on its own.

### User Story 1 - Notes on tasks (Priority: P1)

Max is setting up a recurring "Replace air filter" task. He wants to paste the exact Amazon buy link so that whoever does it next month doesn't have to re-derive which filter size fits. He opens the task, types a note with the URL, and saves. Later, Jaz opens the same task, sees the note, and taps the link — it opens the product page in her browser.

**Why this priority**: Notes are the foundational data capability of this feature and a prerequisite for the same rendering used by event notes (Story 3). It unlocks the most-requested capture behavior (reservation links, buy links, map links) with the least dependency on other stories.

**Independent Test**: Create or edit a task, add a note containing a URL, save, reopen the task, and confirm the note text is shown and the URL is a tappable link that opens correctly. Fully testable without any of the other three stories.

**Acceptance Scenarios**:

1. **Given** a task with no note, **When** a user opens it and adds note text and saves, **Then** the note is persisted and displayed the next time the task's details are opened (by either user).
2. **Given** a task note containing one or more URLs, **When** the note is displayed, **Then** each URL renders as a tappable link that opens the target in a new browser context; the surrounding non-URL text is shown as plain text.
3. **Given** a task with an existing note, **When** a user edits the note text and saves, **Then** the updated note replaces the previous one and the change is recorded in the activity log.
4. **Given** the task create flow, **When** a user enters a note during creation, **Then** the note is saved with the new task.

---

### User Story 2 - Acknowledge / commit on assigned tasks (Priority: P1)

Jaz assigns "Pick up the dog from daycare by 6pm" to Max. Until Max sees it and taps **I've got it**, the task visibly reads as *not yet committed* so Jaz can tell at a glance whether she still needs to chase it. When Max acknowledges, Jaz gets an instant ping on her phone and a dismissible notice on her dashboard confirming Max has it — closing the coordination loop without a text message.

**Why this priority**: This is the collaboration heart of the feature — the difference between a shared list and a coordination tool. It directly automates the "did you see the thing I asked you to do?" exchange.

**Independent Test**: As user A, assign a task to user B. Confirm the task reads as "not yet committed" for both users. As user B, tap **I've got it**. Confirm user A receives an instant ping and a dismissible dashboard notification, and the task no longer reads as uncommitted. Testable without notes or event changes.

**Acceptance Scenarios**:

1. **Given** a task assigned to the other person that has not been acknowledged, **When** either user views it, **Then** it visibly reads as "not yet committed".
2. **Given** a task assigned to the other person, **When** the assignee taps **I've got it**, **Then** the task is marked acknowledged (with who acknowledged and when), the "not yet committed" indicator clears, and the change is recorded in the activity log.
3. **Given** the assignee has just acknowledged, **When** the acknowledgement is recorded, **Then** the assigner receives an instant ntfy ping and a dismissible notification appears on the assigner's dashboard.
4. **Given** a task owned by `both` or self-assigned, **When** it is viewed, **Then** no acknowledgement action is shown and it never reads as "not yet committed".
5. **Given** an assigned task that is later reassigned to the other owner, **When** the new assignee views it, **Then** it reads as "not yet committed" again (acknowledgement is per current assignee).
6. **Given** the assigner dismisses the dashboard notification, **When** they return to the dashboard, **Then** that notification does not reappear.

---

### User Story 3 - Event notes create/edit (Priority: P2)

Max is creating a "Dinner at Nonna's — anniversary" event. He wants to jot the reservation confirmation link and a note about the dress code. Today the Events data already carries a notes field and the detail view shows it, but nothing in the app ever *asks* for it. This story adds a notes field to the event create and edit forms, rendered with the same tappable-link behavior as task notes.

**Why this priority**: Lower than task notes because the display path already exists — this is filling in the missing input UI — but it completes the notes-capture story symmetrically across both tasks and events.

**Independent Test**: Create an event with a note containing a URL; confirm it saves, displays in the detail view, and the URL is tappable. Edit the note on an existing event; confirm it updates. Reuses Story 1's link rendering.

**Acceptance Scenarios**:

1. **Given** the event create flow, **When** a user enters a note, **Then** the note is saved with the new event and shown in its detail view.
2. **Given** an existing event, **When** a user edits its note and saves, **Then** the updated note is persisted, displayed, and recorded in the activity log.
3. **Given** an event note containing URLs, **When** it is displayed, **Then** URLs render as tappable links exactly as task notes do.

---

### User Story 4 - Event location (Priority: P2)

Jaz creates a "Vet appointment" event and enters the clinic's address as the location. It shows in the event's detail view. Because the household mirrors events to a shared Google Calendar, the location also lands on the mirrored calendar event — so tapping the event in Google Calendar offers directions in Google Maps.

**Why this priority**: Independent of notes and acknowledgement; valuable but affects fewer everyday interactions than the collaboration loop.

**Independent Test**: Create or edit an event with a location, confirm it displays in the detail view, then confirm (via the calendar-sync path) the mirrored Google Calendar event carries the same location and offers directions. Testable without the other three stories.

**Acceptance Scenarios**:

1. **Given** the event create or edit flow, **When** a user enters a location, **Then** it is saved with the event and displayed in the detail view.
2. **Given** an event that has a location, **When** it is synced to the shared Google Calendar, **Then** the mirrored calendar event's location field carries the same value.
3. **Given** an event whose location is later changed or cleared, **When** it re-syncs, **Then** the mirrored calendar event's location is updated to match (including being cleared).
4. **Given** an event with no location, **When** it is created or synced, **Then** no location is shown and the mirrored event has an empty location (no regression to existing sync behavior).

---

### Edge Cases

- A note containing a URL with no scheme (e.g. `maps.google.com/...` without `https://`) — the system should still recognize and linkify common URL shapes, or clearly show it as plain text if it cannot. (Resolved in Assumptions.)
- A note or location containing characters that could be misread as markup — must render as literal text, never execute as markup.
- Very long notes — must not break the layout of the detail sheet; wrap or scroll.
- An assigned task is completed before it is acknowledged — completion supersedes; no dangling "not yet committed" state on a done task.
- The same task is assigned back to its original assigner (self-assign) — acknowledgement action disappears; any prior acknowledgement state is irrelevant.
- The ntfy ping fails to send (network/service down) — acknowledgement still succeeds; the ping is best-effort like the existing 009 completion pings.
- An event location is set but calendar sync is disabled or the event isn't mirrored — the location still shows in-app; sync is a no-op.

## Requirements *(mandatory)*

### Functional Requirements

**Task notes (Story 1)**

- **FR-001**: The system MUST allow a note (free text) to be attached to any task, entered during task creation and edited wherever a task's details are opened.
- **FR-002**: The system MUST persist task notes and display them whenever the task's details are viewed by either user.
- **FR-003**: When displaying a task note, the system MUST render substrings beginning with `http://` or `https://` as tappable links that open the target in a new browser context, while showing all other text (including bare `www.`/domain strings) as plain, non-executable text.
- **FR-004**: The system MUST record note additions and edits in the activity log (timestamp, actor, action, target task).

**Acknowledge / commit (Story 2)**

- **FR-005**: For a task assigned to the person who is not the actor (i.e. owner is the *other* single person, not `both` and not self), the system MUST present an acknowledgement action ("I've got it") to the assignee.
- **FR-006**: Until acknowledged, a task assigned to the other person MUST visibly read as "not yet committed" to both users, on its card in the Tasks tab and Home dashboard and in its detail sheet. Calendar chips do not carry the indicator; the state is visible after tapping the chip into the detail sheet.
- **FR-006a**: The "I've got it" action MUST be reachable inline on the assignee's task card (in the Tasks tab and Home dashboard) as well as in the detail sheet.
- **FR-007**: When the assignee acknowledges, the system MUST record the acknowledgement (who and when) and clear the "not yet committed" indicator.
- **FR-008**: When an acknowledgement is recorded, the system MUST send the assigner an instant ntfy ping (reusing the existing ntfy delivery), as a best-effort side effect that does not block the acknowledgement.
- **FR-009**: When an acknowledgement is recorded, the system MUST surface a dismissible notification on the assigner's dashboard. The notice MUST persist across reloads until the assigner dismisses it (dismissal is remembered so it never reappears); it does not auto-clear when the task is completed.
- **FR-010**: The system MUST NOT show the acknowledgement action or the "not yet committed" state for tasks owned by `both` or assigned to the current actor themselves.
- **FR-011**: If a task's assignee changes, acknowledgement state MUST reset so the new assignee's commitment is tracked (the task reads "not yet committed" again until the new assignee acknowledges).
- **FR-012**: A completed task MUST NOT read as "not yet committed" regardless of acknowledgement state.
- **FR-013**: The system MUST record acknowledgements in the activity log.

**Event notes (Story 3)**

- **FR-014**: The system MUST allow a note to be entered during event creation and edited on existing events.
- **FR-015**: Event notes MUST display in the event detail view with the same URL-linkification behavior as task notes.
- **FR-016**: The system MUST record event note additions and edits in the activity log.

**Event location (Story 4)**

- **FR-017**: The system MUST allow a location (free text) to be entered during event creation and edited on existing events, and MUST display it in the event detail view.
- **FR-018**: When an event with a location is mirrored to the shared Google Calendar, the system MUST set the mirrored event's location field to the same value.
- **FR-019**: When an event's location changes or is cleared, a subsequent sync MUST update the mirrored event's location to match (including clearing it), without disturbing other synced fields.

**Cross-cutting**

- **FR-020**: All new stored fields MUST keep the underlying data human-readable and hand-editable (a person editing the sheet directly must not break the app).
- **FR-021**: Notes and location text MUST be treated as literal content and never rendered as executable markup.

### Key Entities *(include if feature involves data)*

- **Task**: Gains a **note** attribute (free text, may contain URLs) and **acknowledgement** state (whether the current assignee has committed, plus who acknowledged and when). Existing owner/assignment, due date, and completion attributes are unchanged.
- **Event**: Gains a **note** attribute (already stored; now editable) and a new **location** attribute (free text). Existing title/date/prep-template attributes are unchanged.
- **Dashboard notification**: A dismissible, per-recipient notice that an assigned task has been acknowledged. Tied to the acknowledging task and the assigner as recipient; has a dismissed/undismissed state.
- **Activity log entry**: Existing entity; new action types for note edits and acknowledgements.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a note with a working, tappable link to a task and to an event, and the other user can open and follow that link — verified end-to-end for both tasks and events.
- **SC-002**: 100% of tasks assigned to the other single person display a clear "not yet committed" state until acknowledged, and clear it immediately upon acknowledgement.
- **SC-003**: When an assignee acknowledges, the assigner is notified through both channels (dashboard notice + phone ping) without any additional action by the assignee.
- **SC-004**: An event with a location set in the app shows that location in the app and, after sync, in the shared Google Calendar, where it offers directions.
- **SC-005**: No regression: existing tasks/events without notes, locations, or cross-person assignments behave exactly as before, and the underlying sheet remains hand-editable.

## Assumptions

- **URL linkification scope** (resolved 2026-07-11): only substrings with an explicit `http://` or `https://` scheme are linkified; bare `www.`/domain strings and everything else render as plain text. Links open in a new browser context. This avoids false positives (emails, filenames, versions).
- **Single-field notes**: Notes are a single free-text field per task/event (not threaded comments or multiple notes). This matches "kitchen corkboard, not Jira board."
- **Acknowledgement is one-directional and simple**: There is a single "I've got it" commit; there is no separate decline/renegotiate action in this feature (a task can still be reassigned or snoozed via existing flows).
- **"The other person"**: Owner values are `max`, `jaz`, or `both` (feature invariant: two people only). "Assigned to the other person" means the owner is the single person who is *not* the current actor. The shared account is resolved to a person before this logic applies (per the auth model).
- **Dashboard notifications reuse existing patterns**: The dismissible dashboard notice builds on the existing dashboard surface (feature 014) and the existing ntfy plumbing (feature 009); no new external service is introduced. The notice is derived from the acknowledgement record plus a remembered per-recipient dismissal flag so it survives reloads (resolved 2026-07-11).
- **Calendar location sync reuses the existing one-way outbound sync** (feature 007) — location is added to the fields already mirrored; no new sync direction or scope is introduced.
- **Notes and location are optional** on every task/event; empty is the default and shows nothing.
