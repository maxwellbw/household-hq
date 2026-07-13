# Feature Specification: Household Seed Data + Supporting Engine Extensions

**Feature Branch**: `027-household-seed-data`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Household seed-data pack plus supporting engine extensions. Load real starting data (shopping lists, birthdays, anniversaries, maintenance/yard/holiday tasks, prep templates) into the app idempotently, mirroring seedRecurringPack(), and add the small engine capabilities that data requires. Full source of truth: docs/seed-data.md."

## Overview

Max and Jaz's Household HQ is fully built but empty — every calendar, list, and dashboard
starts blank, so the app can't yet replace the paper lists and mental reminders it's meant
to. This feature loads their **real** starting data in one re-runnable pass and adds the
three small engine capabilities that data needs to be expressed faithfully.

The complete, confirmed dataset lives in `docs/seed-data.md` (the source of truth). This
spec describes the behavior of loading it and the capabilities it depends on; it does not
re-transcribe every row.

## Clarifications

### Session 2026-07-12

- Q: How should the anniversary "N years" count read? → A: Ordinal "Nth anniversary"
  style — "6th dating anniversary", "4th engagement anniversary", "1st wedding anniversary";
  gotcha days render possessively as "Rufus's 4th gotcha day" / "Cleo's 6th gotcha day".
  Ordinal N = (occurrence year − anchor year); proper ordinal suffixes (1st/2nd/3rd/4th…).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shopping lists appear stocked with real items (Priority: P1)

Max or Jaz opens the Lists screen and finds their two real lists — **Groceries** and **Not
grocery** — already populated with their actual items, each filed in the right section, with
staples flagged and the right things showing as "need" vs "stocked". The dashboard's
time-to-shop nudge reflects the staples currently needed.

**Why this priority**: Lists are the highest-frequency surface (checked multiple times a
day) and the most immediately useful once seeded — it turns the app into the thing they
reach for at the store on day one, with zero manual entry.

**Independent Test**: Run the seed with empty `Lists`/`ListItems` tabs; confirm the two
lists and every item from `docs/seed-data.md §1` appear with correct section, staple flag,
and need/stocked status, and the needed view reads in section order.

**Acceptance Scenarios**:

1. **Given** empty list tabs, **When** the seed runs, **Then** two lists ("Groceries",
   "Not grocery") exist and every item from §1 is present with its section, staple flag,
   and initial status.
2. **Given** the seed has already run, **When** it runs again, **Then** no duplicate lists
   or items are created and nothing already hand-edited is overwritten.
3. **Given** a household member has deleted a seeded item, **When** the seed runs again,
   **Then** the deleted item is **not** resurrected.

---

### User Story 2 - Birthdays, anniversaries, and prep appear on the calendar (Priority: P1)

The calendar and dashboard show the household's real recurring milestones — eight birthdays
and five anniversaries — each recurring yearly. Anniversaries display a live "N years"
count that increments every year. Each birthday automatically spawns its prep task (buy
gift / make reservations / text the group chat) at the right lead time, owned by the right
person.

**Why this priority**: These are the events the household currently forgets and re-creates
by hand every year; seeding them with working prep automation is the core "never forget a
birthday again" value.

**Independent Test**: Run the seed; confirm each birthday/anniversary from §2–§3 exists as a
yearly recurring event, anniversaries render with the correct year count for the current
year, and materialized birthday occurrences generate the specified prep task with correct
owner and lead time.

**Acceptance Scenarios**:

1. **Given** empty recurring-event tabs, **When** the seed runs, **Then** all eight
   birthdays and five anniversaries from §2–§3 exist as yearly recurring events with the
   correct anchor dates.
2. **Given** a seeded anniversary with anchor year 2020, **When** its occurrence for the
   current year is viewed, **Then** its title shows the ordinal count of years since 2020
   (e.g. "6th dating anniversary") and that ordinal is one higher next year.
3. **Given** a seeded birthday with a "buy gift — 2 weeks before" prep, **When** the
   occurrence materializes, **Then** a prep task is created 14 days before, owned by the
   designated gift-buyer.
4. **Given** Engaged and Married both anchored to May 5, **When** May 5 is viewed, **Then**
   both anniversaries appear that day.
5. **Given** the seed has already run, **When** it runs again, **Then** no duplicate rules
   or templates are created and hand-edits/deletions are preserved.

---

### User Story 3 - Recurring chores, yard, holiday & vet reminders are loaded (Priority: P2)

The household's recurring maintenance is scheduled without anyone setting it up: six-month
appliance/deep cleans staggered so they never bunch in one month (dishwasher owned by Max,
washing machine by Jaz, the rest shared); seasonal yard tasks (leaf cleanup, dirt-raking,
tree/shrub trims); holiday tasks (start shopping Nov 1, put up Christmas lights the weekend
before Thanksgiving); and an annual October reminder for Max to call and schedule the vet
visit + vaccines.

**Why this priority**: High household value but lower urgency than lists and milestones —
several of these depend on the new cadence and computed-anchor capabilities (US4).

**Independent Test**: Run the seed; confirm each task from §4–§7 exists with the correct
cadence, anchor/season, and owner; confirm the six-month cleans land in six distinct months.

**Acceptance Scenarios**:

1. **Given** empty recurring tabs, **When** the seed runs, **Then** each maintenance/yard/
   holiday/vet task from §4–§7 exists with its specified cadence, anchor or season window,
   and owner.
2. **Given** the six six-month cleans, **When** their first occurrences are computed,
   **Then** no two fall in the same calendar month.
3. **Given** the Christmas-lights rule, **When** occurrences are generated across multiple
   years, **Then** each lands on the Saturday before that year's Thanksgiving (not a drifting
   fixed date).
4. **Given** the leaf-cleanup rule (biweekly, season Oct–Dec), **When** occurrences are
   generated in July, **Then** none are created; in November, they are.

---

### User Story 4 - Prep templates ready to attach to one-off events (Priority: P2)

When Max or Jaz creates a one-off event for guests arriving or leaving for a trip, they can
attach the matching prep template and have the checklist auto-generate — fresh sheets and a
clean guest bath before guests come; pet supplies, plant-watering, trash, and a key under
the mat before a trip — each task owned by the right person and timed relative to the date.

**Why this priority**: Reuses the existing prep-template mechanism; valuable but only fires
when a qualifying one-off event is created, so lower frequency than the always-on items.

**Independent Test**: Run the seed; confirm both templates from §8 exist with their tasks,
lead times, and owners; create a one-off event of each type and confirm the prep tasks
generate as specified.

**Acceptance Scenarios**:

1. **Given** empty template rows for these types, **When** the seed runs, **Then** the
   "Guests arrive" and "Leaving for a trip" templates exist with every task, offset, and
   owner from §8.
2. **Given** the "Leaving for a trip" template, **When** an event of that type is created,
   **Then** each prep task generates at its offset (e.g. "Water plants" 1 day before, owned
   by Jaz; "Key under mat for dog sitter" day-of, owned by both).

---

### User Story 5 - Finding an item on a long list quickly (Priority: P3)

With the lists now holding dozens of items, Max or Jaz can type into a search box on the
Lists screen to filter the visible items by name, find the one they want, and flip it
need⇄stocked in a tap — without scrolling the whole list.

**Why this priority**: A usability enhancement that only becomes necessary once the lists
are long (i.e., after seeding); independent of the seed itself.

**Independent Test**: On a populated list, type part of an item name; confirm the view
narrows to matching items in real time and the need⇄stocked toggle still works on a filtered
result.

**Acceptance Scenarios**:

1. **Given** a list with many items, **When** the user types text into the search box,
   **Then** only items whose name contains that text (case-insensitive) remain visible.
2. **Given** a filtered list, **When** the user toggles a shown item, **Then** its status
   flips and the filter still applies.
3. **Given** a search with no matches, **When** the view updates, **Then** an empty-result
   state is shown rather than a blank screen.
4. **Given** text in the search box, **When** the user clears it, **Then** the full list
   returns.

---

### Edge Cases

- **Partial prior seed**: some seed items already applied (present or in the ledger), others
  not — the run must add only the missing ones and touch nothing else.
- **Hand-renamed seed row**: a seeded item/rule the household renamed must not be duplicated
  on re-run (identity is a stable seed key, never the title).
- **Anchor in the past on first run**: yearly milestones whose date already passed this year
  should schedule the next future occurrence, not backfill past ones.
- **"N years" count for a future-anchored anniversary** (e.g. Married 2025 viewed before its
  anchor year): the count must never render negative — the earliest displayed occurrence is
  the anchor year itself (count 0), per §3 rule.
- **Thanksgiving computation across a year boundary**: generating late-year windows must pick
  the correct year's Thanksgiving.
- **Search matching**: leading/trailing whitespace and case differences must not hide an
  otherwise-matching item.

## Requirements *(mandatory)*

### Functional Requirements

**Seeding — general**

- **FR-001**: The system MUST provide a re-runnable seeding operation that loads the dataset
  defined in `docs/seed-data.md` into the appropriate tabs.
- **FR-002**: Seeding MUST be idempotent — a second run creates no duplicates and makes no
  writes for already-applied items (mirrors the existing recurring seed pack's behavior).
- **FR-003**: Each seeded item MUST carry a stable seed key; "already applied" is determined
  by that key (present as a live row **or** recorded in an applied ledger), never by title,
  so hand-edits and renames are preserved.
- **FR-004**: A seeded item that the household later deletes MUST NOT be resurrected on a
  subsequent run (the ledger makes deletion permanent).
- **FR-005**: Seeding MUST append the appropriate activity-log entries for the rows it
  creates and MUST log nothing on a no-op run.

**Shopping lists (§1)**

- **FR-006**: Seeding MUST create the "Groceries" and "Not grocery" lists and their items
  with the section, staple flag, and initial need/stocked status specified in §1.

**Birthdays & anniversaries (§2–§3)**

- **FR-007**: Seeding MUST create each birthday and anniversary as a yearly recurring event
  with the anchor date specified in §2–§3.
- **FR-008**: Each birthday MUST have an associated prep task definition with the exact
  title, lead time, and owner specified in §2, generated automatically on each occurrence.
- **FR-009**: Anniversary occurrences MUST display a live ordinal count of years elapsed
  since the anchor year, computed per occurrence (so it increments yearly without editing the
  rule and never drifts), rendered in the ordinal "Nth anniversary" style per the
  Clarifications (e.g. "6th dating anniversary"; gotcha days as "Rufus's Nth gotcha day").

**Maintenance, yard, holiday, vet (§4–§7)**

- **FR-010**: Seeding MUST create each recurring task in §4–§7 with its specified cadence,
  anchor or season window, and owner.
- **FR-011**: The six six-month cleaning tasks MUST be anchored so that no two share a
  calendar month.
- **FR-012**: The Christmas-lights task MUST recur on the weekend before Thanksgiving each
  year (computed), not on a fixed calendar date that drifts.

**Prep templates (§8)**

- **FR-013**: Seeding MUST create the "Guests arrive" and "Leaving for a trip" prep templates
  with every task, offset, and owner specified in §8, usable by the existing event
  prep-template mechanism.

**Engine extensions (§9)**

- **FR-014**: The system MUST support an every-six-months recurrence cadence, available to
  both recurring tasks and recurring events and selectable wherever cadences are chosen in
  the UI (parity with the existing cadences).
- **FR-015**: The system MUST support marking a recurring event so its occurrences show the
  elapsed-years count (backing FR-009).
- **FR-016**: The system MUST support a "weekend before Thanksgiving" recurrence for the
  Christmas-lights task that resolves to the correct date each year (backing FR-012).

**List search (US5)**

- **FR-017**: The Lists screen MUST let the user filter the visible items of a list by a text
  query matching item names case-insensitively, updating as they type.
- **FR-018**: Toggling need⇄stocked MUST continue to work on a filtered result, and clearing
  the query MUST restore the full list; a query with no matches MUST show an empty-result
  state.

### Key Entities *(include if feature involves data)*

- **List / List item**: A named shopping list and its items (name, section, staple flag,
  need/stocked status). Seeded per §1.
- **Recurring event**: A yearly milestone (birthday, anniversary) with an anchor date and
  optional prep template; anniversaries additionally carry the "show elapsed years" marker.
- **Recurring task**: A maintenance/yard/holiday/vet chore with a cadence (including the new
  six-month one), optional season window, computed-anchor option, and an owner.
- **Prep template**: A named set of prep-task definitions (title, offset relative to the
  event date, owner) attachable to a one-off event by type.
- **Seed key / applied ledger**: The identity + record that make seeding idempotent and
  deletions permanent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After one seed run against empty data, 100% of the rows defined in
  `docs/seed-data.md §1–§8` are present and correct (right list/section/status, right
  cadence/anchor/owner, right prep tasks).
- **SC-002**: Running the seed a second time creates zero new rows and writes zero changes to
  existing rows.
- **SC-003**: A seeded item deleted by the household stays gone across at least one further
  seed run.
- **SC-004**: Every anniversary shows an ordinal equal to (current year − anchor year) in the
  "Nth anniversary" style, and that value is exactly one higher the following year, with no
  manual edit.
- **SC-005**: The six six-month cleaning tasks occupy six distinct calendar months in their
  first-occurrence schedule.
- **SC-006**: The Christmas-lights task's generated date is the Saturday before Thanksgiving
  for every year checked across a multi-year span.
- **SC-007**: On a list of 30+ items, a user can locate any item by typing part of its name
  and flip its status without scrolling the full list.

## Assumptions

- The confirmed dataset in `docs/seed-data.md` is authoritative; where this spec and the doc
  differ, the doc's data wins and the spec is corrected.
- Seeding is run the same way as the existing recurring seed pack (a manually-invoked
  operation from the script editor), not exposed as a user-facing API action or button.
- The existing recurring seed pack, its seed-key + applied-ledger mechanism, and the existing
  prep-template/occurrence machinery are reused rather than reinvented.
- "From now" anchors for the six-month cleans are computed relative to the seed run date, so
  the staggering (distinct months) holds regardless of when the seed is run.
- The elapsed-years count for an anniversary uses the anchor's year as the baseline; the
  earliest surfaced occurrence never yields a negative count.
- Owner resolution follows the existing model — Max, Jaz, or both — with no new roles.
- The list-search box is a client-side filter over already-loaded items; it introduces no new
  data or server behavior.

## Out of Scope

- One-off upcoming events (trips, weddings, appointments) — the household will add these by
  hand later (`docs/seed-data.md §10`).
- Recurring bills/renewals reminders — deferred.
- Pet birthdays (Rufus, Cleo) — not tracked for now (gotcha days are covered as anniversaries).
- Any new authentication, roles, tenancy, or multi-household concepts.
