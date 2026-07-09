# Feature Specification: Events and Prep Templates

**Feature Branch**: `005-events-and-prep-templates`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Events and prep templates. Two-user household manager (Max + Jaz). Events are calendar items with id, title, start, end, owner (max/jaz/both), type, templateId?, notes, gcalEventId?. Full CRUD: create/edit/delete events with owner tagging (work trip = one person, concert = both). TaskTemplates are reusable prep checklists tied to an event type: id, eventType, taskTitle, offsetDays (e.g. -2 = two days before), defaultOwner. When an event is tagged with a template (e.g. 'guests visiting'), a trigger auto-creates dated prep tasks at the offsets (clean house T-2, groceries T-1), each linked back to the event via eventId. The UI only ever renders Events and Tasks; triggers do all task generation. Backend is Google Apps Script serving JSON, Sheets is the DB. Every state change appends to ActivityLog. Prep-task generation must be idempotent (safe to re-run) since triggers re-run."

## Clarifications

### Session 2026-07-08

- Q: How does an event select which prep checklist applies (given Events has both `type` and `templateId`, and TaskTemplates is keyed by `eventType`)? → A: **`templateId` is the selector.** An event carries a `templateId` whose value matches a checklist's `eventType`; the generator materializes every TaskTemplates row where `eventType == event.templateId`. `type` remains a free descriptive/display label (concert, work trip) and does **not** drive prep. An event with a blank `templateId` gets no prep.
- Q: When are prep tasks materialized for a tagged event? → A: **On save + nightly.** Prep is generated synchronously the moment an event is saved with a `templateId` (immediate), and a nightly time-driven trigger re-runs generation idempotently to catch hand-edited Sheet rows and missed runs. Both paths are idempotent (at most one prep task per event-and-step).
- Q: When an event is deleted, what happens to its prep tasks? → A: **Delete all prep.** Deleting an event removes every prep task linked to it — completed and outstanding alike — leaving no orphaned prep on the list. (This differs from a move/retag, where the event still exists and completed prep is preserved.)
- Q: How is a prep step's day offset stored and applied? → A: **Signed negative int, matching the brief.** `offsetDays` is a signed integer where T−2 (two days before) is stored as `-2`; a prep task's due date = event start date + `offsetDays` (so `-2` yields two days earlier). This keeps the Sheet self-documenting and hand-editable exactly as the brief shows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Put an event on the household calendar (Priority: P1)

Max or Jaz records something the household needs to know about — a work trip, a
concert, guests visiting, a vet appointment — as an event with a title, a start and
end, and an owner tag that says whose it is: one person for a solo work trip, or
`both` for a shared night out. They can later edit any of those details or remove the
event entirely. The event is the anchor that everything else in the household hangs
from; getting it onto the shared calendar is the first, essential act.

**Why this priority**: Events are the backbone of the whole product — the calendar is
the home screen and tasks tether to the events they lead up to. Without the ability to
capture and own events, nothing downstream (prep tasks, calendar view, sync) has
anything to attach to. This is the minimum viable slice.

**Independent Test**: Through the service interface, create an event with a title,
start, end, and owner; read it back; edit each field including the owner; and delete
it — verifying every change persists and is attributed in the activity log, with no
template or prep behavior required.

**Acceptance Scenarios**:

1. **Given** a signed-in household member, **When** they create an event with a title,
   a start, an end, and an owner (`max`/`jaz`/`both`), **Then** the event persists with
   a stable identifier and is available to read back.
2. **Given** an existing event, **When** a member edits its title, start, end, owner,
   type, or notes, **Then** the change persists and the event reflects the new values.
3. **Given** an existing event, **When** a member deletes it, **Then** the event is
   removed from the calendar data.
4. **Given** any create, edit, or delete of an event, **When** it succeeds, **Then** the
   change is attributed to the acting member in the activity log.

---

### User Story 2 - Keep a library of reusable prep checklists (Priority: P1)

The household maintains a small set of named prep checklists, one per kind of event —
"guests visiting", "work trip", "dinner party". Each checklist is a list of prep steps,
and each step says how many days before the event it is due (clean house two days
before, groceries the day before) and who does it by default. Members can add a new
checklist kind, add or change or remove steps within a kind, and retire a kind that is
no longer used. These checklists are data the household owns and edits, not a fixed list
baked into the app.

**Why this priority**: The templates are the control surface for the headline feature —
auto-generated prep. Without the ability to define what "prep for guests visiting" means,
tagging an event with a template does nothing. Defining and editing checklists is
required for the P1 auto-generation flow to be usable by real people rather than seeded
by hand.

**Independent Test**: Through the service interface, create a checklist step for an event
kind (a step title, an offset in days before the event, a default owner), read the
library back, edit each field of a step, and delete a step — verifying each change
persists and is attributed in the activity log, independent of whether any event yet
uses that kind.

**Acceptance Scenarios**:

1. **Given** a signed-in member, **When** they define a prep step for an event kind (with
   a step title, a days-before offset, and a default owner), **Then** the step persists
   and is available whenever an event of that kind is tagged.
2. **Given** an existing prep step, **When** a member edits its title, offset, or default
   owner, **Then** the change persists and applies to future generations for that kind.
3. **Given** an existing prep step, **When** a member deletes it, **Then** it no longer
   contributes a prep task to future generations for that kind.
4. **Given** any create, edit, or delete of a prep step, **When** it succeeds, **Then** the
   change is attributed to the acting member in the activity log.

---

### User Story 3 - Tag an event and get its prep tasks automatically (Priority: P1)

When Max or Jaz tags an event with a prep checklist — marking the "Kim & family visiting"
weekend as a "guests visiting" event — the household finds the prep steps already on the
task list as dated tasks, each due the right number of days before the event and each
pointing back at the event it prepares for: clean the house two days before, do the
groceries the day before. Nobody transcribes the checklist by hand; tagging the event is
enough. Re-running the generator (on schedule, or because the same event is saved again)
never doubles the prep tasks.

**Why this priority**: This is the entire reason the feature exists — turning "we have
guests this weekend" into a concrete, dated, owned prep plan without anyone remembering
the steps. It is the payoff that US1 and US2 exist to enable.

**Independent Test**: Define a prep checklist for a kind, create an event of that kind
with a future start, run the generator, and confirm exactly one dated prep task exists
per checklist step — each carrying the step's title and default owner, dated at the
event's start minus the step's offset, and linked back to the event — then run the
generator again and confirm no duplicates appear.

**Acceptance Scenarios**:

1. **Given** an event tagged with a prep checklist and a checklist with N steps, **When**
   the generator runs, **Then** exactly N dated prep tasks exist, each with the step's
   title, the step's default owner, a due date of the event's start date minus the step's
   offset in days, and a link back to the event.
2. **Given** the generator has already produced an event's prep tasks, **When** the
   generator runs again (on schedule, on re-save, or on overlapping execution), **Then**
   no second prep task is created for any step — each step is materialized at most once
   per event.
3. **Given** an untagged event (no prep checklist), **When** the generator runs, **Then**
   no prep tasks are created for it.
4. **Given** any prep task is generated, **When** it is created, **Then** an entry is
   appended to the household activity log recording the generation.

---

### User Story 4 - Prep keeps up when the event changes (Priority: P2)

Plans move. When the guests push their visit back a week, or a member swaps the event's
checklist, or the event is cancelled outright, the prep tasks keep up: the still-to-do
prep re-dates itself to the event's new start, a changed tag swaps the prep set, and a
cancelled (deleted) event takes all of its prep off the list rather than leaving it to
prepare for something that will never happen. While an event still exists, prep the
household has already finished is left alone as a record of what was done; only outright
deletion of the event clears its prep entirely.

**Why this priority**: Events in a real household move constantly, and stale prep tasks
(dated to a trip that already moved, or prepping for a party that was cancelled) are worse
than none — they erode trust in the list. This refines the P1 generation mechanism for the
messy real world rather than adding a new capability, so it is P2.

**Independent Test**: Generate prep for an event, then (a) move the event's start and
confirm the outstanding prep re-dates to the new start while completed prep is untouched;
(b) change the event's checklist tag and confirm the prep set is replaced; (c) delete the
event and confirm all of its prep tasks are removed (completed and outstanding alike).

**Acceptance Scenarios**:

1. **Given** an event with generated, not-yet-completed prep tasks, **When** the event's
   start date changes, **Then** each outstanding prep task's due date is recomputed as the
   new start plus its `offsetDays`, and already-completed prep tasks are left unchanged.
2. **Given** an event whose prep has been generated, **When** a member changes the event's
   prep-checklist tag to a different kind (or removes it), **Then** outstanding prep tasks
   from the old checklist are removed and prep tasks for the new checklist are generated,
   while already-completed prep tasks remain.
3. **Given** an event with generated prep tasks (any mix of completed and outstanding),
   **When** the event is deleted, **Then** all of its prep tasks are removed — completed
   and outstanding alike — leaving no prep for the deleted event on the list.

---

### Edge Cases

- **Prep offset lands in the past**: an event created only one day before it starts, tagged
  with a checklist whose step is due two days before (`offsetDays = -2`), yields a prep task
  whose computed due date is already past — it is still generated (dated in the past, i.e.
  overdue) rather than silently dropped, so the household sees the step it is now late on.
- **Empty checklist**: an event tagged with a kind that has no prep steps generates no prep
  tasks and is not an error.
- **Checklist edited after generation**: adding, changing, or removing steps in a checklist
  does not rewrite prep tasks already generated for past or existing events except through
  the US4 re-generation paths (event moved, retagged, or deleted); a purely new step added
  to a kind is picked up for events regenerated or newly tagged after the change.
- **Member completes a prep task**: completing a prep task has no effect on the event or on
  other prep tasks; it lives and dies as an ordinary task thereafter.
- **Member deletes a generated prep task by hand**: the deleted prep step is treated as
  handled for that event and is not resurrected by a later generator run.
- **Concurrent runs**: an overlapping or retried generator execution never produces a
  duplicate prep task for the same event-and-step.
- **Owner value**: a prep step's default owner is one of the three household values
  (`max`/`jaz`/`both`); a `both` prep task behaves like any other `both` task once generated.
- **Event with no end / multi-day event**: prep offsets are computed from the event's start
  date; the end date does not affect prep dates.
- **Hand-edited tabs**: an event or a checklist step added or edited by hand directly in the
  Sheet is picked up by the next generation like any other row.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a signed-in household member create an event consisting of
  a title, a start, an end, and an owner (`max`/`jaz`/`both`), and MAY include a descriptive
  `type` label, a prep-checklist selector (`templateId`, matching a checklist's event kind),
  and notes.
- **FR-002**: The system MUST let a signed-in member edit an existing event's title, start,
  end, owner, `type` label, prep-checklist selector (`templateId`), and notes.
- **FR-002a**: The event's `type` is a free descriptive/display label and MUST NOT drive prep
  generation; only `templateId` selects a prep checklist. An event with a blank `templateId`
  generates no prep tasks.
- **FR-003**: The system MUST let a signed-in member delete an event.
- **FR-004**: Each event MUST carry a stable identifier independent of its position in
  storage.
- **FR-005**: The system MUST let a signed-in member define a prep-checklist step tied to an
  event kind, consisting of the event kind it belongs to, a step title, an offset in whole
  days before the event, and a default owner (`max`/`jaz`/`both`).
- **FR-006**: The system MUST let a signed-in member edit and delete individual prep-checklist
  steps.
- **FR-007**: The system MUST expose the current prep-checklist library for reading, so the
  household can see which event kinds have prep defined.
- **FR-008**: When an event carries a `templateId`, the system MUST materialize one dated
  prep task per matching checklist step for that event, with no further human action required —
  both synchronously when the event is saved (immediate) and on a nightly automated trigger
  that re-runs generation idempotently to pick up hand-edited Sheet rows and missed runs.
- **FR-009**: Each generated prep task MUST carry the step's title as its title, the step's
  default owner as its owner, and a due date equal to the event's start date plus the step's
  `offsetDays` (a signed integer; e.g. `offsetDays = -2` yields a due date two days before the
  event's start).
- **FR-010**: Each generated prep task MUST be linked back to the event it prepares for, so
  the system can tell which event a prep task belongs to.
- **FR-011**: Prep-task generation MUST be idempotent: for a given event and a given checklist
  step, at most one prep task is ever created, regardless of how many times or how concurrently
  the generator runs (re-runs, overlaps, and retries never duplicate).
- **FR-012**: The generator MUST tolerate concurrent execution without creating duplicate or
  corrupt rows.
- **FR-013**: Completing, editing, reopening, or deleting a generated prep task MUST have no
  effect on the event or on other prep tasks.
- **FR-014**: If a member deletes a generated prep task by hand, the generator MUST NOT
  re-create that same step's prep task for that event on any later run (a hand-deleted prep
  task is treated as handled).
- **FR-015**: When an event's start changes, the system MUST recompute the due dates of that
  event's outstanding (not-yet-completed) prep tasks from the new start, and MUST leave
  already-completed prep tasks unchanged.
- **FR-016**: When an event's prep-checklist tag changes (to a different kind or to none),
  the system MUST remove that event's outstanding prep tasks from the old checklist and
  generate prep tasks for the new checklist, while leaving already-completed prep tasks
  unchanged.
- **FR-017**: When an event is deleted, the system MUST remove all prep tasks linked to that
  event — completed and outstanding alike — leaving no prep for the deleted event on the list.
  (This differs from a move or retag, where the event persists and completed prep is preserved
  per FR-015/FR-016.)
- **FR-018**: A prep task whose computed due date falls in the past MUST still be generated
  (dated in the past / overdue), not silently dropped.
- **FR-019**: The system MUST append an activity-log entry for every event create, edit, and
  delete and every prep-checklist step create, edit, and delete (attributed to the acting
  member), and for every prep-task generation (attributed to the automated generator).
- **FR-020**: The presentation layer MUST render only events and tasks; prep-checklist steps
  are never surfaced to end users as tasks. (Checklist management is a separate control
  surface; the day-to-day list shows only events and materialized tasks.)
- **FR-021**: Event start/end values and computed prep-task due dates MUST be handled in the
  single household timezone, consistent with how all other dated items are handled.

### Key Entities *(include if feature involves data)*

- **Event**: a calendar item the household needs to know about. Attributes: a stable
  identifier, a title, a start, an end, an owner (`max`/`jaz`/`both`), an optional descriptive
  `type` label (free text for display/color; does not drive prep), an optional prep-checklist
  selector `templateId` (whose value matches a checklist's event kind and selects which prep
  checklist applies; blank = no prep), optional notes, and (reserved for a later feature) an
  optional external-calendar reference. Owned and edited by the household.
- **Prep-Checklist Step (TaskTemplate)**: one reusable prep step belonging to an event kind.
  Attributes: a stable identifier, the event kind it belongs to (`eventType` — the join key
  that ties a set of steps together into a named checklist and is matched against an event's
  `templateId`), a step title, `offsetDays` (a signed integer number of days relative to the
  event's start; T−2 = `-2`), and a default owner (`max`/`jaz`/`both`). A "checklist" is the
  set of steps sharing an event kind. Owned and edited by the household; never shown to end
  users as a task.
- **Generated Prep Task**: an ordinary household task produced from a checklist step for a
  specific event. Carries the step's title, the step's default owner, a due date of the event's
  start plus the step's `offsetDays`, and a link back to its event (`eventId`). Once created it
  lives and dies as a normal task — completing, editing, or deleting it does not touch the event
  or the checklist.
- **Activity Log Entry**: the existing append-only household feed record; this feature adds
  entries for event create/edit/delete and checklist-step create/edit/delete (by a member) and
  prep-task generation (by the automated generator).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A household member can put an event on the calendar in one sitting (title,
  start, end, owner) and later change any field or remove it, with every change reflected on
  read-back.
- **SC-002**: A household member can tag a future event with a prep checklist and, without any
  further action, see one dated prep task per checklist step appear on the list, each due the
  correct number of days before the event and linked to it.
- **SC-003**: Across repeated and overlapping runs of the generator, the number of prep tasks
  materialized for any single event-and-step is exactly one (zero duplicates observed).
- **SC-004**: Moving an event's start re-dates all of its outstanding prep tasks to match the
  new start, and completed prep tasks are never moved; deleting an event leaves none of its
  prep tasks behind (completed and outstanding alike are removed).
- **SC-005**: Every event change, every checklist-step change, and every generated prep task is
  traceable in the activity log with actor and target, with no state change unlogged.
- **SC-006**: An event or checklist step set up entirely by hand-editing the Sheet (no app UI)
  is picked up and materialized identically to one created through the service.

## Assumptions

- **Template linking model** (resolved in clarification): a "prep template" is not a single
  row but the *set* of prep-checklist steps sharing an event kind (`eventType`); an event
  selects a checklist by carrying a `templateId` whose value matches that event kind. Applying
  "guests visiting" to an event means setting its `templateId` to that kind, and every
  checklist step with `eventType == templateId` generates a prep task. The event's `type` is a
  separate free descriptive/display label and does not drive prep.
- **Generation timing** (resolved in clarification): prep-task generation happens both
  synchronously when an event is saved with a `templateId` (immediate) and on a nightly
  automated trigger that re-runs generation idempotently for hand-edited rows and missed runs —
  mirroring the recurring-chore engine's trigger pattern (feature 004). Both paths are
  idempotent (at most one prep task per event-and-step).
- **Offset semantics** (resolved in clarification): `offsetDays` is a signed integer of days
  relative to the event's start, matching the brief's `-2` example; a step "two days before" on
  an event starting the 10th is stored as `-2` and due the 8th (due date = start + `offsetDays`).
- **Prep dates key off the event's start**, not its end; multi-day events prep relative to when
  they begin.
- **Reuse of existing task semantics**: generated prep tasks are ordinary tasks and inherit the
  full task lifecycle (complete/reopen/edit/delete, owner semantics, filtering) already specified
  for tasks (feature 003); this feature does not redefine task behavior.
- **Reuse of existing event storage**: the Events tab and basic event fields already exist in the
  data store (feature 001); this feature completes event management and adds the prep-template
  and generation behavior on top.
- **Attribution of generation**: automated prep generation is attributed to a system/generator
  actor in the activity log, distinct from a human member.
- **Frontend**: no user-facing UI ships in this feature; event management, checklist management,
  and prep display are consumed by the calendar/list UI in a later feature (006). This feature
  delivers event CRUD, checklist-step CRUD, and the prep-generation engine through the service
  interface.

## Dependencies

- Builds on the household task model and lifecycle (feature 003) — generated prep tasks are
  ordinary tasks linked by event.
- Reuses the recurring-chore engine's generation/idempotency patterns (feature 004) — trigger
  materialization, at-most-once creation, and non-resurrection of hand-deleted items.
- Builds on verified identity and the household allowlist (feature 002) for event- and
  checklist-management writes.
- Builds on the Sheet-backed data store and JSON service interface (feature 001), including the
  Events and TaskTemplates tabs and the append-only activity log.
