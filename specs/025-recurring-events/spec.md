# Feature Specification: Recurring Events

**Feature Branch**: `025-recurring-events`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Recurring events: the household needs events that recur on their own — birthdays, anniversaries, annual checkups, quarterly filter swaps — instead of being re-created by hand each cycle. Extend the recurrence concept (today it only materializes Tasks, feature 004) to also materialize Events, with full parity to the task engine's cadences (weekly, biweekly, monthly, sixweekly, eightweekly, quarterly, annually / yearly). A recurring-event rule carries a title, cadence, an anchor date (and time-of-day / duration for the occurrence), a default owner (max/jaz/both), and optional season bounds — mirroring how recurring chores work. A nightly generator materializes upcoming Event occurrences within the lookahead window, idempotently (re-runs and overlapping trigger executions never duplicate an occurrence), links each occurrence back to its rule, appends to ActivityLog, and never resurrects an occurrence a user has deleted. Editing or deleting a rule affects only future occurrences; already-generated events stay put. Additionally, a prep-checklist template (feature 005's TaskTemplates) can be attached to the rule so every generated occurrence automatically gets its prep tasks — e.g. a birthday rule auto-creates \"buy gift\" and \"plan dinner\" for each year's occurrence. The UI renders only the generated Events (and their prep tasks), never the rules directly, plus CRUD for the recurring-event rules through the same JSON API the rest of the app uses."

## Clarifications

### Session 2026-07-12

- Q: How should a recurring-event occurrence express its time on the calendar (given all-day events are a parked fix)? → A: Add all-day support in this feature — an occurrence is all-day by default (date only, no time), the natural shape for birthdays/anniversaries, with an optional time-of-day + duration on the rule for timed occasions (e.g. an annual checkup). This supersedes the parked all-day-toggle fix for recurring-event occurrences.
- Q: How far ahead should the generator materialize recurring events? → A: A separate, hand-tunable events lookahead horizon in Settings (default 60 days), independent of the 30-day recurring-chore horizon, so annual events surface sooner and long-lead prep always materializes before its offset date.
- Q: When a user deletes a single generated occurrence event that has prep tasks, what happens to the prep? → A: Cascade-clean. **Correction during planning**: `deleteEvent_` already removes *all* of an event's prep tasks (completed and outstanding alike) as existing, deliberate feature 005 behavior (its own FR-017) — it was not orphaning prep as this question assumed. Occurrence events go through the same `deleteEvent_`, so they already get full cascade-clean with no new code; this feature just confirms/tests that the existing behavior covers occurrences too.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A dated event recurs on its own without being re-entered (Priority: P1)

Max or Jaz defines a recurring event once — a title, how often it repeats, when the
cycle is anchored, what time of day it happens and for how long, and who owns it by
default — and from then on the household finds a fresh, dated event sitting on the
calendar whenever it comes due. Nobody has to remember to re-create "Mom's birthday" or
"quarterly air-filter swap" every cycle; each occurrence simply appears on the calendar
ahead of its date. Editing or completing one occurrence does nothing to the rule — the
next occurrence still shows up on schedule.

**Why this priority**: This is the entire point of the feature — the birthdays,
anniversaries, and annual checkups that today have no home and get re-created by hand.
Without automatic materialization there is no feature. It closes the gap left by feature
004, which only ever materializes Tasks.

**Independent Test**: Define a yearly rule anchored in the past, run the generator, and
confirm exactly the expected dated events appear on the calendar (title, owner, time,
and duration carried from the rule) and are linked back to the rule; that editing or
deleting one occurrence leaves the rule untouched; and that the next run produces the
next occurrence and no duplicate of the first.

**Acceptance Scenarios**:

1. **Given** a recurring-event rule with a cadence, an anchor date, a time and duration,
   a default owner, and a title, **When** the generator runs, **Then** a dated event
   exists for every occurrence that falls due within the lookahead window, each carrying
   the rule's title, owner, time-of-day, and duration and linked back to the rule.
2. **Given** the generator has already produced an occurrence's event, **When** the
   generator runs again (on schedule, re-run, or overlapping execution), **Then** no
   second event is created for that same occurrence — each occurrence is materialized at
   most once.
3. **Given** a generated occurrence event, **When** a user edits its title, time, notes,
   or owner, **Then** the rule is unchanged and future occurrences continue to be
   generated from the rule's original values.
4. **Given** an occurrence event is created by the generator, **When** it is created,
   **Then** an entry is appended to the household activity log recording the generation.
5. **Given** a rule with season bounds, **When** the generator runs, **Then** occurrences
   whose date falls outside the season window are not generated (parity with recurring
   chores).

---

### User Story 2 - Each occurrence brings its own prep checklist (Priority: P1)

When defining a recurring event, Max or Jaz can attach a prep-checklist template to the
rule — the same kind of template used for one-off events (feature 005). From then on,
every generated occurrence automatically gets its prep tasks, dated relative to the
occurrence. A birthday rule with a "buy gift / plan dinner" template means each year's
birthday event arrives with those two tasks already waiting, dated the right number of
days before the party. The household never re-enters the prep for a repeating occasion.

**Why this priority**: The prep is the reason many of these events matter — a birthday
you forget to buy a gift for is worse than no reminder at all. Attaching prep to the
rule (not to each hand-made event) is what makes recurring events genuinely reduce
mental load rather than just decorate the calendar. It reuses the existing prep
mechanics, so it is a natural, high-value pairing with Story 1.

**Independent Test**: Attach a prep template to a yearly rule, run the generators, and
confirm each generated occurrence event carries prep tasks matching the template, each
dated by its offset relative to that occurrence; confirm a second run creates no
duplicate prep; confirm completing or deleting one occurrence's prep does not affect
another occurrence's prep or the rule.

**Acceptance Scenarios**:

1. **Given** a recurring-event rule with a prep template attached, **When** an occurrence
   is generated, **Then** the occurrence event is associated with that template so its
   prep tasks are created, each dated by its offset relative to the occurrence's date.
2. **Given** an occurrence whose prep tasks already exist, **When** the generators run
   again, **Then** no duplicate prep tasks are created for that occurrence.
3. **Given** two occurrences of the same rule, **When** prep is generated for both,
   **Then** each occurrence's prep is independent — completing or deleting one
   occurrence's prep task has no effect on the other occurrence.
4. **Given** a rule with no prep template attached, **When** occurrences are generated,
   **Then** the events are created with no prep tasks and nothing errors.

---

### User Story 3 - Manage the recurring-event rules themselves (Priority: P1)

Max or Jaz can set up a new recurring event, adjust an existing one (change its title,
cadence, anchor, time, duration, default owner, season bounds, or attached prep
template), or retire one that is no longer needed — all through the same service
interface the rest of the app uses. The rules are data the household owns and edits, not
a fixed list baked into the app. Changes take effect from the next generation forward;
occurrences already on the calendar are left alone.

**Why this priority**: Materialization is worthless if the household cannot express what
recurs. Creating, editing, and retiring rules is the control surface for the whole
feature and is required for the P1 flows to be usable by real people rather than seeded
by hand.

**Independent Test**: Through the service interface, create a recurring-event rule, read
it back, edit each of its fields, and delete it — verifying each change persists and is
attributed in the activity log, and that edits and deletes affect only occurrences
generated after the change, independent of whether any occurrences have yet been
generated.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they create a recurring-event rule with a title,
   cadence, anchor date, time, duration, and default owner, **Then** the rule persists
   and is available to the generator on its next run.
2. **Given** an existing rule, **When** a user edits any of its fields, **Then** the
   change persists and the next generation reflects it, while occurrences already on the
   calendar are left as they are.
3. **Given** an existing rule, **When** a user deletes it, **Then** it stops producing
   new occurrences, and occurrence events already on the calendar remain as ordinary
   events (along with their prep tasks).
4. **Given** any create, edit, or delete of a rule, **When** it happens, **Then** it is
   recorded in the household activity log attributed to the acting person.

---

### Edge Cases

- **User deletes a generated occurrence event.** The generator must never resurrect it —
  a deleted occurrence is treated as handled and permanently suppressed, exactly as
  recurring chores handle a deleted task occurrence. Future occurrences are unaffected.
- **User deletes a generated occurrence event that has prep tasks.** All of the
  occurrence's prep tasks (completed and outstanding alike) are removed with it — the
  existing event-delete cascade (feature 005). Other occurrences' prep is untouched.
- **A rule with an all-day occurrence vs a timed one.** A rule with no time-of-day
  produces all-day occurrences (birthdays, anniversaries); a rule with a time-of-day and
  duration produces timed occurrences (annual checkup at 9:30 for 1 hour).
- **A monthly/quarterly/yearly rule anchored on the 29th–31st.** Occurrence dates clamp
  to the last valid day of shorter months (parity with the recurring-chore engine's
  month arithmetic) so no occurrence is skipped or lands on an invalid date.
- **A rule's anchor date is far in the past.** First generation catches up only within
  the lookahead window — it does not backfill years of missed occurrences onto the
  calendar.
- **A rule points at a prep template that no longer exists (was deleted).** Occurrences
  are still generated as plain events; no prep is created and nothing errors.
- **Editing a rule's time or title** does not rewrite occurrences already generated — the
  household edits the individual occurrence event if they want the old one changed.
- **Overlapping trigger executions** (two nightly runs racing) never double-create an
  occurrence or its prep.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the household define recurring-event rules, each with a
  title, a cadence, an anchor date, an occurrence timing (all-day by default, or an
  optional time-of-day + duration for timed occasions), and a default owner
  (max / jaz / both).
- **FR-002**: Recurring-event cadences MUST have full parity with the recurring-chore
  engine: weekly, biweekly, monthly, sixweekly, eightweekly, quarterly, and annually.
- **FR-003**: A recurring-event rule MUST support optional season bounds (whole-month
  start/end); occurrences whose date falls outside the season window MUST NOT be
  generated, and a rule without season bounds runs year-round — parity with recurring
  chores.
- **FR-004**: A scheduled generator MUST materialize each rule's occurrences that fall
  due within a dedicated, hand-tunable events lookahead window (a Settings value,
  default 60 days, independent of the recurring-chore horizon) into dated Events,
  carrying the rule's title, owner, and occurrence timing (all-day, or the rule's
  time-of-day + duration), and linking each occurrence back to its rule.
- **FR-005**: Occurrence generation MUST be idempotent: re-runs, catch-up runs, and
  overlapping executions MUST NOT create a second event for an occurrence already
  materialized.
- **FR-006**: The generator MUST NOT resurrect an occurrence event a user has deleted — a
  deleted occurrence is permanently suppressed while future occurrences continue on
  schedule.
- **FR-007**: Editing a rule MUST affect only occurrences generated after the edit;
  occurrence events already on the calendar are left unchanged.
- **FR-008**: Deleting a rule MUST stop new occurrences; occurrence events already on the
  calendar (and their prep tasks) remain as ordinary items.
- **FR-009**: A recurring-event rule MUST support attaching a prep-checklist template
  (the same templates used for one-off events, feature 005).
- **FR-010**: When a rule has a prep template attached, each generated occurrence MUST
  receive that template's prep tasks, dated by each step's offset relative to the
  occurrence's date, reusing the existing prep-generation mechanics.
- **FR-011**: Prep generation for occurrences MUST be idempotent and per-occurrence
  independent: no duplicate prep on re-runs, and completing/deleting one occurrence's
  prep MUST NOT affect another occurrence's prep or the rule.
- **FR-012**: A rule with no prep template attached MUST generate plain occurrence events
  with no prep and no error; a rule pointing at a deleted template MUST behave the same.
- **FR-013**: Every occurrence-event generation, and every rule create/edit/delete, MUST
  append an entry to the household activity log (timestamp, actor, action, target).
- **FR-014**: The system MUST expose create / read / edit / delete for recurring-event
  rules through the same service interface (JSON API) the rest of the app uses; the
  calendar and lists render only generated Events and their prep tasks, never the rules
  directly.
- **FR-015**: Field validation MUST reject unknown cadences, invalid owners, malformed
  dates/times, and out-of-range season months, consistent with existing recurring-chore
  and event validation.
- **FR-016**: Occurrence date arithmetic for monthly/quarterly/annually cadences MUST
  clamp to the last valid day of shorter months so no occurrence is skipped or lands on
  an invalid date (parity with the recurring-chore engine).
- **FR-017**: Deleting a generated occurrence event MUST cascade-clean its prep: all prep
  tasks belonging to that occurrence (completed and outstanding alike) are removed with
  it, reusing the existing event-delete cascade (feature 005). Other occurrences' prep is
  unaffected.
- **FR-018**: An occurrence MUST be an all-day event when its rule specifies no
  time-of-day, and a timed event (with the rule's derived start/end) when the rule
  specifies a time-of-day and duration.

### Key Entities *(include if feature involves data)*

- **Recurring-event rule**: The household's definition of an event that repeats. Carries
  a title, cadence, anchor date, occurrence timing (all-day, or an optional time-of-day +
  duration), default owner, optional season bounds, an optional attached prep template,
  and a marker of how far it has been generated. Distinct from a recurring-chore rule in
  that it materializes Events rather than Tasks. Never rendered directly in the UI.
- **Generated occurrence event**: An ordinary Event created by the generator, linked back
  to its rule, carrying the rule's title/owner and timing (all-day, or the rule's
  time-of-day + duration) and (if the rule had a template) associated with that prep
  template so its prep tasks are created. Once created it is an independent event —
  editable, completable, and deletable like any other, with no write-back to the rule.
- **Attached prep template**: An existing event prep-checklist template (feature 005)
  referenced by a recurring-event rule so every occurrence inherits its steps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A household member can define a recurring event (e.g. a birthday with a
  gift-buying prep checklist) once and never re-enter it — every future occurrence and
  its prep appear automatically, with zero manual re-creation across cycles.
- **SC-002**: Running the generator any number of times over the same window produces
  exactly one event per due occurrence and exactly one set of prep tasks per occurrence —
  no duplicates, regardless of re-runs or overlapping executions.
- **SC-003**: 100% of a rule's due occurrences within the lookahead window appear on the
  calendar with the correct title, owner, date, time, and duration; 0% of occurrences
  outside the season window appear.
- **SC-004**: Deleting a single occurrence event removes exactly that occurrence (and its
  outstanding prep) and never causes it to reappear on a later generation, while every
  other occurrence of the same rule is unaffected.
- **SC-005**: Editing or deleting a rule changes only occurrences generated afterward;
  100% of occurrences already on the calendar are left untouched.

## Assumptions

- **Recurring-event rules are a distinct rule type from recurring-chore rules.** Feature
  004's rules materialize Tasks and stay as they are; this feature adds rules that
  materialize Events. The two engines run on their own schedules and do not interfere.
- **Occurrence timing is all-day by default** (date only, no time — the natural shape for
  birthdays and anniversaries), with an optional time-of-day + duration on the rule from
  which a timed occurrence's start and end are derived. This feature adds all-day support
  for recurring-event occurrences, superseding the separately-parked all-day-toggle fix
  for this case.
- **The lookahead window is a dedicated, hand-tunable events horizon** (a Settings value,
  default 60 days), independent of the 30-day recurring-chore horizon, so annual events
  surface sooner and a long-lead prep step materializes before its offset date.
- **Prep generation reuses feature 005 unchanged** — the recurring-event generator's job
  is to create each occurrence event already associated with the rule's template; the
  existing prep engine then materializes the prep tasks. No new prep mechanics are built.
- **The generator's schedule mirrors the recurring-chore generator** (a nightly
  time-driven run within the 6-minute execution budget), staggered so the two nightly
  jobs do not contend.
- **Outbound Google Calendar sync (feature 007) applies to generated occurrence events**
  the same way it applies to any other event — no special handling is added here beyond
  producing ordinary Events.
- **Two users forever** — no roles, tenancy, or scale concepts are introduced.
