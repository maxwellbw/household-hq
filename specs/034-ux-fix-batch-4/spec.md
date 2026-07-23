# Feature Specification: UX Fix Batch 4

**Feature Branch**: `034-ux-fix-batch-4`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Feature 034 — UX fix batch 4. Five independent user-facing fixes: (1) allow booking a dog walk over a conflict; (2) fix confusing someday-task scheduling; (3) show staple-needed count on the dashboard nudge; (4) show a last-stocked date on list items; (5) All-view sort/group/order controls."

## Clarifications

### Session 2026-07-22

- Q: How do the All-view alphabetical-sort and group-by-section toggles relate, and what is the default order? → A: Independent (either, both, or neither); default (neither on) is the items' natural/insertion order from the sheet.
- Q: When group-by-section is on, how does the "unchecked sinks to bottom" rule compose with it? → A: Globally — all stocked (checked) items form a top block and all still-needed (unchecked) items form a bottom block; each block is grouped by section when grouping is on.

## User Scenarios & Testing *(mandatory)*

This is a batch of five small, independent fixes. Each user story stands alone: implementing any one delivers value without the others.

### User Story 1 - Book a dog walk over a conflict (Priority: P1)

Max opens the dog-walk planner for a day, picks (or adjusts) a walk window that overlaps a busy calendar block or falls in an hour that fails a weather gate. Today the planner shows a warning ("conflicts with…") but the Book / Book backup actions are disabled, leaving no way forward. Max needs to knowingly book that window anyway — sometimes a walk *should* happen despite a soft conflict or marginal weather.

**Why this priority**: This is a live bug that fully blocks a real task the user hit — there is currently no workaround. It is the reason this batch was raised.

**Independent Test**: Open the planner on a day where every candidate is busy or gate-failing, select such a window, and confirm the walk can be booked after acknowledging a clear warning.

**Acceptance Scenarios**:

1. **Given** a selected walk window that overlaps a busy calendar block, **When** Max chooses to book it, **Then** a warning names what it conflicts with (owner and, if known, the event title) and offers an explicit confirm to book anyway.
2. **Given** a selected walk window whose hour fails one or more weather gates, **When** Max chooses to book it, **Then** a warning names the failing gate(s) and offers an explicit confirm to book anyway.
3. **Given** Max confirms "book anyway", **When** the booking succeeds, **Then** the walk appears as booked for that day and the warning clears.
4. **Given** a selected window that both conflicts and fails a gate, **When** Max chooses to book, **Then** the warning names both reasons before the confirm.
5. **Given** a window that lies outside the day's walk-eligible hours, **When** Max tries to select or book it, **Then** it remains un-bookable (this is the only case that stays blocked).

---

### User Story 2 - Schedule a someday task without friction (Priority: P2)

Max is on the Tasks tab looking at a "someday" (undated) task and wants to give it a date and owner so it lands on the calendar. Today this flow feels confusing and awkward. Max should be able to schedule the task in a way that is quick, obvious, and hard to get wrong.

**Why this priority**: A frustrating flow on a core, frequently-used action; not blocking, but a persistent friction point.

**Independent Test**: From the Tasks tab, take a someday task through scheduling to a dated task and confirm each step reads clearly, with no dead ends or ambiguous controls. (Specific pain points to be pinned down by a browser walkthrough during planning.)

**Acceptance Scenarios**:

1. **Given** a someday task in the Tasks list, **When** Max initiates scheduling, **Then** the path to add a date and owner is obvious and reachable without guesswork.
2. **Given** the scheduling controls are open, **When** Max provides a date and owner, **Then** it is clear what is required, what is optional, and when the task is ready to confirm.
3. **Given** Max confirms, **When** scheduling completes, **Then** the task becomes a dated task and the change is visibly reflected without confusion about what happened.
4. **Given** Max opens scheduling by mistake, **When** they back out, **Then** dismissing is obvious and leaves the task unchanged.

---

### User Story 3 - See when a list item was last stocked (Priority: P3)

When reviewing the full list of items (All view), Max or Jaz wants to know when each item was last marked stocked — a cue for how fresh the "stocked" status is and whether it might be running low again.

**Why this priority**: Useful context for shopping decisions; additive, not blocking.

**Independent Test**: Mark an item stocked, then view it in the All view and confirm a last-stocked date is shown; an item never stocked shows no date.

**Acceptance Scenarios**:

1. **Given** a list item that has been marked stocked at least once, **When** it appears in the All view, **Then** its row shows the date it was last marked stocked in a readable form (e.g. "stocked Jul 20").
2. **Given** an item that has never been marked stocked, **When** it appears in the All view, **Then** no last-stocked date is shown for it.
3. **Given** an item marked stocked, then later marked needed, then marked stocked again, **When** it appears in the All view, **Then** the shown date is the most recent time it was marked stocked.

---

### User Story 4 - Sort, group, and order the All view (Priority: P3)

When managing a list in the All view, Max or Jaz wants control over how items are arranged: an alphabetical sort toggle, a group-by-store-section toggle, and — regardless of those — still-needed (unchecked) items ordered to the bottom, with stocked (checked) items above them.

**Why this priority**: Makes the management view easier to scan and maintain; additive quality-of-life.

**Independent Test**: In the All view, toggle alphabetical sort and section grouping and confirm the arrangement changes accordingly, with unchecked items consistently ordered below checked items.

**Acceptance Scenarios**:

1. **Given** the All view, **When** Max enables alphabetical sort, **Then** items are ordered by name.
2. **Given** the All view, **When** Max enables group-by-section, **Then** items are grouped under their store-section headings.
3. **Given** any All-view arrangement, **When** items are displayed, **Then** stocked (checked) items appear above still-needed (unchecked) items — the unchecked items sink to the bottom.
4. **Given** both toggles and the ordering rule interact, **When** the view renders, **Then** the result is deterministic and stable (the same items always arrange the same way).

---

### User Story 5 - See how many staples are needed on the dashboard (Priority: P3)

On the Home dashboard, when the "Running low on staples" nudge appears, Max wants it to say how many staple items are currently needed, so the prompt carries a sense of scale rather than a vague "might be time to shop."

**Why this priority**: A one-line clarity improvement to an existing nudge; smallest of the batch.

**Independent Test**: With several staple items marked needed across lists, confirm the dashboard nudge states that count.

**Acceptance Scenarios**:

1. **Given** the staples nudge is showing, **When** Max reads it, **Then** it states the number of staple items marked needed across all lists (e.g. "Running low on staples — 5 needed").
2. **Given** the number of needed staples changes, **When** the dashboard reflects the latest data, **Then** the count shown matches the current number of needed staples.

---

### Edge Cases

- **US1**: A window that conflicts with *both* users' busy blocks — the warning should still convey a conflict exists (naming at least the conflicting owners) without becoming unreadable.
- **US1**: The forecast is unavailable/too old to book against — booking-anyway should still be possible with an appropriate warning, since the user is explicitly overriding.
- **US3**: An item's stocked date and its current status can disagree (stocked long ago but currently needed again) — the date reflects the last time it was stocked, independent of current status.
- **US4**: An unsectioned item under group-by-section — it groups under the existing "Other" section.
- **US5**: Zero staples needed but the nudge threshold otherwise met — the nudge only appears when the staple-needed count reaches the household's configured threshold, so the count shown is always at least that threshold.
- **All items date handling**: dates display in the single household timezone.

## Requirements *(mandatory)*

### Functional Requirements

**Dog-walk conflict override (US1)**
- **FR-001**: The planner MUST allow the user to book a selected walk window that overlaps a busy calendar block, after showing a warning and requiring an explicit confirmation.
- **FR-002**: The planner MUST allow the user to book a selected walk window whose hour(s) fail one or more weather gates, after showing a warning and requiring an explicit confirmation.
- **FR-003**: The override warning MUST name the reason(s): for conflicts, the busy owner(s) and event title when known; for weather, the specific failing gate name(s).
- **FR-004**: The override MUST apply to both the primary and the backup (second) walk actions.
- **FR-005**: A window that lies outside the day's walk-eligible hours MUST remain un-bookable (no override offered).
- **FR-006**: On a successful override booking, the walk MUST appear as booked for the day and the warning MUST clear.

**Someday-task scheduling (US2)**
- **FR-007**: From the Tasks tab, the user MUST be able to schedule a someday task with a clear, discoverable path to set a date and owner.
- **FR-008**: The scheduling flow MUST make it unambiguous what is required to confirm, and MUST prevent confirming an incomplete schedule.
- **FR-009**: On confirmation, the task MUST become a dated task and the outcome MUST be visibly reflected to the user.
- **FR-010**: The user MUST be able to dismiss/cancel the scheduling flow without changing the task.
- **FR-011**: The specific interaction refinements MUST be derived from a browser walkthrough of the current flow during planning and captured in the plan before implementation.

**Last-stocked date (US3)**
- **FR-012**: The system MUST record the date/time an item was last marked stocked.
- **FR-013**: Recording the last-stocked date MUST be idempotent and safe to re-run, and MUST append to the activity log per the household's change-tracking convention.
- **FR-014**: The All view MUST display an item's last-stocked date in a readable form; items never stocked MUST show no date.
- **FR-015**: When an item is marked stocked again after being needed, the recorded date MUST update to the most recent stocking.
- **FR-016**: The stored data MUST remain human-readable and hand-editable in the underlying sheet without breaking the app.

**All-view arrangement (US4)**
- **FR-017**: The All view MUST offer a toggle to sort items alphabetically by name. The two toggles (FR-017, FR-018) MUST be independent — either, both, or neither may be active — and when neither is active, items MUST appear in their natural/insertion order from the underlying data.
- **FR-018**: The All view MUST offer a toggle to group items by store section (reusing the existing section set and display order; unsectioned items group under "Other").
- **FR-019**: In the All view, stocked (checked) items MUST form a top block and still-needed (unchecked) items MUST form a bottom block — the unchecked items sink below all checked items globally, regardless of the sort/group toggles. When group-by-section is active, each of the two blocks MUST be grouped by section internally.
- **FR-020**: The arrangement MUST be deterministic and stable for a given set of items and toggle states.

**Staples count (US5)**
- **FR-021**: The dashboard staples nudge MUST state the count of staple items marked needed across all lists.
- **FR-022**: The count MUST reflect the current data whenever the dashboard updates.

**Cross-cutting**
- **FR-023**: All dates MUST be handled and displayed in the single household timezone.
- **FR-024**: Each fix MUST be independently shippable and MUST NOT regress the other four areas.

### Key Entities *(include if feature involves data)*

- **List Item**: an entry on a household list. Gains a "last stocked" attribute — the most recent date/time it was marked stocked (empty if never stocked). Existing attributes (name, status need/stocked, section, staple flag, note) are unchanged.
- **Dog Walk booking**: an existing entity; this feature changes only the conditions under which a booking may be created (permitting an explicitly-confirmed override), not its shape.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On any day, the user can book a walk in a conflicting or gate-failing window in at most two steps (choose to book → confirm the warning), with zero cases where a within-eligible-hours window is unbookable.
- **SC-002**: Scheduling a someday task from the Tasks tab can be completed without hesitation or backtracking in a first-run walkthrough — no dead ends, every control's purpose clear.
- **SC-003**: In the All view, an item marked stocked shows its stocking date, and never-stocked items show none — verifiable at a glance.
- **SC-004**: In the All view, unchecked items always appear below checked items, and toggling alphabetical sort or section grouping visibly rearranges items as expected.
- **SC-005**: The dashboard staples nudge always shows a count matching the current number of needed staples.
- **SC-006**: All five fixes ship without regressions to existing planner, tasks, lists, or dashboard behavior (existing tests continue to pass; new behavior covered by tests).

## Assumptions

- The dog-walk backend already supports an explicit override path for booking a conflicting/gate-failing window; US1 is primarily about making that path reachable from the interface. (To be confirmed in planning.)
- "Last stocked" is captured going forward from when this feature ships; existing items have no historical stocking date until next stocked.
- The staples nudge's appearance rule (threshold on needed staples across lists) is unchanged; only its wording gains the count.
- The All-view ordering rule ("unchecked at the bottom") is deliberate and confirmed by the user, and is the inverse of a conventional shopping checklist.
- Store sections and their display order already exist and are reused for the group-by-section toggle.
- These changes are scoped to the two-user household model; no roles, tenancy, or scale concepts are introduced.
