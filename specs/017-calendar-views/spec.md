# Feature Specification: Calendar views & 7-day surfaces

**Feature Branch**: `017-calendar-views`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Calendar views & 7-day surfaces. The calendar view dropdown gets BOTH a fixed Sun–Sat week view and a rolling next-7-days view. Week starts Sunday everywhere. Month prev/next navigation arrows must be visible on mobile plus month scrolling. De-clutter the desktop month-grid stacking with compact chips and a '+N more' overflow. Event chips show prep-task progress (e.g. '3/7 tasks'). Overdue is display-only: an overdue open task keeps its real dueDate in the Sheet but renders on today with an overdue badge — no nightly date rewriting, no gcal re-sync churn (the dashboard already has an Overdue smart view). Plus the dashboard gets a rolling 7-day strip: seven compact day tiles (today first) with owner-colored dots/counts; tapping a day navigates to the calendar on that date."

## Clarifications

### Session 2026-07-11

- Q: How should an overdue open task be surfaced in the calendar? → A: On **today only** — it renders on today's cell with an overdue badge and does not also appear on its original past date. Today is the single place outstanding work lives.
- Q: How should the new fixed-week and next-7-days views render each day (given household items are mostly all-day)? → A: **Day-list / agenda columns** — each of the seven days is an all-day list of chips (no hourly time-grid), reusing existing chip styling.
- Q: Should the two new week views be available on mobile (currently agenda-only, no view dropdown)? → A: **Yes** — add a compact view switcher on mobile so phones can also select Week / Next-7-days, in addition to desktop.
- Q: When a desktop month-grid day overflows, what should activating "+N more" do? → A: **Jump to that day's view** — navigate the calendar to a focused single-day/agenda view for that date (rather than an in-place popover).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Week views in the calendar dropdown (Priority: P1)

Max or Jaz opens the calendar and wants to see just the days that matter right now rather than a whole month. From the view selector they can pick a **fixed week** (the current calendar week, Sunday through Saturday) or a **rolling next-7-days** view (today plus the following six days). Both surface each day's events and dated tasks in the same owner-colored style used elsewhere.

**Why this priority**: This is the headline capability of the feature — two new focused time-horizons that the app doesn't offer today. It delivers standalone value the moment it ships, independent of every other story here.

**Independent Test**: Select "Week" from the view dropdown and confirm exactly Sunday–Saturday of the current week is shown; select "Next 7 days" and confirm today is the first day and six subsequent days follow; confirm each day's items appear with correct owner colors.

**Acceptance Scenarios**:

1. **Given** the calendar is open, **When** the user selects the fixed Week view, **Then** the seven columns/rows shown are Sunday through Saturday of the week containing the currently focused date, with Sunday first.
2. **Given** the calendar is open on any weekday, **When** the user selects the Next-7-days view, **Then** the first day shown is today and the view spans today through six days later.
3. **Given** a Week or Next-7-days view is active, **When** events and dated tasks exist on those days, **Then** they render with the same owner color coding (Max / Jaz / Both) used in the month view.
4. **Given** the user is in a week view, **When** they use the previous/next navigation, **Then** the fixed Week view moves a full calendar week at a time and the Next-7-days view shifts its window while keeping a rolling 7-day span.

---

### User Story 2 - Sunday-start week everywhere (Priority: P1)

Wherever a week is represented in the app — the calendar's week views, the month grid's column headers, and any weekday computation — the week begins on Sunday, matching the household's mental model.

**Why this priority**: A consistent week-start is foundational; the week views (US1) and the dashboard strip (US6) both depend on it, and a mismatch (some surfaces Monday-first, others Sunday-first) would read as a bug.

**Independent Test**: Inspect the month grid's leftmost weekday column and every week-oriented surface and confirm each starts on Sunday.

**Acceptance Scenarios**:

1. **Given** the month view, **When** it renders, **Then** the leftmost weekday column is Sunday and the rightmost is Saturday.
2. **Given** the fixed Week view, **When** it renders, **Then** the first day is Sunday.
3. **Given** any "this week" grouping the app computes, **When** it determines the week boundaries, **Then** the week runs Sunday 00:00 through Saturday end-of-day.

---

### User Story 3 - Month navigation on mobile (Priority: P2)

On a phone, Max or Jaz can move between months. Previous/next month controls are visible and tappable, and the month's content scrolls so that no days are cut off or unreachable on a small screen.

**Why this priority**: Today mobile users can land on the month view but cannot reliably change months or see all weeks — a navigation dead-end. High-value fix, but the app is still usable (via other views) without it, so P2.

**Independent Test**: On a mobile-width screen, confirm previous/next month controls are visible without horizontal scrolling and that tapping them changes the displayed month; confirm every week row of a tall month is reachable by scrolling.

**Acceptance Scenarios**:

1. **Given** the month view on a mobile-width screen, **When** it renders, **Then** previous-month and next-month controls are visible on screen.
2. **Given** the mobile month view, **When** the user taps the next-month control, **Then** the following month is displayed; likewise for previous-month.
3. **Given** a month that occupies more vertical space than the screen height, **When** the user scrolls, **Then** all weeks and days of that month are reachable.

---

### User Story 4 - De-cluttered desktop month grid (Priority: P2)

On desktop, a busy day in the month grid no longer overflows or stretches its cell. Items render as compact chips, and when a day has more items than fit, the extras collapse into a "+N more" affordance that reveals the full day when activated.

**Why this priority**: Improves readability of the primary organizing view when days are dense, but the app is functional (if cluttered) without it.

**Independent Test**: Populate a single day with more items than comfortably fit in a month cell and confirm the cell shows a bounded number of compact chips plus a "+N more" indicator that, when activated, reveals that day's full item list.

**Acceptance Scenarios**:

1. **Given** a day in the desktop month grid with more items than the cell can show, **When** it renders, **Then** a bounded number of compact chips is shown and the remaining count appears as a "+N more" affordance.
2. **Given** a "+N more" affordance, **When** the user activates it, **Then** the full set of that day's items becomes viewable.
3. **Given** a day with few items, **When** it renders, **Then** all items show as compact chips with no "+N more" affordance.

---

### User Story 5 - Prep-task progress on event chips (Priority: P3)

When an event has a prep checklist, its calendar chip shows how much of that checklist is done, e.g. "3/7 tasks", so either person can see at a glance whether an upcoming event is ready without opening it.

**Why this priority**: A nice at-a-glance signal that builds on existing event/prep-task data; valuable but not blocking, so P3.

**Independent Test**: Create an event with a prep checklist, complete some of its tasks, and confirm the event's calendar chip shows the completed/total count reflecting the current state.

**Acceptance Scenarios**:

1. **Given** an event with N prep tasks of which M are complete, **When** its calendar chip renders, **Then** the chip shows an "M/N tasks" progress indicator.
2. **Given** an event with a prep checklist, **When** a prep task is completed, **Then** the chip's progress indicator reflects the new count.
3. **Given** an event with no prep tasks, **When** its chip renders, **Then** no task-progress indicator is shown.

---

### User Story 6 - Overdue tasks surface on today (Priority: P2)

An open task whose due date has passed is not silently buried on a day the user has scrolled past. Without changing the task's stored due date, the calendar displays it on **today** carrying an "overdue" badge, so it stays in view until done. Completing or rescheduling it removes the overdue treatment.

**Why this priority**: Overdue tasks vanishing from view is a real coordination failure; surfacing them keeps commitments visible. P2 because the dashboard already has an Overdue smart view as a partial safety net.

**Independent Test**: Create an open task with a due date in the past, confirm it appears on today's column in the calendar with an overdue badge, and confirm the underlying stored due date is unchanged.

**Acceptance Scenarios**:

1. **Given** an open task with a due date before today, **When** the calendar renders today, **Then** that task appears on today with a visible overdue badge.
2. **Given** an overdue task surfaced on today, **When** the stored data is inspected, **Then** the task's recorded due date is still its original past date (unchanged).
3. **Given** an overdue task surfaced on today, **When** the user completes it, **Then** it no longer carries the overdue badge / no longer surfaces as an outstanding overdue item.
4. **Given** an overdue task surfaced on today, **When** the user reschedules it to a future date, **Then** it appears on the new date without an overdue badge.

---

### User Story 7 - Dashboard rolling 7-day strip (Priority: P2)

On the home dashboard, a compact horizontal strip of seven day-tiles (today first, then the next six days) gives an at-a-glance sense of the week's load. Each tile shows owner-colored dots or counts summarizing that day's items. Tapping a tile jumps to the calendar focused on that day.

**Why this priority**: Extends the dashboard-first landing with a fast "what's my week look like" glance and a one-tap bridge into the calendar. Valuable and self-contained, hence P2.

**Independent Test**: On the dashboard, confirm seven day-tiles appear with today first, each showing owner-colored summaries of that day's items, and that tapping a tile opens the calendar on that date.

**Acceptance Scenarios**:

1. **Given** the dashboard, **When** it renders, **Then** a strip of seven day-tiles is shown with today as the first tile and the next six calendar days following.
2. **Given** a day-tile, **When** it renders, **Then** it summarizes that day's items using owner color coding (Max / Jaz / Both).
3. **Given** a day-tile, **When** the user taps it, **Then** the calendar opens focused on that tile's date.
4. **Given** a day with no items, **When** its tile renders, **Then** the tile reads as empty (no counts/dots) rather than being omitted.

---

### Edge Cases

- **Overdue at day boundary**: A task due "today" is not overdue; it becomes overdue only once the household-timezone date rolls past its due date.
- **Multiple overdue tasks**: Several overdue tasks all surface on today without collapsing into one another; today's cell may itself trigger the "+N more" overflow (US4).
- **Overdue + recurring**: Overdue display applies to standalone open tasks; recurring-rule materialization is unchanged (this feature does not rewrite dates).
- **Week view spanning a month boundary**: A fixed Week or Next-7-days view that straddles two months still shows the correct seven consecutive days.
- **Next-7-days vs. fixed Week overlap**: Selecting Next-7-days on a Sunday makes it visually similar to the fixed Week view for that day; both remain distinct selectable options.
- **Prep progress when all tasks done**: An event with all prep tasks complete shows "N/N tasks" (fully done), not a hidden indicator.
- **Empty week**: A week view or dashboard strip with no items renders cleanly (empty days shown, not hidden).
- **"+N more" on the smallest desktop widths**: The chip cap adapts so a cell never overflows its row height.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The calendar view selector MUST offer a **fixed Week** view showing the current calendar week Sunday through Saturday.
- **FR-002**: The calendar view selector MUST offer a **rolling Next-7-days** view showing today plus the following six days, with today first.
- **FR-002a**: Both week views MUST render each day as an **all-day day-list of chips** (agenda-style columns), not an hourly time-grid.
- **FR-002b**: The two week views MUST be selectable on **both desktop and mobile**; mobile MUST provide a compact view switcher (it currently has none).
- **FR-003**: Week views MUST render events and dated tasks with the same owner color coding used in existing views.
- **FR-004**: Navigation controls in the fixed Week view MUST advance/retreat one full calendar week; in the Next-7-days view they MUST shift the rolling window while preserving a 7-day span.
- **FR-005**: Every week-oriented surface (month grid weekday headers, week views, and any "this week" computation) MUST treat **Sunday as the first day of the week**.
- **FR-006**: On mobile-width screens, previous-month and next-month navigation controls MUST be visible and operable in the month view.
- **FR-007**: On mobile, the month view MUST allow all weeks/days of the displayed month to be reached (e.g., via scrolling) without content being cut off or unreachable.
- **FR-008**: On desktop, a month-grid day cell MUST render its items as compact chips and, when items exceed the cell's capacity, MUST show a "+N more" affordance representing the hidden count.
- **FR-009**: Activating a "+N more" affordance MUST navigate the calendar to a focused single-day/agenda view for that date, revealing the full list of that day's items.
- **FR-010**: An event that has a prep checklist MUST display a completed/total task-progress indicator (e.g., "3/7 tasks") on its calendar chip; events without prep tasks MUST NOT show one.
- **FR-011**: The prep-task progress indicator MUST reflect the current completion state of that event's prep tasks.
- **FR-012**: An open task whose stored due date is before the current household-timezone date MUST be displayed on **today only** in the calendar with a distinct overdue badge, and MUST NOT also appear on its original past date.
- **FR-013**: Surfacing an overdue task on today MUST NOT modify the task's stored due date or trigger calendar re-sync churn (display-only behavior).
- **FR-014**: An overdue task MUST stop receiving overdue treatment once it is completed or rescheduled to a date that is not in the past.
- **FR-015**: The dashboard MUST display a strip of exactly seven day-tiles, today first, followed by the next six calendar days.
- **FR-016**: Each day-tile MUST summarize that day's items using owner color coding (dots and/or counts for Max / Jaz / Both).
- **FR-017**: Tapping a day-tile MUST navigate to the calendar focused on that tile's date.
- **FR-018**: A day-tile for a day with no items MUST render as an empty tile (still present in the strip), not be omitted.
- **FR-019**: All date and week boundary computations MUST use the single household timezone from Settings.

### Key Entities *(include if feature involves data)*

- **Event**: An existing scheduled item with an owner and, optionally, an associated prep checklist; gains a derived progress signal (completed vs. total prep tasks) surfaced on its chip. No new stored fields.
- **Task**: An existing owned to-do that may have a due date and an open/complete/snoozed status; overdue is a **derived, display-only** classification (open + due date in the past), never a stored state.
- **Prep task**: An existing task belonging to an event's checklist; its aggregate completion drives the event chip's "M/N" indicator.
- **Calendar view mode**: The selectable time horizon (month, fixed week, next-7-days); a UI-state concept, not stored data.
- **Day-tile**: A dashboard summary of a single calendar day (its owner-colored item counts and a link target date); derived, not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch from the month view to either week view and back in a single interaction each, and the correct seven days appear immediately.
- **SC-002**: Every week-oriented surface in the app starts the week on Sunday — 100% consistency, zero surfaces starting on any other day.
- **SC-003**: On a mobile-width screen, a user can move to an adjacent month without needing to scroll horizontally to find the control, and can reach every day of any month.
- **SC-004**: No desktop month-grid day cell overflows its row when a day is dense; overflow is always represented by a "+N more" affordance that reveals the rest.
- **SC-005**: For any event with a prep checklist, the completed/total count shown on its chip matches the actual checklist state at render time.
- **SC-006**: An open task past its due date is visible on today until the user completes or reschedules it, and its stored due date is never altered by this behavior.
- **SC-007**: The dashboard's 7-day strip lets a user identify the busiest of the next seven days and open the calendar on any of those days in one tap.
- **SC-008**: The changes introduce no new backend writes, no new stored fields, and no additional calendar-sync activity (this feature is presentation-only over existing data).

## Assumptions

- **Frontend-only, presentation-layer feature.** All required data (events, tasks with due dates and statuses, prep checklists, owners) already exists via the current API; no new backend actions, stored fields, triggers, or Sheet columns are introduced. (Consistent with the dashboard-first landing and the existing Overdue smart view.)
- **Overdue = open standalone task with a due date strictly before today** (household timezone). Tasks due today are not overdue. Snoozed/complete tasks are not overdue.
- **Overdue tasks surface on today only** (moved in display), not simultaneously on their original past date — keeping today as the single place outstanding work lives. (Confirmed in clarification.)
- **"+N more" navigates to that day**: activating it opens a focused single-day/agenda view for the date; it is not merely a static badge and not an in-place popover. (Confirmed in clarification.)
- **Week views are all-day day-lists** (agenda-style columns) and are available on both desktop and mobile; mobile gains a compact view switcher. (Confirmed in clarification.)
- **Existing owner color system** (Max / Jaz / Both) and the existing calendar component are reused; this feature configures/extends them rather than replacing the calendar library.
- **The dashboard 7-day strip supplements** existing dashboard content (smart views, load balance, highlights) rather than replacing any of it.
- **Week views reuse existing chip styling and interactions** (tapping an event opens its detail; tapping a task opens its detail), consistent with feature 016's fixes.
- **Mobile month navigation and scrolling** are within the capabilities of the current calendar component's configuration; if the component cannot expose visible month arrows on mobile, the plan will define the minimal wrapper needed.

## Dependencies

- Builds on feature 006 (calendar UI), 014 (home dashboard, incl. the existing Overdue smart view and load-balance surfaces), and 016 (calendar tap-to-open fixes and view/breakpoint handling).
- Reuses the existing prep-checklist/event-task relationship from feature 005.
