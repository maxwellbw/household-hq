# Feature Specification: Recurring Chore Engine

**Feature Branch**: `004-recurring-engine`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "Recurring chore engine: a nightly time-driven trigger materializes upcoming task instances from recurrence rules stored in the Recurring tab. Households define chores with a cadence (weekly, biweekly, monthly, quarterly, annually), an anchor date, and a default owner (max/jaz/both) — e.g. flea/tick meds monthly, mow lawn weekly in season, air filter quarterly. The engine reads each rule, computes which instances are due within a lookahead window, and creates Tasks (linked back via recurringId) idempotently so re-runs and overlapping trigger executions never duplicate a task. Each generated task gets a title and dueDate from the rule; completing an instance does not affect the rule. The UI only ever renders the generated Tasks, never the rules directly. Every generation appends to ActivityLog. Also needs CRUD for the recurrence rules themselves (create/edit/delete a Recurring rule) via the JSON API."

## Clarifications

### Session 2026-07-08

- Q: Is seasonal scoping ("mow lawn weekly in season") in scope for feature 004? → A: Yes — add **optional** season bounds (season start and season end as whole month numbers 1–12) to a rule; occurrences whose due month falls outside the window are not generated. Rules without season bounds run year-round. (Whole-month granularity matches the `seasonStart`/`seasonEnd` columns already provisioned in the Recurring tab.)
- Q: If a member deletes a generated occurrence task, may the generator re-create that same occurrence later? → A: No — never resurrect. A user-deleted occurrence is treated as handled and permanently suppressed (the rule's materialization marker advances past it so future runs skip it).
- Q: How far ahead does the generator materialize, and where does the horizon live? → A: **30 days**, stored in the **Settings** tab (hand-tunable), bounding both normal generation and first-run catch-up.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A chore recurs on its own without being re-entered (Priority: P1)

Max or Jaz defines a recurring chore once — a title, how often it repeats, when the
cycle is anchored, and who owns it by default — and from then on the household finds a
fresh, dated task waiting in the list whenever the chore comes due. Nobody has to
remember to re-create "give the dog flea meds" every month; it simply appears on the
list ahead of its due date. Completing one occurrence does nothing to the rule — the
next occurrence still shows up on schedule.

**Why this priority**: This is the entire point of the feature and the mechanism that
removes the largest source of recurring mental load — remembering the chores that have
no natural trigger. Without automatic materialization there is no feature.

**Independent Test**: Define a monthly rule anchored in the past, run the generator, and
confirm exactly the expected dated tasks appear (owner and title carried from the rule),
that completing one leaves the rule untouched, and that the next run produces the next
occurrence and no duplicate of the first.

**Acceptance Scenarios**:

1. **Given** a recurring rule with a cadence, an anchor date, a default owner, and a
   title, **When** the generator runs, **Then** a dated task exists for every occurrence
   that falls due within the lookahead window, each carrying the rule's title and default
   owner and linked back to the rule.
2. **Given** the generator has already produced an occurrence's task, **When** the
   generator runs again (on schedule, re-run, or overlapping execution), **Then** no
   second task is created for that same occurrence — the occurrence is materialized at
   most once.
3. **Given** a generated occurrence task, **When** a user completes it, **Then** the rule
   is unchanged and future occurrences continue to be generated on schedule.
4. **Given** a generated occurrence task, **When** any occurrence task is created,
   **Then** an entry is appended to the household activity log recording the generation.

---

### User Story 2 - Manage the recurring chores themselves (Priority: P1)

Max or Jaz can set up a new recurring chore, adjust an existing one (change its title,
cadence, anchor, or default owner), or retire one that is no longer needed — all through
the same service interface the rest of the app uses. The rules are data the household
owns and edits, not a fixed list baked into the app.

**Why this priority**: Materialization is worthless if the household cannot express what
recurs. Creating and retiring rules is the control surface for the whole feature and is
required for the P1 flow to be usable by real people rather than seeded by hand.

**Independent Test**: Through the service interface, create a rule, read it back, edit
each of its fields, and delete it — verifying each change persists and is attributed in
the activity log, independent of whether any tasks have yet been generated.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they create a recurring rule with title, cadence,
   anchor date, and default owner, **Then** the rule persists and is available to the
   generator on its next run.
2. **Given** an existing rule, **When** a user edits its title, cadence, anchor, or
   default owner, **Then** the change persists and the next generation reflects it, while
   already-generated tasks are left as they are.
3. **Given** an existing rule, **When** a user deletes it, **Then** it stops producing new
   occurrences, and already-generated occurrence tasks remain in the list as ordinary
   tasks.
4. **Given** any create, edit, or delete of a rule, **When** it succeeds, **Then** the
   change is attributed to the acting user in the activity log.

---

### User Story 3 - Catch up gracefully when the engine has been idle (Priority: P2)

If the generator has not run for a while (trigger paused, a rule added with an old
anchor, the household away), the next run brings the list up to date without flooding it
— it produces the occurrence(s) genuinely relevant to now and the near future, not a
backlog of every occurrence since the anchor date.

**Why this priority**: Correct behavior at the edges is what makes the household trust the
list. A rule anchored a year ago must not spawn twelve overdue monthly tasks on first
run. This refines the P1 mechanism rather than adding a new capability, so it is P2.

**Independent Test**: Create a rule anchored far in the past, run the generator once, and
confirm the number of tasks produced matches the lookahead policy (a bounded set around
today) rather than one-per-cycle-since-anchor.

**Acceptance Scenarios**:

1. **Given** a rule whose anchor date is far in the past and which has never generated,
   **When** the generator runs, **Then** only occurrences within the lookahead window
   (the current/next due occurrence and any within the horizon) are materialized, not one
   task per elapsed cycle.
2. **Given** a rule that has generated occurrences up to some date, **When** the generator
   runs later, **Then** it resumes from where it left off and creates only the not-yet-
   materialized occurrences within the window.

---

### Edge Cases

- **Month-end anchors**: a monthly (or quarterly/annually) rule anchored on the 31st in a
  month that has no 31st resolves to that month's last day, and returns to the anchor day
  in months that have it.
- **Leap day anchors**: an annual rule anchored on Feb 29 resolves to Feb 28 in non-leap
  years.
- **Rule edited after generation**: changing a rule's cadence or anchor does not rewrite,
  move, or delete tasks already generated; it only affects occurrences not yet
  materialized.
- **User deletes a generated occurrence task**: the occurrence is permanently suppressed —
  the generator never re-creates it (FR-013).
- **Rule with a due occurrence exactly today**: today's occurrence is materialized (the
  window is inclusive of the current day).
- **Concurrent runs**: an overlapping or retried generator execution never produces a
  duplicate occurrence (idempotency and locking).
- **Owner value**: a rule's default owner is one of the three household values
  (`max`/`jaz`/`both`); a `both` occurrence behaves like any other `both` task once
  generated.
- **Hand-edited Recurring tab**: a rule row added or edited by hand directly in the Sheet
  is picked up by the next generation like any other rule.
- **Seasonal chores** ("mow lawn weekly in season"): a rule with season bounds only
  generates occurrences inside the window; an out-of-season run produces nothing for that
  rule (FR-014). A season window that wraps the year end (e.g. Nov–Feb) is honored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a signed-in household member define a recurring chore
  rule consisting of a title, a cadence, an anchor date, and a default owner
  (`max`/`jaz`/`both`).
- **FR-002**: The system MUST support these cadences: weekly, biweekly (every two weeks),
  monthly, quarterly (every three months), and annually.
- **FR-003**: The system MUST, on a recurring automated schedule (nightly), materialize
  the occurrences that fall due within a defined lookahead window into dated tasks, with
  no human action required.
- **FR-004**: Each generated task MUST carry the rule's title as its title, the
  occurrence's computed date as its due date, and the rule's default owner as its owner.
- **FR-005**: Each generated task MUST be linked back to the rule that produced it, so the
  system can tell which rule an occurrence came from.
- **FR-006**: Generation MUST be idempotent: for a given rule and occurrence date, at most
  one task is ever created, regardless of how many times or how concurrently the generator
  runs (re-runs, overlaps, and retries never duplicate).
- **FR-007**: The generator MUST tolerate concurrent execution without creating duplicate
  or corrupt rows.
- **FR-008**: Completing, editing, reopening, or deleting a generated occurrence task MUST
  have no effect on the rule; the rule continues to produce future occurrences.
- **FR-009**: The system MUST let a signed-in member edit an existing rule's title,
  cadence, anchor date, and default owner.
- **FR-010**: The system MUST let a signed-in member delete a rule; after deletion the
  rule produces no further occurrences, and already-generated occurrence tasks remain as
  ordinary tasks.
- **FR-011**: The system MUST append an activity-log entry for every rule create, edit,
  and delete (attributed to the acting user) and for every occurrence-task generation
  (attributed to the automated generator).
- **FR-012**: The presentation layer MUST render only the generated tasks; recurrence
  rules are never surfaced to end users as tasks. (Rule management is a separate control
  surface; the day-to-day list shows only materialized tasks.)
- **FR-013**: If a household member deletes a generated occurrence task, the generator
  MUST NOT re-create that same occurrence on any later run. A deleted occurrence is
  permanently suppressed (treated as handled); the rule's materialization marker advances
  past the deleted occurrence so future runs skip it.
- **FR-014**: A rule MAY optionally be limited to a seasonal window defined by a season
  start month and a season end month (each an integer 1–12, e.g. 4–10 for Apr–Oct). When
  season bounds are present, only occurrences whose due month falls within the window are
  materialized; occurrences outside it are skipped (never generated). Season bounds are
  all-or-nothing (both set or both blank); a rule with neither runs year-round. Windows may
  wrap the year end (e.g. 11–2 for Nov–Feb).
- **FR-015**: Occurrence due dates MUST be computed and stored in the single household
  timezone, consistent with how all other dated items are handled.
- **FR-016**: The lookahead horizon (default 30 days) MUST be read from the Settings tab
  so it is hand-tunable without a code change; it bounds both routine generation and
  first-run catch-up.

### Key Entities *(include if feature involves data)*

- **Recurring Rule**: the definition of a chore that repeats. Attributes: a stable
  identifier, a title, a cadence (weekly/biweekly/monthly/quarterly/annually), an anchor
  date establishing the cycle's phase, a default owner (`max`/`jaz`/`both`), optional
  season bounds (season start month and season end month, 1–12; absent = year-round), and a
  marker of how far it has already been materialized (so the generator can resume and so
  user-deleted occurrences are not resurrected). Owned and edited by the household; never
  shown to end users as a task.
- **Settings (existing)**: gains a hand-tunable lookahead-horizon value (default 30 days)
  read by the generator.
- **Generated Occurrence Task**: an ordinary household task produced from a rule for one
  occurrence. Carries the rule's title, the occurrence's due date, and the rule's owner,
  plus a link back to its originating rule. Once created it lives and dies as a normal
  task — completing, editing, or deleting it does not touch the rule.
- **Activity Log Entry**: the existing append-only household feed record; this feature
  adds entries for rule create/edit/delete (by a user) and occurrence generation (by the
  automated generator).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A household member can define a recurring chore in one sitting (title,
  cadence, anchor, owner) and, without any further action, sees the corresponding dated
  task appear on the list on or before its due date.
- **SC-002**: Across repeated and overlapping runs of the generator, the number of tasks
  materialized for any single occurrence is exactly one (zero duplicates observed over a
  full cycle of a rule at each supported cadence).
- **SC-003**: A rule whose anchor is far in the past produces a bounded, near-term set of
  tasks on first run (no unbounded backlog), matching the lookahead policy.
- **SC-004**: Completing a generated occurrence never prevents, delays, or duplicates the
  next occurrence: for each cadence, completing occurrence N still yields occurrence N+1 on
  schedule.
- **SC-005**: Every rule change and every generated occurrence is traceable in the
  activity log with actor and target, with no state change unlogged.
- **SC-006**: A recurring rule set up entirely by hand-editing the Recurring tab (no app
  UI) is picked up and materialized identically to one created through the service.

## Assumptions

- **Lookahead window**: the generator materializes occurrences due from today through a
  **30-day** horizon (read from Settings, hand-tunable) rather than one task per elapsed
  cycle; this bounds the "catch-up" behavior in User Story 3 (FR-016).
- **Nightly schedule**: "materialize upcoming instances" runs on a single daily automated
  trigger; sub-daily precision is not required for chores.
- **Cadence phase** is derived from the anchor date: weekly/biweekly repeat on the anchor's
  weekday every 1/2 weeks; monthly/quarterly/annually repeat on the anchor's day-of-month
  every 1/3/12 months, with month-length and leap-day clamping per the edge cases.
- **Editing a rule** affects only future (not-yet-materialized) occurrences; already-
  generated tasks are independent and untouched, consistent with FR-008.
- **Deleting a rule** leaves already-generated occurrence tasks in place; they are ordinary
  tasks from that point on.
- **Reuse of existing task semantics**: generated occurrences are ordinary tasks and inherit
  the full task lifecycle (complete/reopen/edit/delete, owner semantics, filtering) already
  specified for tasks; this feature does not redefine task behavior.
- **Attribution of generation**: automated generation is attributed to a system/generator
  actor in the activity log, distinct from a human user.
- **Frontend**: no user-facing UI ships in this feature; rule management and occurrence
  display are consumed by the calendar/list UI in a later feature. This feature delivers the
  rules data, the generator, and the rule-management service interface.

## Dependencies

- Builds on the household task model and lifecycle (feature 003) — generated occurrences are
  ordinary tasks.
- Builds on verified identity and the household allowlist (feature 002) for rule-management
  writes.
- Builds on the Sheet-backed data store and JSON service interface (feature 001), including
  the Recurring tab and the append-only activity log.
