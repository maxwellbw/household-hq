# Feature Specification: Dog-Walk Day Planner

**Feature Branch**: `031-dog-walk-day-planner`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Dog-walk day planner — surface the finder's reasoning in the app (busy blocks, hourly weather + gates, candidate windows), let a person book/unbook a walk directly, and fix the forecast-fetch resilience bug (HTTP 429 from Open-Meteo defers every day)."

## Context

Feature 011 shipped the dog-walk finder as a nightly backend trigger. It reads both work
calendars plus the Household calendar, subtracts an ignore-list, intersects mutual-free
time with an Open-Meteo hourly forecast, and books the longest walk closest to midday.
It works, but it is entirely opaque: the app shows only the *outcome* (a booked window, or
a `needs-decision` flag) and never the *reasoning*. When the finder picks 3:15pm instead of
the obvious 11am gap, or flags a day as undecidable, neither user can tell whether the
cause was a work meeting, the heat ceiling, the precipitation gate, or a failed forecast
fetch — and they have no way to overrule it from the app.

On 2026-07-18 the nightly trigger failed outright: Open-Meteo returned HTTP 429 on all
three fetch attempts, so the run deferred every day in the horizon and booked nothing.
This is not a rare event to design around — Open-Meteo rate-limits per source IP, and
Apps Script egresses from a shared Google IP pool, so a single nightly fetch can be
rate-limited by traffic that has nothing to do with this household. The current retry
policy makes it worse: a flat 500ms backoff puts all three attempts inside the same
second, well within any rate-limit window, and a 429 is not distinguished from a generic
transient failure. There is no forecast cache, so one bad fetch loses the entire run.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The nightly run survives a rate-limited forecast (Priority: P1)

The nightly finder runs. Open-Meteo rejects the forecast request with a rate-limit
response. Instead of giving up and deferring every day, the run falls back to the most
recent forecast it successfully stored, notes that it is working from a cached forecast
and how old that forecast is, and proceeds to evaluate the days it can. If no usable
cached forecast exists either, it defers as it does today — but the log says clearly which
of the two situations occurred.

**Why this priority**: This is a live bug that silently produced a zero-booking night. It
also stands alone: shipping only this story restores the finder to reliable operation with
no UI work at all. Every later story reads forecasts far more often than once nightly, so
the cache is a prerequisite rather than an optimization.

**Independent Test**: Force the forecast fetch to return a rate-limit response with a
populated cache and confirm the run still evaluates days; repeat with an empty cache and
confirm it defers with a distinguishable log reason. Fully testable in the backend
self-test with no UI.

**Acceptance Scenarios**:

1. **Given** a stored forecast from earlier the same day, **When** the nightly run's live
   fetch is rate-limited, **Then** the run evaluates days against the stored forecast and
   records that it used a cached forecast of stated age.
2. **Given** no stored forecast at all, **When** the live fetch fails every attempt,
   **Then** the run defers all days and logs that both the live fetch and the cache were
   unavailable — distinct from the "fetch failed but cache served" message.
3. **Given** a rate-limit response on the first attempt, **When** the run retries, **Then**
   successive attempts are spaced by increasing waits rather than a fixed sub-second delay,
   and the spacing for a rate-limit response is longer than for a generic transient error.
4. **Given** a successful live fetch, **When** the run completes, **Then** the forecast is
   stored for later fallback, replacing any older stored forecast.
5. **Given** a stored forecast older than 24 hours, **When** a run falls back to it,
   **Then** the run treats it as unusable for booking decisions and defers rather than
   booking against a stale forecast.
6. **Given** the nightly run's fetch is the only thing that ever populates the cache,
   **When** that run is the very thing being rate-limited, **Then** the cache MUST still
   get populated by some path that is not the congested nightly trigger — otherwise the
   fallback is empty precisely when it is needed (see Research R1).

---

### User Story 2 - See why a day got the slot it did (Priority: P2)

Max opens a day in the app and sees the finder's reasoning laid out: the merged busy
blocks from both people's calendars so the free gaps are obvious, the hourly weather
across the day with each of the four gates (heat ceiling, cold floor, precipitation
probability, snow/ice) shown as pass or fail per hour, and the candidate walk windows the
finder considered with the chosen one marked. If the day is flagged `needs-decision`, the
view makes the blocking reason visible — every hour is either busy or fails a named gate.

**Why this priority**: This is the core of the feature and delivers value read-only, with
no write path and no risk to the booking logic. It answers "why 3:15pm?" without anyone
having to read an execution log.

**Independent Test**: Open the planner for a day with known calendar and forecast data and
confirm the busy blocks, per-hour gate results, and candidate windows match what the
nightly run decided for that same day. No booking required.

**Acceptance Scenarios**:

1. **Given** a day with a booked walk, **When** the planner is opened for that day,
   **Then** it shows the merged busy blocks, the per-hour weather with gate pass/fail, and
   the booked window marked as the chosen candidate.
2. **Given** a day flagged `needs-decision`, **When** the planner is opened, **Then**
   every candidate-eligible hour is visibly attributed to either a busy block or a specific
   failed gate.
3. **Given** the forecast in use is a cached one, **When** the planner is opened, **Then**
   the view states that the weather shown is cached and how old it is.
4. **Given** a day beyond the reliable-forecast horizon, **When** the planner is opened,
   **Then** the view indicates the weather is not yet reliable for that day rather than
   presenting it with the same confidence as a near-term day.

---

### User Story 3 - Book or unbook a walk myself (Priority: P3)

From the planner view, Jaz picks a free window that the finder did not choose — maybe she
knows the afternoon meeting will end early — and books the walk into it. Or she removes a
walk the finder booked. The change takes effect the same way an automatic booking does,
and the next nightly run leaves her decision alone instead of quietly moving it back.

**Why this priority**: The write path depends on the view existing (US2) and on reliable
forecasts (US1), and it carries the most risk — it touches the booking logic that creates
real calendar invites. Shipping it last keeps that risk isolated.

**Independent Test**: Book a walk into a non-chosen free window from the app, confirm the
calendar invites and ledger row match what an automatic booking produces, then run the
nightly finder and confirm the manual choice survives.

**Acceptance Scenarios**:

1. **Given** a free window the finder did not choose, **When** a user books a walk into it
   from the planner, **Then** the walk is created through the same booking path as an
   automatic booking, producing the same calendar invites and ledger row shape, and the
   action is recorded in the activity log with the acting person.
2. **Given** a walk already booked for a day and slot, **When** a user books again for that
   same day and slot, **Then** no duplicate walk or duplicate calendar event is created —
   the existing one is reused or moved.
3. **Given** a user-booked walk, **When** the next nightly run evaluates that day, **Then**
   the run does not move or replace it.
4. **Given** a user removes a booked walk, **When** the next nightly run evaluates that
   day, **Then** the run does not re-book that day automatically.
5. **Given** a user books a walk into a window that fails a weather gate, **When** they
   confirm, **Then** the specific failed gate is named before the booking is made and the
   booking proceeds only on explicit confirmation.
6. **Given** a user books a walk into a window that is busy on a source calendar, **When**
   they confirm, **Then** the conflicting block is named and the booking proceeds only on
   explicit confirmation.

---

### Edge Cases

- A user books a walk into a window that has already started, or is entirely in the past.
- A user books a walk on a day whose forecast is unavailable (fetch failed, no cache).
- Both users open the planner for the same day and book different windows near-simultaneously.
- The nightly run is executing while a user books from the app.
- A source calendar is unreadable when the planner is opened — the view must not present an
  empty busy list as "the whole day is free."
- A user removes a walk, then wants automatic booking to resume for that day.
- The stored forecast covers a shorter horizon than the day being viewed.
- A user hand-edits the walk ledger row in the Sheet (Principle II) — the planner must
  tolerate it rather than break.
- Daylight-saving transitions inside a viewed day.

## Requirements *(mandatory)*

### Functional Requirements

**Forecast resilience (US1)**

- **FR-001**: The system MUST store the most recent successfully fetched forecast and
  retain it for reuse when a later fetch fails.
- **FR-002**: When a live forecast fetch fails every attempt, the system MUST fall back to
  the stored forecast rather than deferring all days, provided the stored forecast is
  within the freshness limit and covers the days being evaluated.
- **FR-003**: The system MUST distinguish a rate-limit response from other transient
  failures and wait longer before retrying a rate-limit response.
- **FR-004**: Retry waits MUST increase between successive attempts rather than remaining
  fixed, so that attempts do not all fall inside a single rate-limit window.
- **FR-005**: The system MUST record, in a form visible in the execution log, which of
  these occurred: live fetch succeeded, live fetch failed and cache served, or live fetch
  and cache both unavailable.
- **FR-006**: The system MUST treat a stored forecast older than 24 hours as unusable for
  booking decisions. A forecast older than that MAY still be displayed in the planner, with
  its age shown, but MUST NOT gate a booking.
- **FR-006a**: The stored forecast MUST be populated by at least one path other than the
  nightly finder trigger, so that a rate-limited nightly run has a non-empty cache to fall
  back on (see Research R1). Any successful forecast fetch, whoever initiates it, updates
  the cache.
- **FR-006b**: The system MUST retry a rate-limited forecast fetch across a span of minutes
  rather than milliseconds, staying within the platform's per-execution time budget.
- **FR-007**: The stored forecast MUST NOT become a second source of truth for any
  household data — it holds only externally fetched weather, is safe to discard at any
  time, and its loss degrades nothing beyond one run's fallback (Principle II).

**Planner view (US2)**

- **FR-008**: Users MUST be able to open a day planner for a chosen day within the
  finder's horizon.
- **FR-009**: The planner MUST show the merged busy blocks derived from both people's
  source calendars and the Household calendar, with the ignore-list already applied, so
  that displayed free time matches the free time the finder computes.
- **FR-010**: The planner MUST show the hourly weather across the day, and for each hour
  indicate whether it passes or fails each of the four gates, naming the failed gate.
- **FR-011**: The planner MUST show the candidate walk windows for the day and mark which
  one is currently chosen, if any.
- **FR-012**: The planner MUST state when the weather shown comes from a stored forecast
  rather than a live one, including its age.
- **FR-013**: The planner MUST indicate when a day falls beyond the reliable-forecast
  horizon.
- **FR-014**: When a source calendar cannot be read, the planner MUST say so rather than
  render the day as fully free.
- **FR-015**: The planner MUST reflect the same reasoning the nightly run uses; a day's
  displayed candidates and chosen window MUST NOT contradict what the run decided given
  the same inputs.

**Booking from the app (US3)**

- **FR-016**: Users MUST be able to book a walk into any free window shown in the planner,
  including one the finder did not choose.
- **FR-017**: Users MUST be able to remove a booked walk from the planner.
- **FR-018**: Booking from the app MUST use the same booking path as an automatic booking,
  producing calendar invites and a ledger row indistinguishable in shape from an automatic
  one.
- **FR-019**: Booking MUST be idempotent — repeating a booking for the same day and slot
  MUST NOT create a duplicate walk or duplicate calendar event (Principle V).
- **FR-020**: Every booking and removal made from the app MUST append an activity-log entry
  recording timestamp, acting person, action, and the affected walk (Principle VI).
- **FR-021**: A walk booked or removed by a user MUST be marked as user-decided, and
  subsequent automatic runs MUST NOT move, replace, or re-book it.
- **FR-021a**: A user MUST be able to book into a window that fails a weather gate or
  overlaps a busy block, provided the specific failed gate or conflicting block is named at
  confirmation time and the user explicitly confirms. Human judgment overrides the gates;
  the gates inform, they do not forbid.
- **FR-022**: Users MUST be able to return a user-decided day to automatic handling.
- **FR-023**: The system MUST prevent booking a window that has already started.
- **FR-024**: Concurrent booking attempts for the same day and slot MUST NOT produce two
  walks; one MUST win and the other MUST be told the state changed.

### Key Entities

- **Stored forecast**: the most recent successful hourly weather fetch for the household
  location, with the time it was fetched. Disposable cache, never a source of truth.
- **Dog-walk ledger row**: the existing per-(date, slot) record — status, window, duration,
  calendar event ids, reason. Gains a marker distinguishing a user decision from an
  automatic one.
- **Busy block**: a merged interval of unavailable time for the day, after the ignore-list
  is applied. Derived, not stored.
- **Hourly gate result**: for one hour of one day, whether it passes each of the four
  weather gates and which gate failed. Derived, not stored.
- **Candidate window**: a contiguous free, weather-passing interval of an allowed duration,
  with whether it is the chosen one. Derived, not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A nightly run whose live forecast fetch is rate-limited still evaluates and
  books days, provided a forecast was successfully fetched within the freshness limit —
  zero-booking nights caused by a single failed fetch are eliminated.
- **SC-002**: For any day in the horizon, a user can determine why the finder chose the
  window it chose — or why it chose none — from the planner alone, without opening an
  execution log or the raw Sheet.
- **SC-003**: A user can book a walk into a window of their choosing in under 30 seconds
  from opening the planner.
- **SC-004**: A walk booked or removed by a user survives every subsequent automatic run
  unchanged until the user releases it back to automatic handling.
- **SC-005**: Repeating any booking action — by retry, double-tap, or a run overlapping a
  user action — never produces a duplicate walk or duplicate calendar invite.
- **SC-006**: The planner's displayed reasoning matches the automatic run's decision for
  the same day and inputs in every checked case.

## Open Research

- **R1 — Why does the trigger get rate-limited when a manual run does not?** Observed
  2026-07-18: `runDogWalkFinder` fired by the nightly trigger got HTTP 429 on all three
  attempts, but the same function executed manually succeeds. Both call the same URL with
  the same parameters, so the difference is in the execution environment, not the request.

  Leading hypothesis: Apps Script executes time-driven triggers on shared batch
  infrastructure whose outbound IP pool is far more heavily shared than the path used by
  manual/editor runs. The trigger is configured for hour 1, and Apps Script fires
  `atHour(1)` triggers at an arbitrary minute within the 1:00–2:00 window (the failure
  logged at 1:26:13). An enormous cohort of scheduled scripts fires in that same window,
  and Open-Meteo — free, keyless, and therefore a common default — rate-limits per source
  IP. A manual run at a quiet hour from a different egress path sees no limit.

  Alternative explanations to rule out during planning: a per-project quota that differs
  between trigger and interactive execution; a difference in how the request is attributed
  when there is no active user session; Open-Meteo applying stricter limits to requests
  lacking a browser-like signature.

  **This is worth investigating but MUST NOT block the fix.** The failure is observable
  roughly once a night, which makes root-causing slow, and the mitigations below are
  correct under every hypothesis above: cache with a non-trigger warm path (FR-006a),
  minutes-scale backoff distinguishing 429 (FR-003, FR-006b), and moving the trigger off
  the congested top-of-hour window. The plan should design for resilience rather than wait
  for a confirmed root cause.

## Assumptions

- The planner covers one day at a time; a multi-day comparison view is out of scope.
- The planner is reached from the existing calendar day surfaces rather than becoming a new
  top-level navigation destination — the calendar remains the organizing metaphor
  (PRODUCT.md).
- Weather gates and their thresholds are unchanged from feature 011; this feature displays
  them, it does not redefine them.
- The existing walk slots (primary and second walk) are unchanged.
- Only the two allowlisted users can view or book; no new permission concepts (Principle I).
- Open-Meteo remains the weather source and remains keyless and free (Principle III).
- The stored forecast lives in backend-managed storage, not as a new Sheet tab, since it is
  disposable machine data rather than household data a person would read or edit.
- The 2026-07-18 rate-limit incident is representative of an intermittent condition, not a
  permanent block on the shared egress IP. Evidence: a manual run of the same function
  succeeds (see Research R1).
- Because the planner view reads forecasts on demand from user-initiated requests, ordinary
  use of US2 will keep the cache warm during the day — which is what makes the US1 fallback
  non-empty at 1am. US1 ships first and therefore needs its own warm path until US2 lands.

## Dependencies

- Feature 011 (dog-walk finder) — booking path, gates, ledger, settings.
- Feature 007 (calendar sync) — calendar read/write scope already granted.
- Feature 017 (calendar views) / 029 — the day surfaces the planner attaches to.

## Out of Scope

- Changing the weather gate thresholds or the window-selection algorithm.
- Adding a weather provider or a paid weather tier.
- Editing a walk's duration to a value outside the configured set.
- Multi-day or week-level walk planning.
- Notifications beyond those feature 011 already sends.
