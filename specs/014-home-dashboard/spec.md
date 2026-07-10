# Feature Specification: Home Dashboard

**Feature Branch**: `014-home-dashboard`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Home dashboard as the new home/landing view. Week + month summaries showing tasks individually and together (e.g. \"Friends are here Fri–Sun — you have 4 tasks, Jaz has 5\", \"rare chore coming up: change the air filter\"). Absorbs the load-balance view (who has more work) and smart views: Today / This weekend / Overdue. The dashboard becomes the default landing view, reversing the calendar-first principle — so this feature includes a design/constitution amendment that Max must co-approve before implementation."

## Governance Note *(read first)*

This feature **reverses the "calendar is home" principle** currently written into
`PRODUCT.md`, `DESIGN.md`, and the constitution's design reference. Making the dashboard
the landing view is a governance change, not just a UI change. Per the constitution's
amendment process, the design/constitution amendment portion of this feature MUST be
co-approved by Max before any implementation begins. See **User Story 4** and the
**Assumptions** section.

## Clarifications

### Session 2026-07-10

- Q: In the week/month load-balance counts, how should `both`-owned tasks be represented? → A: A separate shared "Both" figure, shown alongside Max's and Jaz's counts and never added into either individual's number.
- Q: What day range should "This weekend" cover? → A: Friday through Sunday (Fri–Sun).
- Q: What recurrence interval makes a chore a "rare chore" for highlights? → A: Recurs less often than monthly (interval longer than one month — e.g. quarterly).
- Q: Is the dashboard-as-home landing fixed or a household setting? → A: Fixed — the dashboard is always the landing view; the calendar is one tap away. No new Settings key.

## User Scenarios & Testing *(mandatory)*

The two users are Max and Jaz. Every task and event has an owner from exactly `max`,
`jaz`, or `both`. The dashboard reads the same tasks and events that already exist in the
system — it introduces no new data, only a new way of seeing what is already there.

### User Story 1 - Land on a dashboard that shows what matters now (Priority: P1)

When either person opens the app, they land on a home dashboard instead of the calendar.
The dashboard answers "what do I need to know right now?" at a glance: what is due
**today**, what is **overdue**, and what is coming up **this weekend** — for both people,
with each item clearly owned (Max / Jaz / Both) by color. The calendar is still one tap
away as secondary navigation.

**Why this priority**: This is the reason the feature exists — a calm, at-a-glance home
that reduces the mental load of holding the whole picture in your head. It is a complete,
demonstrable MVP on its own: the smart views (Today / This weekend / Overdue) replace the
brief's "smart views" item and give immediate daily value without any of the summary or
highlight features below.

**Independent Test**: With existing tasks and events in the Sheet, open the app and
confirm it lands on the dashboard showing correctly-grouped Today, Overdue, and This
weekend sections, each item owner-colored, with a working link to the calendar.

**Acceptance Scenarios**:

1. **Given** a task owned by Jaz due today and an event today, **When** either user opens
   the app, **Then** the dashboard is the first screen and both appear under "Today" with
   Jaz's owner color and the event shown.
2. **Given** an open task whose due date is before today, **When** the dashboard loads,
   **Then** that task appears under "Overdue" and does not also appear under "Today".
3. **Given** a task due this coming Saturday, **When** the dashboard loads on a weekday,
   **Then** it appears under "This weekend".
4. **Given** the dashboard is showing, **When** the user taps the calendar navigation,
   **Then** the calendar opens (calendar functionality is unchanged).
5. **Given** no tasks or events are due today, overdue, or this weekend, **When** the
   dashboard loads, **Then** each empty section shows a calm, encouraging empty state
   rather than a blank area.

---

### User Story 2 - See the week and month load balance, individually and together (Priority: P2)

The dashboard shows a summary of the workload for the current **week** and current
**month**: how many open tasks each person has, and the combined household picture — e.g.
"This week: you have 4 tasks, Jaz has 5." This makes the invisible question "who is
carrying more right now?" visible without anyone having to ask or count.

**Why this priority**: Load-balance visibility is a core promise of the product (fairness
without nagging), but it builds on the dashboard existing (US1). It is valuable on its own
and independently testable, but the daily-glance value of US1 comes first.

**Independent Test**: Seed a known set of tasks across owners and dates, open the
dashboard, and confirm the week and month counts for Max, Jaz, and the shared/both bucket
match the seeded data.

**Acceptance Scenarios**:

1. **Given** 4 open tasks owned by the viewer and 5 owned by the other person due this
   week, **When** the dashboard loads, **Then** the week summary reads the viewer's count
   as 4 and the other person's as 5.
2. **Given** tasks owned by `both` due this week, **When** the week summary is shown,
   **Then** those tasks are counted in a shared/"both" figure and are not double-counted
   into either individual's number.
3. **Given** a completed task due this week, **When** the summary is computed, **Then** it
   is not counted toward anyone's open workload.
4. **Given** the same data, **When** the user views the month summary, **Then** the month
   counts include the whole current month (a superset of or equal to the week counts).
5. **Given** the viewer is the shared household account, **When** the summary is shown,
   **Then** it still presents the load for Max and Jaz individually (the shared account is
   never itself an owner).

---

### User Story 3 - Notice the noteworthy: highlights and callouts (Priority: P3)

The dashboard surfaces a small number of human, contextual highlights that a plain list
would bury: an upcoming social event ("Friends are here Fri–Sun"), or an unusual,
rarely-recurring chore that is about to come due ("rare chore coming up: change the air
filter"). These are gentle nudges, not alarms.

**Why this priority**: This is the "warmth" layer that makes the dashboard feel like a
kitchen corkboard rather than a report. It depends on US1's data plumbing and is the most
heuristic/subjective part, so it is lowest priority and can ship after the core.

**Independent Test**: Seed a multi-day event this weekend and a long-interval recurring
chore due soon; open the dashboard and confirm each appears as a highlight with plain,
warm phrasing, and that ordinary frequent chores do not appear as highlights.

**Acceptance Scenarios**:

1. **Given** a multi-day or weekend event in the next several days, **When** the dashboard
   loads, **Then** a highlight names it and its day range (e.g. "Friends are here
   Fri–Sun").
2. **Given** a recurring chore whose recurrence interval is long (rare), and its next
   occurrence is coming up soon, **When** the dashboard loads, **Then** a highlight calls
   it out (e.g. "rare chore coming up: change the air filter").
3. **Given** only ordinary, frequently-recurring chores are due, **When** the dashboard
   loads, **Then** no "rare chore" highlight is shown (highlights stay sparse).
4. **Given** there is nothing noteworthy, **When** the dashboard loads, **Then** the
   highlights area is simply absent or shows a calm empty state — it never invents filler.

---

### User Story 4 - Governance: amend calendar-first to dashboard-first (Priority: P1, gating)

Before the dashboard can become the landing view, the product's stated design principle
("calendar is home") must be formally amended to "dashboard is home; calendar is primary
secondary navigation," and Max must co-approve that amendment.

**Why this priority**: This is a hard prerequisite. Shipping US1 without amending the
principle would put the code in direct conflict with `PRODUCT.md`, `DESIGN.md`, and the
constitution — a constitution violation. It is P1 because nothing else can merge until it
is resolved, but it is a documentation/approval task, not a UI task.

**Independent Test**: Confirm `PRODUCT.md`, `DESIGN.md`, and the constitution reference no
longer assert calendar-as-landing, that they describe the dashboard as home, and that the
change is recorded as co-approved by Max.

**Acceptance Scenarios**:

1. **Given** the current docs say "calendar is home," **When** the amendment is prepared,
   **Then** the changed wording in `PRODUCT.md`, `DESIGN.md`, and the constitution
   reference is presented for Max's explicit co-approval before implementation merges.
2. **Given** Max has not yet approved, **When** implementation is considered, **Then** it
   does not merge (the amendment gates the feature).

---

### Edge Cases

- **Timezone boundaries**: "Today", "this weekend", "this week", and "this month" are all
  computed in the single household timezone from Settings, so an item never lands in the
  wrong bucket because of a viewer's device clock.
- **Overdue vs. Today overlap**: An item due earlier today is "Today", not "Overdue";
  "Overdue" means strictly before today.
- **Weekend that is today**: When the dashboard is opened on a Friday/Saturday/Sunday, the
  "This weekend" section refers to the current weekend, not the next one.
- **Undated tasks**: Standalone tasks with no due date (the "Someday" items from feature
  013) do not appear in Today/Overdue/This weekend and are not counted in week/month load
  balance (they have no date to fall into a period).
- **Recurring materialization**: The dashboard reflects whatever task instances currently
  exist; it does not itself generate future recurring occurrences.
- **Large counts**: If a person has an unusually large number of tasks in a period, the
  summary still reads clearly (a number, not an overwhelming list).
- **Empty everything**: A brand-new or quiet week produces calm empty states, never error
  states or blank panels.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST always open to the home dashboard as its landing view
  (this is fixed behavior, not a configurable Settings option); the calendar MUST remain
  reachable as secondary navigation, one tap away, with its behavior unchanged.
- **FR-002**: The dashboard MUST show a "Today" grouping of tasks and events dated today,
  in the household timezone.
- **FR-003**: The dashboard MUST show an "Overdue" grouping of open tasks whose due date
  is strictly before today; completed tasks MUST NOT appear.
- **FR-004**: The dashboard MUST show a "This weekend" grouping of tasks and events falling
  in the current/upcoming weekend, where "weekend" is Friday through Sunday.
- **FR-005**: Every task and event shown MUST be visually attributed to its owner (Max /
  Jaz / Both) using the established owner color coding.
- **FR-006**: The dashboard MUST show a current-week load summary giving Max's open-task
  count, Jaz's open-task count, and a shared/"both" figure, presented as an at-a-glance
  "who has more" comparison.
- **FR-007**: The dashboard MUST show a current-month load summary with the same
  per-person and shared breakdown as the week summary.
- **FR-008**: Load-summary counts MUST count only open (not completed) tasks that have a
  due date within the period; `both`-owned tasks MUST be counted in the shared figure and
  MUST NOT be double-counted into either individual's figure.
- **FR-009**: The dashboard MUST attribute load per person (Max, Jaz) regardless of which
  of the three allowed sign-ins (Max, Jaz, or the shared household account) is viewing; the
  shared account is never counted as an owner.
- **FR-010**: The dashboard MAY show a small, sparse set of contextual highlights for
  noteworthy upcoming events and rarely-recurring chores; a chore qualifies as "rare" when
  its recurrence interval is longer than one month (e.g. quarterly). When nothing qualifies,
  the dashboard MUST NOT show filler.
- **FR-011**: Every dashboard section MUST have a calm, on-brand empty state when it has no
  items.
- **FR-012**: All date bucketing (today, weekend, week, month) MUST be computed in the
  single household timezone from Settings.
- **FR-013**: The dashboard MUST be read-only with respect to household data in its core
  views — viewing the dashboard MUST NOT change task or event state. (Acting on an item,
  e.g. completing a task, follows existing task interactions and is not required for this
  feature's core.)
- **FR-014**: The design principle documents (`PRODUCT.md`, `DESIGN.md`, and the
  constitution's design reference) MUST be amended from "calendar is home" to
  "dashboard is home," and that amendment MUST be co-approved by Max before implementation
  merges.

### Key Entities *(include if feature involves data)*

- **Task**: An existing item with an owner (`max`/`jaz`/`both`), an optional due date, and
  a done/open state. The dashboard reads tasks; it does not define new task fields.
- **Event**: An existing calendar item with an owner and a date or date range. The
  dashboard reads events for the Today / weekend / highlight groupings.
- **Recurring rule**: An existing definition of how a chore repeats. Its recurrence
  interval is what distinguishes an "ordinary" chore from a "rare" one for highlights.
- **Household period**: A derived, not-stored concept — Today, This weekend, This week,
  This month — each defined in the household timezone and used only for grouping and
  counting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening the app lands on the dashboard 100% of the time (the calendar is no
  longer the first screen).
- **SC-002**: A person can answer "what's due today, what's overdue, and what's this
  weekend?" within 5 seconds of the dashboard loading, without navigating away.
- **SC-003**: A person can answer "who has more tasks this week?" from the dashboard
  without counting anything by hand.
- **SC-004**: The load-balance counts shown match a hand-count of the underlying tasks for
  the period 100% of the time (per-person and shared figures reconcile to the source data).
- **SC-005**: Every item on the dashboard is unambiguously attributable to Max, Jaz, or
  Both by color, meeting the project's WCAG 2.1 AA contrast target.
- **SC-006**: On a quiet week with nothing due, the dashboard shows only calm empty states
  — zero error messages and zero blank/broken panels.
- **SC-007**: The calendar remains reachable and fully functional from the dashboard in one
  navigation step.

## Assumptions

- **Frontend-only feature**: As with features 012 and 013, the data the dashboard needs
  (tasks with owner/date/done, events, recurring rules) is already served by the existing
  backend; this feature reorganizes and summarizes existing data on the frontend and does
  not require new backend endpoints or Sheet schema changes. (To be confirmed at plan time
  against the actual API surface.)
- **Landing-view reversal is already decided** (BACKLOG clarification 2026-07-09): the
  dashboard becomes home; the open question is not *whether* but *how* the amendment is
  worded and approved — hence User Story 4.
- **Load balance = open task count in period** (clarified 2026-07-10): The "who has more"
  metric is a simple count of open, dated tasks per owner in the period, with `both` tasks
  in a separate shared figure that is never folded into either individual's number.
  Weighting by effort/priority is out of scope.
- **"This weekend" = Friday through Sunday** (clarified 2026-07-10), matching the "Friends
  are here Fri–Sun" example.
- **Week start follows Settings** (default Sunday), consistent with the email-digest
  "week ahead" convention, so the dashboard and digests agree on where a week begins.
- **"Rare chore" heuristic** (clarified 2026-07-10): A recurring chore counts as "rare" for
  highlights when its recurrence interval is longer than one month (e.g. quarterly). Which
  events qualify as social/noteworthy highlights remains a plan-time heuristic; US3 is
  intentionally the lowest priority so an imperfect heuristic never blocks the core
  dashboard.
- **Highlights stay sparse**: The dashboard favors a few meaningful callouts over
  completeness; it is acceptable for it to show no highlights.
- **No new notifications**: This feature only changes what the user sees when they open the
  app; it does not send emails or pings (those remain features 008/009).
