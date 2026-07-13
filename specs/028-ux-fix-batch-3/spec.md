# Feature Specification: UX Fix Batch 3

**Feature Branch**: `028-ux-fix-batch-3`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "UX fix batch 3 — Jaz's feedback round 4 (2026-07-13), the first real-device findings after the 027 seed load. Eight items, all clarified with Jaz: (1) yearly recurring events visible 12+ months ahead; (2) instant create/edit saves; (3) no mobile zoom; (4) bottom nav clear of the iPhone home-indicator zone; (5) dashboard 7-day strip day tap shows that day inline; (6) redesign the acknowledge UI; (7) snoozed tasks included on the 7-day strip; (8) split the backend self-test so it finishes within the execution limit. Out of scope: notification quality (feature 010)."

## Overview

The 027 seed load put the household's real data into the app, and the first week of
real-device (iPhone) use surfaced a batch of friction: most seeded birthdays and
anniversaries are invisible, saving feels slow, the app zooms and mis-taps like a web
page instead of behaving like an app, and two dashboard behaviors (day tap, snoozed
items) don't match how Max and Jaz actually plan their week. One maintainer-facing
problem rides along: the backend's full self-test can no longer finish, so backend
changes can't be fully verified. This batch fixes all of it; notification quality is
explicitly deferred to feature 010 (PWA + push).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The whole year of birthdays and anniversaries is visible (Priority: P1)

Max and Jaz seeded 8 birthdays and 5 anniversaries as yearly recurring events, but the
calendar only shows the ones falling in the next ~2 months. When Jaz browses ahead to
plan (e.g., "when is Mom's birthday? what's coming in November?"), every yearly
occurrence within at least the next 12 months must already be on the calendar. Recurring
events on shorter cadences (weekly, monthly, etc.) keep appearing only a couple of
months ahead so the calendar and the mirrored Google Calendar don't flood with dozens of
routine occurrences per rule.

**Why this priority**: This is the reason the seed exercise looks broken — the household
put its real dates in and can't see most of them. Highest-visibility defect in the batch.

**Independent Test**: Seeded yearly rules exist in the system; after the generation run,
browse the calendar 6, 9, and 12 months ahead and confirm every yearly occurrence
appears (with correct ordinal titles where applicable), while a weekly rule still has no
occurrences beyond the short window.

**Acceptance Scenarios**:

1. **Given** a yearly recurring event whose next occurrence is 10 months away, **When**
   generation runs, **Then** that occurrence appears on the calendar (and in the Google
   Calendar mirror on its next sync).
2. **Given** a weekly recurring event, **When** generation runs, **Then** occurrences
   exist only within the existing short window (~60 days), not a year ahead.
3. **Given** generation already ran, **When** it runs again, **Then** no duplicate
   occurrences are created.
4. **Given** a yearly anniversary rule using the ordinal title token, **When** next
   year's occurrence is generated, **Then** its title shows next year's ordinal (e.g.
   "7th" after this year's "6th").
5. **Given** the deployed fix, **When** the one-time backfill generation is run,
   **Then** all seeded birthdays/anniversaries for the coming 12 months are on the
   calendar that same day (no waiting for the nightly run).

---

### User Story 2 - Saving a task or event feels instant (Priority: P1)

When Jaz adds or edits a task or event on her phone, the sheet currently stays open for
several seconds while the save round-trips to the backend. Instead, the sheet must close
immediately and the new/updated item must appear in place right away, with the save
completing in the background. If the background save fails, the change is rolled back
and a clear error message tells her the save didn't stick. One-tap actions (complete,
snooze, acknowledge, list flips) already behave this way and must not regress.

**Why this priority**: Slow saves are felt on every single add/edit — the highest-
frequency pain point in the batch.

**Independent Test**: On a real device, create a task from Quick Add and edit an event;
both sheets close with no perceptible wait and the item shows up immediately. Simulate a
failed save and confirm the item reverts and an error message appears.

**Acceptance Scenarios**:

1. **Given** Quick Add with valid input, **When** Jaz taps save, **Then** the sheet
   closes immediately and the new item is visible in the relevant views before the
   backend confirms.
2. **Given** an edit sheet with changes, **When** Jaz taps save, **Then** the sheet
   closes immediately and the item shows the updated values in place.
3. **Given** a background save that fails (offline, backend error), **When** the failure
   is known, **Then** the optimistic change is reverted and a visible error message
   explains the save failed.
4. **Given** a successfully synced create, **When** Jaz immediately opens the new item
   and edits it, **Then** the edit applies to the real saved item (no lost updates or
   phantom items).

---

### User Story 3 - The app behaves like an app on the phone (Priority: P2)

On Jaz's iPhone, the page zooms in when she focuses an input and can be pinch-zoomed
into a mess, and the bottom navigation sits so low that tapping it often triggers the
iOS home-indicator swipe instead. The app must not zoom (no pinch zoom, no input-focus
auto-zoom) and the bottom navigation must sit fully above the home-indicator area so
every tab is comfortably tappable.

**Why this priority**: Ergonomics rather than data visibility — but it's felt in every
session and is the difference between "web page" and "our app."

**Independent Test**: On an iPhone (or simulator), focus each form input — no zoom;
attempt pinch zoom — the layout doesn't scale; tap each bottom-nav tab repeatedly near
its bottom edge — navigation always wins over the system swipe.

**Acceptance Scenarios**:

1. **Given** any form input in the app, **When** it receives focus on iOS, **Then** the
   viewport does not zoom in.
2. **Given** any screen, **When** the user pinch-zooms, **Then** the layout does not
   scale.
3. **Given** an iPhone with a home indicator, **When** any bottom-nav tab is tapped,
   **Then** the tap lands on the tab (the nav bar is padded clear of the indicator zone
   and its background extends to the screen's bottom edge with no gap).
4. **Given** a device without a home indicator (desktop, older phones), **When** the nav
   renders, **Then** no excess dead space appears below it.

---

### User Story 4 - Tap a day on the dashboard strip to see that day (Priority: P2)

The dashboard's rolling 7-day strip currently deep-links into the calendar when a day is
tapped. Instead, tapping a day must reveal that day's events and tasks inline directly
below the strip, right on the dashboard — and that inline panel includes a link to open
the full calendar at that day for when more context is wanted. Tapping the same day
again (or a close control) collapses the panel; tapping a different day switches the
panel to it.

**Why this priority**: Turns the dashboard's most-glanced widget into an answer instead
of a redirect; a planning-flow improvement rather than a defect.

**Independent Test**: On the dashboard, tap a day tile — its items appear below the
strip without leaving the dashboard; the panel's calendar link lands on that day in the
calendar; tapping another tile switches the panel.

**Acceptance Scenarios**:

1. **Given** the dashboard, **When** Jaz taps a day tile on the 7-day strip, **Then**
   that day's events and tasks appear in a panel below the strip and she remains on the
   dashboard.
2. **Given** an open day panel, **When** she taps its "open in calendar" link, **Then**
   the calendar opens showing that day.
3. **Given** an open day panel, **When** she taps a different day tile, **Then** the
   panel switches to that day's items.
4. **Given** an open day panel, **When** she taps the same day tile again, **Then** the
   panel closes.
5. **Given** a day with no items, **When** its tile is tapped, **Then** the panel opens
   with a friendly empty state (not a blank area).
6. **Given** an item in the day panel, **When** it is tapped, **Then** it opens the same
   detail view it opens elsewhere in the app.

---

### User Story 5 - Snoozed items show up on the week strip (Priority: P2)

A task snoozed until Thursday currently vanishes from the dashboard's 7-day strip
entirely, so the week looks emptier than it is. Snoozed tasks must be counted and shown
on the strip (and in the new inline day panel) on their snoozed-until day, looking
identical to any other task that day.

**Why this priority**: Small change, but it makes the strip honest — the household's
at-a-glance week currently under-reports.

**Independent Test**: Snooze a task until a day within the next 7 days; its owner's dot
count on that day increases and it appears in that day's inline panel, styled like its
neighbors.

**Acceptance Scenarios**:

1. **Given** a task snoozed until a day within the strip's window, **When** the
   dashboard renders, **Then** that task is counted on that day exactly like an open
   task due that day.
2. **Given** a snoozed task shown on the strip or day panel, **When** compared to a
   normal task, **Then** there is no visual difference (explicitly clarified: identical
   styling).
3. **Given** a task snoozed beyond the 7-day window, **When** the dashboard renders,
   **Then** it does not appear on the strip.
4. **Given** the smart views and load-balance areas of the dashboard, **When** this
   change ships, **Then** their existing treatment of snoozed tasks is unchanged (only
   the 7-day strip and its day panel change).

---

### User Story 6 - The acknowledge UI looks like it belongs (Priority: P3)

The "not yet committed" badge and "I've got it" button (feature 019) read as bolted-on
and cramped, especially on the phone. Keep the concept and mechanics exactly as they are
— assigned tasks show an unacknowledged state, the assignee can commit with one tap, the
assigner is notified — but redesign the presentation on task cards, the dashboard, and
the task detail view so it sits cleanly within the app's calm visual language and meets
the same accessibility bar as the rest of the UI.

**Why this priority**: Pure presentation; mechanics already work.

**Independent Test**: View an unacknowledged assigned task on a phone-width screen: the
state reads clearly without crowding the card, the commit action is comfortably tappable,
and acknowledging still behaves exactly as before.

**Acceptance Scenarios**:

1. **Given** an unacknowledged task assigned to Jaz, **When** she views it on a
   phone-width screen, **Then** the uncommitted state and commit action are visually
   clean — no wrapping/overflow/crowding — and the tap target meets the app's touch-size
   floor.
2. **Given** the redesigned presentation, **When** Jaz commits to a task, **Then** the
   behavior (state change, notification to the assigner, dashboard notice) is unchanged
   from before.
3. **Given** the redesigned elements, **When** audited, **Then** they meet WCAG 2.1 AA
   contrast, as the rest of the app does.

---

### User Story 7 - The backend self-check can actually finish (Priority: P3)

The backend's full self-test suite now exceeds the platform's 6-minute execution limit,
so it dies partway and the later checks never run. Split it into a small number of
chunked runners, each finishing comfortably within the limit, that together cover
exactly the current suite. The existing targeted runners stay. A maintainer runs the
chunks in sequence and gets a clear per-chunk pass signal.

**Why this priority**: Maintainer-facing only, but it currently blocks verifying any
backend change end-to-end — including this feature's own item 1.

**Independent Test**: Run each chunk runner from the editor; each completes well under
the limit and reports pass; the union of chunks covers every check the old monolith ran.

**Acceptance Scenarios**:

1. **Given** the split runners, **When** each is run, **Then** each completes within the
   execution limit with time to spare and ends with an unmistakable pass message.
2. **Given** all chunks pass, **When** their coverage is compared to the old monolithic
   suite, **Then** every check from the monolith is present in exactly one chunk.
3. **Given** a failing check inside a chunk, **When** that chunk runs, **Then** it fails
   loudly at that check (same behavior as today).
4. **Given** the existing targeted runners (seed pack, session tokens), **When** the
   split lands, **Then** they still work unchanged.

---

### Edge Cases

- A yearly rule created today with an anchor 11 months out: its first occurrence must
  appear immediately after the next generation, not in 9 months.
- Backfill generation overlapping the nightly run: no duplicates (idempotency holds at
  the larger window).
- An optimistic create where the user navigates away (or closes the app) before the
  background save settles: the save still completes or the failure is surfaced on next
  load — no silently lost item.
- Two rapid optimistic edits to the same item: last-write state is consistent with what
  the user sees.
- Snoozed task whose snoozed-until day is today: counts on today's tile.
- Day panel open for a day whose items change (e.g., a task completed elsewhere): the
  panel reflects the current data.
- Zoom lock must not break accessibility affordances users rely on elsewhere (system
  text-size settings still apply; only viewport zoom is constrained).
- Devices without a home indicator must not get wasted dead space under the nav.
- A self-test chunk that grows over time: chunk boundaries should leave enough headroom
  that a modest number of added checks doesn't immediately re-break the limit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Recurring events with a yearly cadence MUST have occurrences generated at
  least 12 months ahead; all other cadences MUST keep the existing ~60-day generation
  window. (Recurring *tasks* are out of scope — their window is unchanged.)
- **FR-002**: The extended-window generation MUST remain idempotent (re-runs never
  duplicate occurrences) and MUST respect all existing rule semantics (seasonal windows,
  ordinal title tokens, attached prep templates — prep tasks generate exactly as they do
  today, whenever the occurrence is created).
- **FR-003**: A one-time regeneration after deploy MUST backfill the newly-in-window
  yearly occurrences the same day, without waiting for the nightly run.
- **FR-004**: Creating or editing a task or event MUST close the input sheet immediately
  and reflect the change in all visible views optimistically, before backend
  confirmation.
- **FR-005**: A failed background create/edit MUST revert the optimistic change and
  surface a clear, human-readable error message; a successful one MUST reconcile so the
  item's real identity/values replace the optimistic ones with no visible glitch and no
  lost follow-up edits.
- **FR-006**: Existing optimistic one-tap actions (complete, reopen, snooze, unsnooze,
  acknowledge, list-item flips) MUST retain their current instant behavior.
- **FR-007**: The app MUST NOT zoom on mobile: no pinch-zoom scaling and no automatic
  zoom when inputs receive focus on iOS. System-level text sizing MUST remain effective.
- **FR-008**: The bottom navigation MUST respect the device safe area: on devices with a
  home indicator every tab is fully tappable above the indicator zone, the nav's
  background extends to the physical bottom edge with no gap, and devices without an
  indicator see no added dead space.
- **FR-009**: Tapping a day on the dashboard's 7-day strip MUST reveal that day's events
  and tasks inline below the strip (staying on the dashboard). The panel MUST include a
  link opening the full calendar at that day; tapping another day switches the panel;
  tapping the open day again closes it; an empty day shows an explicit empty state;
  items open their standard detail views.
- **FR-010**: The 7-day strip and its inline day panel MUST include snoozed tasks on
  their snoozed-until day, styled and counted identically to other tasks. Other
  dashboard surfaces are unchanged.
- **FR-011**: The acknowledge presentation ("not yet committed" state and the commit
  action) MUST be redesigned across task cards, the dashboard, and the task detail view
  — mechanics, data, and notifications unchanged — meeting the app's existing touch-target
  and WCAG 2.1 AA standards on phone-width screens.
- **FR-012**: The backend self-test suite MUST be split into a small number of public
  chunked runners, each completing comfortably within the 6-minute execution limit, whose
  union covers exactly the current monolithic suite; each ends with a distinct pass
  message. Existing targeted runners are preserved.
- **FR-013**: All existing behavior not named above MUST be preserved; in particular the
  Google Calendar mirror keeps working for the newly generated yearly occurrences with
  no duplicate mirror events.

### Key Entities

- **Recurring event rule**: an existing entity; gains no new fields. Its generation
  horizon now depends on its cadence class (yearly vs. everything else).
- **Event occurrence**: existing entity; yearly ones now exist up to 12+ months before
  their date. Deleting or hand-editing an occurrence behaves exactly as today.
- **Snoozed task**: existing entity/state; newly *visible* on the dashboard week strip
  via its snoozed-until date. No data change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the seeded yearly birthdays/anniversaries for the next 12 months
  are visible on the calendar on the day the fix is deployed.
- **SC-002**: Creating or editing a task/event returns control to the user in under
  0.3 seconds perceived (sheet closed, item visible), versus multiple seconds today.
- **SC-003**: Zero instances of viewport zoom during a full pass of every form in the
  app on iOS.
- **SC-004**: Every bottom-nav tab is tappable on first attempt on a home-indicator
  iPhone — no accidental app-switcher/home gestures triggered by nav taps.
- **SC-005**: From the dashboard, the contents of any of the next 7 days are readable
  within one tap, without leaving the dashboard.
- **SC-006**: The week strip's counts equal the true number of open + snoozed items per
  day (verified against the raw data for a seeded week).
- **SC-007**: Every backend self-check runs to completion: each chunk finishes in under
  4 minutes, and the union of chunks equals the old suite's coverage.
- **SC-008**: The redesigned acknowledge UI passes the app's standard accessibility
  audit (WCAG 2.1 AA contrast, touch-target floor) with no regressions in acknowledge
  behavior (all existing acknowledge tests still pass).

## Assumptions

- "12+ months" is satisfied by a 366-day generation window for yearly cadences; the
  short window stays at its current default (~60 days) for all other cadences. Both
  remain overridable via the existing settings mechanism.
- The yearly-window extension applies to recurring **events** only; recurring **tasks**
  keep their existing ~30-day window (nobody wants a year of chore instances).
- Google Calendar mirroring of a year of birthdays/anniversaries (~13 additional all-day
  events) is acceptable volume; weekly/monthly rules are excluded from the long window
  precisely to keep mirror volume bounded.
- Optimistic create/edit covers tasks and events (Quick Add and the edit sheets).
  Recurring-rule, template, list, and settings management screens are lower-frequency
  admin surfaces and keep their current save behavior unless trivially included.
- Disabling viewport zoom is an accepted trade-off for app-like feel (Jaz's explicit
  request); preventing input-focus auto-zoom must not rely on shrinking text below
  readable sizes.
- The inline day panel replaces the strip's current deep-link-to-calendar behavior (the
  link inside the panel is the new path to the calendar); the calendar's own views are
  untouched.
- "Comfortably within the limit" for self-test chunks means a target of roughly ≤4
  minutes per chunk at today's suite size, leaving headroom for growth.
- Notification quality/delivery is out of scope — feature 010 (PWA + web push) is next
  in the queue and owns it.
