# Feature Specification: Weather-Aware Dog-Walk Window Finder

**Feature Branch**: `011-dog-walk-finder`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Weather-aware dog-walk window finder + auto-booker — each weekday, find a time when both Max and Jaz are free on their work calendars AND the weather is good, then book it onto both work calendars (via invite) and into the Household HQ app."

## Overview

Every weekday, Max and Jaz manually negotiate when to walk the dogs: whoever has a gap checks the other's work calendar, glances at the weather, and picks a slot. This feature does that negotiation automatically. A daily process reads both work calendars for free time, filters for good weather, picks the best mutual window, and books it — both as calendar invites to each work account and as an event in the Household HQ app. Bad-weather days are skipped; early-morning bookings trigger a second short afternoon walk; and because weather forecasts don't reach three weeks out, bookings firm up over a rolling ~10–14 day horizon and only get revised if a day's forecast actually turns bad.

## Clarifications

### Session 2026-07-13

- Q: Which calendars count as busy when finding a mutual-free window? → A: Both work calendars **plus the shared Household HQ calendar** (so walks avoid appointments/events already on the household calendar). Personal gmail calendars are out of scope until 026.
- Q: Among several equally-long eligible windows on a day, which one is booked? → A: The one **closest to midday, ideally within the 9:00 AM–12:00 PM late-morning band**; windows in that band are preferred over earlier or later ones.
- Q: When a booked day's forecast later turns bad, how does it revise? → A: **Re-check daily and move** the walk to another eligible window that day when one exists; **never auto-cancel.** If it cannot place or keep a good walk (no eligible window that day, or a booked window turns bad with nowhere good to move), it **notifies both users and asks them to resolve it manually** — a walk must happen every day.
- Q: Should Household HQ send its own notifications on book/move/cancel? → A: **Push on changes only** — silent on the initial booking (the calendar invite already notifies), push when a walk is **moved** or when a day **needs a manual decision**.
- Q: One invite with both work emails as guests, or separate invites? → A: **Two separate single-guest invites** — one to Max's work email, one to Jaz's — so neither sees the other's email on their work calendar. Handled entirely on the backend; the **app still shows exactly one walk** (both invites back a single ledger entry). To keep the shared Household calendar from showing duplicates, the two invite events live on the household account's own calendar rather than the shared Household calendar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Daily walk booked in a mutual-free window (Priority: P1)

Each weekday, the system finds a time both Max and Jaz are free on their work calendars and books a dog walk there, preferring the longest walk that fits. The walk lands as an invitation on each work calendar and as an event in the Household HQ app, so neither person has to ask "when can we both walk the dogs today?"

**Why this priority**: This is the core value — automated mutual-free scheduling. Even with no weather awareness at all, a walk that reliably appears on both calendars at a time both are free is a complete, useful product.

**Independent Test**: With both work calendars shared and containing some busy blocks, run the finder for a single weekday and confirm exactly one walk is booked in a slot both are free, at the longest of 60/45/30 minutes that fits, appearing on both work calendars and in the app; run it again and confirm no duplicate is created.

**Acceptance Scenarios**:

1. **Given** both work calendars and the household calendar are free from 8:00 AM–4:00 PM on a weekday, **When** the finder runs, **Then** one 60-minute walk is booked as close to midday as possible within the 9:00 AM–12:00 PM band, as an invite to both work emails and as a Household HQ event.
2. **Given** Max is busy until noon and Jaz is busy after 1:00 PM, **When** the finder runs, **Then** the walk is booked in the mutual-free window between noon and 1:00 PM (45 or 30 minutes as it fits).
3. **Given** a walk was already booked for a day, **When** the finder runs again for that day, **Then** no second/duplicate walk is created (idempotent).
4. **Given** a weekday where the mutual-free time is only a 30-minute gap, **When** the finder runs, **Then** a 30-minute walk is booked (not skipped).
5. **Given** a weekday within forecast range with no eligible (mutual-free, good-weather) window of at least 30 minutes, **When** the finder runs, **Then** no walk is auto-booked, both users are notified that the day needs a manual decision, and the day is surfaced in the app for them to resolve (the dogs still need a walk).
6. **Given** it is a Saturday or Sunday, **When** the finder runs, **Then** no walk is booked (weekends are out of scope).

---

### User Story 2 - Only book weather-appropriate windows (Priority: P2)

The system only books walks in good weather: it skips windows that are too hot, too cold, or likely wet/icy, so nobody ends up walking the dogs in rain, snow, ice, or oppressive heat.

**Why this priority**: The feature is explicitly weather-aware; this is the second half of the headline value. It layers onto the mutual-free finder (US1) rather than standing alone.

**Independent Test**: For a weekday whose forecast has a rainy morning and a clear afternoon, confirm the finder avoids the rainy hours and books only in the clear window; for a day that is over-hot or icy all day, confirm no walk is booked.

**Acceptance Scenarios**:

1. **Given** the forecast shows ≥50% precipitation probability from 8:00–11:00 AM and clear skies after, **When** the finder runs, **Then** the walk is booked only in the clear afternoon window.
2. **Given** every hour of a day exceeds the heat ceiling (default 80°F), **When** the finder runs, **Then** no walk is auto-booked and the day is surfaced to both users as needing a manual decision (not silently skipped).
3. **Given** the forecast shows a snow or ice/freezing weather code during a candidate window, **When** the finder runs, **Then** that window is excluded.
4. **Given** the temperature is below the cold floor (default 20°F) for the whole search window, **When** the finder runs, **Then** no walk is auto-booked and the day is surfaced to both users as needing a manual decision.

---

### User Story 3 - Rolling forecast horizon with revision (Priority: P2)

The system books firmly for the days where the weather forecast is real (~10–14 days out) and keeps extending toward a ~3-week outer horizon as new days come into forecast range. If a day's forecast later firms up into bad weather, the already-booked walk is moved to a better window that same day. It **never auto-cancels** — because the dogs need a walk every day, if there is nowhere good to move the walk it notifies both people and asks them to resolve it rather than silently dropping it.

**Why this priority**: Without this, either far-out days get booked blind (no forecast exists) or good near-term automation is impossible. It makes the weather-awareness honest over time while guaranteeing a walk is never quietly lost.

**Independent Test**: Book a walk for a day ~5 days out in good forecasted weather, then simulate the forecast for that day turning bad, run the finder again, and confirm the walk is moved to a still-good window that day (with both calendars and the app updated); repeat with no good window remaining and confirm the walk is left in place, both users are notified, and the day is flagged for manual resolution (never auto-cancelled). Confirm unaffected bookings are left untouched.

**Acceptance Scenarios**:

1. **Given** a day is beyond reliable forecast range, **When** the finder runs, **Then** no walk is booked for that day yet (it will be booked once it enters forecast range).
2. **Given** a walk is booked and the day's forecast later turns bad for that window but another eligible window exists that day, **When** the finder runs, **Then** the existing walk is moved to the eligible window (same booking identity, both calendars and app updated) and a "walk moved" push is sent.
3. **Given** a walk is booked and the day's forecast later turns bad with no eligible window remaining, **When** the finder runs, **Then** the walk is NOT auto-cancelled — both users are notified and the day is flagged in the app for manual resolution.
4. **Given** a booked walk whose forecast is unchanged/still good, **When** the finder runs, **Then** the booking is left exactly as-is (no needless move, no notification).
5. **Given** a walk whose start time is already in the past, **When** the finder runs, **Then** it is never moved and never re-evaluated.

---

### User Story 4 - Second short walk after an early morning walk (Priority: P3)

When the day's primary walk lands early (before 9:00 AM), the dogs will need to go out again, so the system also books a short 30-minute afternoon walk (after 1:00 PM) when the weather and calendars allow — and quietly skips it when they don't.

**Why this priority**: A real-life refinement on top of the core loop; valuable but not required for the feature to be useful.

**Independent Test**: Force a primary walk to be booked before 9:00 AM on a day with a good, free afternoon window and confirm a second 30-minute walk is booked after 1:00 PM; repeat on a day with no good afternoon window and confirm only the primary walk exists.

**Acceptance Scenarios**:

1. **Given** the primary walk is booked to start at 8:15 AM and there is a free, weather-good 30-minute window after 1:00 PM, **When** the finder runs, **Then** a second 30-minute walk is booked in that afternoon window.
2. **Given** the primary walk starts at 8:15 AM but no free/weather-good window exists after 1:00 PM, **When** the finder runs, **Then** only the primary walk exists and no error is surfaced.
3. **Given** the primary walk starts at 9:30 AM, **When** the finder runs, **Then** no second walk is booked.
4. **Given** a day already has both a primary (early) and a second walk booked, **When** the finder runs again, **Then** neither is duplicated.

---

### User Story 5 - Visibility, manual resolution, and suggest-only mode (Priority: P3)

Max and Jaz can see each day's booked (or suggested) walk in the Household HQ app, and when the finder can't place a good walk it surfaces that day as needing their input so no walk is silently lost. A suggest-only mode (no invites sent) lets them build trust before turning on auto-booking. The ignore-list and all thresholds are hand-editable so the tool matches how their calendars really work.

**Why this priority**: A transparency, manual-fallback, and safety-valve layer; the automation is usable without it but adoption is safer and a walk is never quietly dropped.

**Independent Test**: With auto-booking off (suggest-only), run the finder and confirm windows are computed and visible in the app but no calendar invites are sent; flip auto-booking on and confirm invites are then sent for the same windows; force a day with no eligible window and confirm it appears in the app as needing a manual decision.

**Acceptance Scenarios**:

1. **Given** auto-booking is off (suggest-only), **When** the finder runs, **Then** the app shows the suggested walk window(s) but no invitations are sent to the work calendars.
2. **Given** auto-booking is on, **When** the finder runs, **Then** invitations are sent and the app shows the booked walk.
3. **Given** an event titled "Focus time" (on the ignore-list) sits in an otherwise free stretch, **When** the finder computes free time, **Then** that block is treated as free.
4. **Given** a user edits a threshold (e.g., heat ceiling) or the ignore-list in Settings, **When** the finder next runs, **Then** the new value is honored.
5. **Given** a weekday the finder flagged as needing a manual decision, **When** Max or Jaz opens the app, **Then** that day is visible as unresolved so they can arrange the walk themselves.

---

### Edge Cases

- **Only one calendar readable / sharing not set up**: If a work calendar cannot be read (not yet shared, or only free/busy via an ICS fallback with no titles), the finder cannot compute a true mutual-free window. It MUST fail safe — skip booking for the affected scope and record the reason — rather than book a walk that ignores one person's schedule. Free/busy-only sources (no titles) simply cannot apply the ignore-list.
- **No mutual-free window at all** on an in-range weekday: no walk auto-booked; both users notified and the day flagged in the app as needing a manual decision (never silently skipped — the dogs still need a walk).
- **No weather-good window** on an in-range weekday: same as above — flagged for manual resolution, not silently skipped.
- **Forecast unavailable** (day beyond forecast range): day is deferred, not booked and not flagged, until it enters range.
- **User manually edits or deletes a booked walk** in Google Calendar: the finder identifies its own bookings by a stored id + hidden marker (not the title), so a user-deleted walk is treated as intentionally removed for that day and not force-recreated; a user-moved walk is respected.
- **Both invitees decline** the invitation: out of the app's control; the invite/booking record still exists. The app does not re-book on decline.
- **DST / timezone**: all windows computed in the single household timezone from Settings; a DST transition day must not shift or double-book.
- **A day already holds a manually-created walk or personal block**: counts as busy like any other event, so the finder naturally works around it.
- **Second-walk rule with no primary**: if no primary walk could be booked, the early-morning trigger does not apply, so no second walk is attempted.
- **Concurrent runs / trigger overlap**: booking writes must be safe against a second overlapping run (no double-book).

## Requirements *(mandatory)*

### Functional Requirements

**Finding windows**

- **FR-001**: System MUST compute the time both people are simultaneously free within the daily search window by reading event details from both configured work calendars **and** the shared Household HQ calendar, treating events on any of them as busy.
- **FR-002**: System MUST treat any event whose title matches the case-insensitive ignore-list (default: Focus time, Block, Busy, Hold) as free time, not busy.
- **FR-003**: System MUST restrict candidate walk start times to no earlier than the configured earliest start (default 8:00 AM) and no later than the configured latest start (default 4:00 PM), in the household timezone.
- **FR-004**: System MUST prefer the longest walk that fits an eligible window, trying 60, then 45, then 30 minutes, and MUST book a 30-minute walk rather than skip when only a 30-minute gap is eligible.
- **FR-004a**: When more than one eligible window of the chosen (longest) duration exists on a day, System MUST book the one closest to midday, preferring windows within the 9:00 AM–12:00 PM late-morning band over earlier or later windows.
- **FR-005**: System MUST operate on weekdays (Monday–Friday) only and MUST NOT auto-book on weekends.

**Weather**

- **FR-006**: System MUST fetch an hourly weather forecast for the household location (from Settings) from a keyless weather source and use it to qualify candidate windows.
- **FR-007**: System MUST exclude any candidate hour that exceeds the heat ceiling (default 80°F), is below the cold floor (default 20°F), has a precipitation probability at or above the threshold (default 50%), or carries a snow/ice/freezing weather condition.
- **FR-008**: All weather thresholds and the location MUST be configurable in Settings and honored on the next run.

**Second walk**

- **FR-009**: When the primary walk of a day starts before 9:00 AM, System MUST attempt to book an additional 30-minute walk starting after 1:00 PM that same day, subject to the same free/weather rules, and MUST skip it silently when no eligible window exists.

**Booking mechanism**

- **FR-010**: System MUST book a walk by creating **two separate single-guest calendar events** — one inviting Max's work email, one inviting Jaz's work email — organized by the household account, without requiring write access to the work calendars. Neither guest sees the other on their invitation. Both events share the same time, title, and hidden marker and represent the same logical walk.
- **FR-011**: The two invite events MUST live on the household account's own calendar (not the shared Household calendar, to avoid duplicate copies there), and the walk MUST be recorded as a **single** entry in the app's dog-walk ledger so the Household HQ app shows exactly one walk regardless of the two underlying invites. (Refined during planning — the walk is owned by this feature end-to-end rather than mirrored by the generic 007 sync, so the guest list is never stripped on reconcile. See research R1.)
- **FR-012**: The visible event title MUST be configurable (default "Booked") and MUST NOT be relied upon to identify the app's own bookings.
- **FR-013**: System MUST stamp each of a booking's invite events with a stable, hidden identifier (the stored event ids plus a machine marker on each event) so it can recognize, update, and move its own bookings regardless of the visible title.
- **FR-014**: System MUST be idempotent — re-running for a day that already has an app-created walk MUST NOT create a duplicate walk or extra invite events, and concurrent/overlapping runs MUST NOT double-book.

**Rolling horizon & revision**

- **FR-015**: System MUST auto-book only within the range where the forecast is reliable (~10–14 days), deferring later days until they enter forecast range, while treating a ~3-week window as the outer horizon it slides toward.
- **FR-016**: System MUST re-evaluate existing future (not past-start) bookings each daily run and, when a booked window turns bad, MUST move the walk to another eligible window that same day — updating both the invitations and the app event.
- **FR-017**: System MUST NEVER auto-cancel a booked walk. When a booked window turns bad and no eligible window remains that day, System MUST leave the walk in place, flag the day as needing a manual decision, and notify both users so they can resolve it.
- **FR-018**: System MUST leave a still-eligible existing booking unchanged (no needless move, no notification) and MUST never modify a walk whose start time is already in the past.

**Manual-decision fallback**

- **FR-019**: On any in-range weekday where System cannot auto-book an eligible (mutual-free, good-weather) walk — because no mutual-free window or no good-weather window exists — System MUST NOT silently skip the day. It MUST flag the day as needing a manual decision and notify both users, since a walk must happen every day.

**Notifications**

- **FR-020**: System MUST stay silent on a successful initial booking (the calendar invite already notifies the guests) and MUST send a Household HQ push notification only on changes: when a walk is moved, or when a day is flagged as needing a manual decision. It reuses the existing push system and adds no new dependency.

**Mode, safety & audit**

- **FR-021**: System MUST support a suggest-only mode (auto-booking off) in which windows are computed and visible in the app but no invitations are sent; auto-booking MUST be on by default and toggleable in Settings.
- **FR-022**: System MUST fail safe when a work calendar cannot be read — flagging the affected scope for manual resolution and recording the reason rather than booking against incomplete availability.
- **FR-023**: System MUST record every booking, move, and manual-decision flag to the activity log (timestamp, actor, action, target) and MUST run without requiring any new sign-in or permission grant beyond what is already authorized.

### Key Entities *(include if feature involves data)*

- **Walk Booking**: A scheduled dog walk for a specific date — its window (start/duration), whether it is the primary or the second (early-day) walk, the two stored single-guest invite event ids (one per person) with their hidden marker, and its current state (suggested / booked / moved). One walk = one ledger entry backed by two invite events. Walks are never auto-cancelled.
- **Day Resolution Flag**: A marker on an in-range weekday indicating the finder could not auto-place or keep a good walk and the day needs a manual decision — carries the reason (no mutual-free window / no good-weather window / calendar unreadable) and whether the users have addressed it.
- **Work Calendar Source**: A per-person reference to a work calendar the household account can read, plus how it is read (full detail vs. free/busy-only fallback) and the guest email to invite.
- **Ignore-List Entry**: A case-insensitive event-title pattern that should count as free rather than busy.
- **Weather Settings**: Household location plus the heat ceiling, cold floor, precipitation threshold, and the search-window bounds and walk-duration preferences.
- **Finder Settings**: Auto-book on/off, configurable event title, forecast/horizon parameters, and the work-calendar/guest configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a typical weekday where a mutual-free, good-weather window of ≥30 minutes exists, a walk is booked on both work calendars and in the app with no manual coordination.
- **SC-002**: No walk is ever booked in a window failing the weather gates (over the heat ceiling, under the cold floor, at/over the precipitation threshold, or in snow/ice) — 0 bad-weather bookings.
- **SC-003**: Re-running the finder any number of times for the same day never produces a duplicate walk.
- **SC-004**: When a booked day's forecast turns bad before the walk, the walk is moved to another eligible window that day before its start time whenever one exists; a walk is never auto-cancelled, and bookings whose forecast stays good are never needlessly moved.
- **SC-005**: No walk is ever silently dropped — every in-range weekday ends as either an auto-booked walk or a day flagged for manual decision with both users notified.
- **SC-006**: Days whose primary walk starts before 9:00 AM reliably receive a second short afternoon walk whenever an eligible afternoon window exists.
- **SC-007**: The daily process completes within the platform's per-run execution limit for the full rolling horizon (both work calendars, the household calendar, all in-range weekdays) without timing out.
- **SC-008**: Turning auto-booking off stops all invitations while still surfacing suggested windows in the app; turning it on resumes booking with no other change.

## Assumptions

- **Window selection among equal-length options**: Resolved (2026-07-13) — book the window closest to midday, preferring the 9:00 AM–12:00 PM late-morning band (FR-004a).
- **"Turns bad" / revision trigger**: Resolved (2026-07-13) — the daily process re-checks every in-range future booking; a window that newly fails any weather gate is moved that day, and the walk is never auto-cancelled (FR-016/FR-017).
- **Manual deletion policy**: A walk a user deletes in Google Calendar is treated as an intentional removal and not force-recreated for that day (identity tracked by stored id + hidden marker).
- **Calendar sharing**: Both work calendars are shared to the shared household account at "See all event details"; Max's shares full details directly, Jaz's Google work calendar sharing capability is confirmed at setup, with a free/busy-only ICS fallback that disables the ignore-list for that person if full detail is unavailable.
- **"Auto-accept" is user-side**: The app only sends invitations; each person configures their own work account to accept/auto-add them. An unanswered invite is assumed to still block the guest's time as busy.
- **One walk per weekday** by default (a second only under the early-morning rule); weekends are handled manually and are out of scope.
- **Reuse of existing platform**: The broad calendar authorization, the outbound calendar sync, the shared household calendar, the Settings store, and the activity log already exist and are reused — this feature introduces no new sign-in, permission grant, or paid service.
- **Single household timezone** from Settings governs all time math, including DST-transition days.
