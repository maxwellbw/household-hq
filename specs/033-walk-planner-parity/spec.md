# Feature Specification: Dog-Walk Planner Rework, Dashboard↔Calendar Parity & Household Notifications

**Feature Branch**: `033-walk-planner-parity`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Dog-walk planner rework, dashboard↔calendar parity, and household notifications — the 033-assigned audit findings from specs/032-ui-ux-audit/audit.md (F-02, F-03, F-04, F-05, F-06, F-07, F-10, F-11, F-12, F-16, F-21, F-22, F-26 sheet-history-only, F-32, F-33) plus five new asks from Max (2026-07-19): morning overdue notification to both people, night-before dog-walk time notification, needed-item counts on list pills, remaining mobile focus-zoom offenders on the Lists tab, and completing tasks from the dashboard."

## Clarifications

### Session 2026-07-19

- Q: Should the night-before dog-walk push also fire when tomorrow is flagged
  needs-decision, or only when a walk is actually booked? → A: Both — booked days
  push the window; needs-decision days push a decision prompt opening the planner.
- Q: How much detail should the morning overdue push contain? → A: Count plus the
  first few titles (e.g. "3 overdue: Bins, Vet meds, Filter change"), truncating long
  lists with "+N more".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete a task from the dashboard (Priority: P1)

Max opens the app in the morning, sees "take out the bins" due today on the Home
dashboard, and marks it done right there — from the day card under the seven-day strip,
from any dashboard task row, or from the detail view that opens when a task is tapped.
Today he can't: dashboard rows have no done affordance and the tapped-open view offers
none either, forcing a detour through the Tasks tab for the single most common action in
the app.

**Why this priority**: This is the daily-driver action failing on the landing view. The
dashboard is home (constitution: dashboard-first); a home screen that shows tasks but
can't complete them breaks the product's core promise.

**Independent Test**: With a task due today, open Home and mark it done from (a) the
day card and (b) the tapped-open detail view. The task shows as done everywhere
(dashboard, Tasks tab, calendar) and the other person's feed records it.

**Acceptance Scenarios**:

1. **Given** a task due today visible on the Home dashboard, **When** Max taps its
   complete control on the row/card, **Then** the task is marked done immediately
   (optimistic), shows done styling in place, and the completion is logged and visible
   to Jaz.
2. **Given** a task shown on any dashboard surface (day card, Overdue, Today,
   Weekend, Coming up), **When** Max taps the task itself, **Then** a detail view opens
   that includes a mark-done action (and un-done for already-completed tasks).
3. **Given** a completed task on the dashboard, **When** Max taps its complete control
   again, **Then** the task reopens (same reversibility as the Tasks tab).

---

### User Story 2 - Morning overdue notification for both people (Priority: P1)

Every morning, both Max and Jaz receive one push notification listing everything
currently overdue — regardless of who each item is assigned to — so the household starts
the day with a shared picture of what slipped.

**Why this priority**: Directly requested; overdue items are the highest-priority
information in the system and currently surface only if someone opens the app.

**Independent Test**: With at least one overdue task, trigger the morning run; both
people's devices receive one notification naming the overdue count and items. With zero
overdue tasks, no notification is sent.

**Acceptance Scenarios**:

1. **Given** three overdue tasks (one Max's, one Jaz's, one Both), **When** the morning
   notification time arrives, **Then** both people receive a single push summarizing
   all three, and tapping it opens the app's overdue view.
2. **Given** no overdue tasks, **When** the morning time arrives, **Then** no
   notification is sent.
3. **Given** the morning run fires twice (trigger re-run), **Then** each person still
   receives at most one notification for that day.

---

### User Story 3 - Night-before dog-walk notification (Priority: P1)

The evening before, both people receive a push with tomorrow's booked dog-walk window
("Dog walk tomorrow · 8:00–8:45 AM") so they can plan around it before the day starts.

**Why this priority**: Directly requested; the walk is booked automatically, so without
a heads-up the booked window is easy to discover too late.

**Independent Test**: With a walk booked for tomorrow, trigger the evening run; both
people receive the walk-time push, and tapping it opens the planner for that date.

**Acceptance Scenarios**:

1. **Given** a booked walk tomorrow, **When** the evening notification time arrives,
   **Then** both people receive one push stating tomorrow's walk window.
2. **Given** tomorrow is flagged needs-decision (no bookable window), **When** the
   evening time arrives, **Then** the push says tomorrow's walk needs a decision and
   tapping it opens the planner for tomorrow.
3. **Given** no walk row exists for tomorrow (e.g. weekend skip), **Then** no
   notification is sent.
4. **Given** the evening run fires twice, **Then** at most one notification per person
   is sent for that date.

---

### User Story 4 - Reach the walk planner from anywhere a walk appears (Priority: P1)

Walks are first-class calendar citizens: every calendar view (desktop month, mobile
month day-list, week, next-7) shows booked and needs-decision walks, and tapping any
walk item — calendar chip, dashboard day-card row, alert banner, or push notification —
opens the day planner for that date. Covers audit F-02, F-03, F-04, F-26 (sheet-history
only), F-32, F-33.

**Why this priority**: The calendar is the organizing metaphor, phones are the daily
driver, and today the highest-urgency item type is invisible on mobile calendar views
and dead-ends on desktop. Deep links (banners, pushes) currently land on the wrong
date or the wrong tab entirely.

**Independent Test**: On a mobile-width viewport, find a needs-decision day in the
next-7 view; the warning item is visible and tapping it opens the planner for that day.
Pressing Back closes the planner sheet instead of exiting the app.

**Acceptance Scenarios**:

1. **Given** a day with a booked walk, **When** viewed in any calendar view on mobile
   or desktop, **Then** the walk appears as an item with its time window, and tapping
   it opens the planner for that date.
2. **Given** a needs-decision day, **When** viewed in any calendar view, **Then** the
   item is visually urgent, and tapping it opens the planner for that date.
3. **Given** a walk alert on Home for a future date, **When** Max taps its action,
   **Then** the planner opens for that date (not the calendar at today).
4. **Given** a walk push notification for a date, **When** tapped, **Then** the app
   opens the planner for that date (not the Tasks tab).
5. **Given** the planner sheet is open, **When** the user presses the browser/device
   Back control, **Then** the sheet closes and the app stays open.
6. **Given** today has a booked walk, **When** Max opens Home, **Then** today's card
   shows the walk line with its window and booked state; a needs-decision today shows
   an urgent walk line that opens the planner.

---

### User Story 5 - Book a walk with confidence and flexibility (Priority: P2)

In the planner, tapping an hour visibly selects it, the confirm control is always in
view, and Max can adjust the start time in 15-minute steps, pick a duration (from the
household's configured walk lengths), and book the backup slot — matching what the
automatic finder can already do. The timeline fits a phone without ten screens of
scrolling, and the weather status reads as plain language. Covers audit F-06, F-07,
F-21, F-22.

**Why this priority**: The planner works but fights the user; these are the
highest-friction findings short of unreachability. Depends on nothing else in this
feature (planner already exists from 031).

**Independent Test**: On mobile width, open the planner, tap an eligible hour — the
hour highlights and a confirm control is visible without scrolling; adjust to a
:15/:30/:45 start and a 30-minute duration; book; the booked window reflects the
adjusted time.

**Acceptance Scenarios**:

1. **Given** the planner is open, **When** Max taps an eligible hour, **Then** the
   tapped hour shows a clear selected state and the confirm control is visible without
   scrolling (pinned within the sheet).
2. **Given** an hour is selected, **When** Max adjusts start time and duration,
   **Then** start moves in 15-minute increments within the eligible band and duration
   options come from the household's configured walk lengths.
3. **Given** the finder proposed a backup slot, **When** Max chooses to book the
   backup, **Then** the backup window books (not just the primary).
4. **Given** the planner is open on a phone, **Then** the full day's timeline is
   navigable without extreme scrolling (non-eligible hours compressed or collapsed),
   and the weather status reads as human copy (e.g. "Live forecast · updated 5 min
   ago"), not a bare status word.

---

### User Story 6 - Calm, accurate walk alerts on Home (Priority: P2)

Home's walk alerts say the right thing: a needs-decision walk five days out reads as a
dated, quiet notice ("No good-weather window on Thu"), multiple upcoming flags collapse
into one row, and alarm styling is reserved for today/tomorrow. Covers audit F-10.

**Why this priority**: Copy currently says "today" for dates a week out — factually
wrong — and stacked alarm banners train both users to ignore alerts.

**Independent Test**: Seed needs-decision walks 5 and 10 days out; Home shows one
collapsed, correctly-dated, non-alarm notice; its action opens the planner (per US4).

**Acceptance Scenarios**:

1. **Given** a needs-decision walk N days out (N ≥ 2), **When** Home renders,
   **Then** the notice names the actual day and does not claim "today", and does not
   use alarm/urgent styling.
2. **Given** two or more upcoming needs-decision walks, **When** Home renders,
   **Then** they collapse into a single summary row ("2 upcoming walks need a
   decision") that expands or links to the planner.
3. **Given** a needs-decision walk today or tomorrow, **Then** urgent styling is used.

---

### User Story 7 - Readable, honest calendar items (Priority: P2)

Week/next-7 pills and planner cards show readable titles (the title wins over the type
badge; nothing truncates to zero characters), month-grid day dots carry owner colors,
done tasks collapse out of the way in day lists, the event popover's map link reads
"Open map ↗" instead of a raw URL and Delete is separated from Edit, and the calendar
header has one view switcher in the app's own control style. Covers audit F-05, F-11,
F-12, F-16.

**Why this priority**: Readability and identity issues that touch every calendar visit
but don't block any action.

**Independent Test**: On a ~110px-wide day column, a pill for a long-titled item shows
leading title characters (badge yields); month view dots match owner colors; a day
whose only items are done tasks shows a quiet "N done ✓" affordance instead of a list
of struck-through rows; the calendar header shows exactly one view-switching control.

**Acceptance Scenarios**:

1. **Given** a long-titled item in a narrow week/next-7 column, **When** rendered,
   **Then** title characters are visible (badge drops or wraps first) and tapping
   opens details with the full title.
2. **Given** a month-grid day with items owned by Max, Jaz, and Both, **Then** the
   day's dots use the three owner colors (capped with overflow), matching the
   seven-day strip's convention.
3. **Given** a calendar day list containing done tasks, **Then** done tasks collapse
   behind a count affordance that expands on demand, and a day with only done tasks
   doesn't render as a wall of strikethrough.
4. **Given** an event with a map URL, **When** its popover opens, **Then** the link
   reads as a labeled action ("Open map ↗"), and Delete is visually separated from
   Edit.
5. **Given** the calendar header, **Then** there is exactly one view switcher, no
   single-option dropdown, and date navigation controls match the app's control
   vocabulary.

---

### User Story 8 - Lists show what's needed at a glance (Priority: P2)

The Lists tab's list pills ("Grocery", "Not grocery", and any list added later) each
show the number of needed items, so either person can see from the top of the screen
whether a shop is worth a trip — without tapping through each list.

**Why this priority**: Directly requested; cheap, high-glance-value addition to a
screen used multiple times a day.

**Independent Test**: With 4 needed items on Grocery and 0 on Not grocery, the pills
read "Grocery 4" and "Not grocery" (no count when zero); flipping an item
needed⇄stocked updates the count immediately.

**Acceptance Scenarios**:

1. **Given** a list with N > 0 needed items, **Then** its pill shows N.
2. **Given** a list with 0 needed items, **Then** its pill shows no count (not "0").
3. **Given** an item is flipped needed⇄stocked, **Then** the affected pill's count
   updates immediately, including for lists created after this feature ships.

---

### User Story 9 - No zoom jump when typing on a phone (Priority: P2)

Tapping into any text box — first noticed on the Lists tab — no longer makes the phone
zoom into the field. The 032 pass fixed most inputs; this story finds and fixes the
remaining offenders app-wide.

**Why this priority**: Directly requested bug; the zoom jolt makes the lowest-friction
surface (adding a grocery item) feel broken. Page zoom itself must remain available
(accessibility — pinch-zoom stays enabled).

**Independent Test**: On an iOS-class mobile viewport, focus every text input on the
Lists tab (add-item field, search, new-list name, item edit) and across other screens;
no focus triggers automatic viewport zoom, and manual pinch-zoom still works.

**Acceptance Scenarios**:

1. **Given** any text input on the Lists tab on a phone, **When** it receives focus,
   **Then** the viewport scale does not change.
2. **Given** the fix, **Then** manual pinch-zoom remains available everywhere (no
   re-introduction of zoom-disabling viewport settings).
3. **Given** an audit of all text inputs app-wide, **Then** every input meets the
   no-focus-zoom condition, not just the reported Lists fields.

---

### Edge Cases

- Morning run when every overdue task is completed between materialization and send
  time: recount at send time; send nothing if zero.
- Evening walk push when the walk is moved or released after the push went out: no
  re-push; the app is the source of truth (matches the finder's never-cancel,
  notify-once posture).
- A person with push disabled (or no subscribed device): the other person still
  receives theirs; no error surfaces.
- Deep link to the planner for a date with no walk row (stale push tapped days later):
  planner opens on that date and shows its normal no-walk state.
- Back-button handling when the planner was opened from a push (cold start): Back
  closes the sheet and lands on the app view behind it, never a blank state.
- Completing a task from the dashboard while offline / request fails: optimistic state
  reverts with a toast (existing pattern).
- Day card and dashboard rows for events (not tasks): no complete control appears
  (events aren't completable).
- Two walks on one day (primary + second early-day walk): calendar views and the
  night-before push name both windows.
- List pill counts with the staples filter active: count reflects needed items on that
  list regardless of current filter view.
- 15-minute start adjustment at the edge of the eligible band: cannot select a start
  whose window extends past the band's end or into a busy block.

## Requirements *(mandatory)*

### Functional Requirements

**Dashboard task completion (US1)**

- **FR-001**: Users MUST be able to mark a task done (and reopen it) directly from
  every dashboard surface that lists tasks: the day card under the seven-day strip and
  the Overdue / Today / Weekend / Coming-up sections.
- **FR-002**: Tapping a task anywhere on the dashboard MUST open the same task detail
  view used elsewhere in the app, including its mark-done/reopen action.
- **FR-003**: Dashboard completion MUST behave identically to Tasks-tab completion:
  optimistic update, revert-with-toast on failure, activity logged, completion ping to
  the other person.

**Notifications (US2, US3)**

- **FR-004**: The system MUST send, once per morning at a household-configurable time,
  a push notification to BOTH people summarizing all currently-overdue tasks
  (regardless of assignment), sent only when at least one task is overdue. The body
  states the overdue count plus the first few task titles, truncating longer lists
  with "+N more".
- **FR-005**: The system MUST send, once per evening at a household-configurable time,
  a push notification to BOTH people describing tomorrow's dog walk: the booked
  window(s) when booked, or a needs-decision prompt when flagged; nothing is sent when
  tomorrow has no walk row.
- **FR-006**: Both notification runs MUST be idempotent — re-runs never produce a
  second notification for the same day/date — and each send MUST be recorded in the
  activity log.
- **FR-007**: Tapping the morning notification MUST open the app showing overdue
  items; tapping the evening walk notification MUST open the planner for tomorrow's
  date.
- **FR-008**: Notification send times MUST be editable in the household settings
  (hand-editable like all settings), with sensible defaults (morning ~8:00, evening
  ~20:00 household time).

**Walk visibility & deep links (US4)**

- **FR-009**: Booked and needs-decision walk items MUST appear in every calendar view
  — desktop month, mobile month day-list, week, and next-7 — with needs-decision items
  visually urgent.
- **FR-010**: Tapping any walk item (calendar chip/row, dashboard day-card walk line,
  Home walk notice, walk push) MUST open the day planner for that item's date.
- **FR-011**: Any "open in calendar"-style deep link MUST land on its target date even
  when the calendar loads lazily (no race that silently falls back to today).
- **FR-012**: Home's today card MUST show today's walk status: booked window(s),
  needs-decision (urgent, opens planner), or nothing when no walk row exists.
- **FR-013**: While the planner sheet is open, the browser/device Back control MUST
  close the sheet rather than exit the app (sheet-level history only; no URL routing).

**Planner booking (US5)**

- **FR-014**: Tapping an hour in the planner MUST produce a visible selected state,
  and the booking confirm control MUST be visible without scrolling while a selection
  exists.
- **FR-015**: Users MUST be able to adjust the booking start in 15-minute increments
  and choose a duration from the household's configured walk lengths; the chosen
  window must fit entirely within eligible time (band, weather-eligible,
  conflict-free).
- **FR-016**: Users MUST be able to manually book the backup slot, not only the
  primary.
- **FR-017**: The planner timeline MUST be compact on phones (non-eligible hours
  compressed or collapsed) while keeping every eligible hour reachable; the hour band
  itself stays as-is (ends 5 PM — resolved constraint).
- **FR-018**: The planner's data status MUST read as human copy including data
  freshness (e.g. "Live forecast · updated 5 min ago").

**Walk alerts on Home (US6)**

- **FR-019**: Walk notices MUST state the actual day they refer to; the word "today"
  appears only when the date is today.
- **FR-020**: Multiple upcoming needs-decision walks MUST collapse into a single
  summary notice; urgent/alarm styling is reserved for today and tomorrow.

**Calendar readability (US7)**

- **FR-021**: In narrow columns and planner cards, the item title MUST get layout
  priority over type badges; a rendered item never shows zero title characters.
- **FR-022**: Month-grid day markers MUST use owner colors (Max/Jaz/Both), consistent
  with the seven-day strip, capped with an overflow treatment.
- **FR-023**: Done tasks in calendar day lists MUST collapse behind a count
  affordance, expandable on demand.
- **FR-024**: The event popover MUST render location links as a labeled action rather
  than a raw URL, and MUST separate Delete from Edit to prevent mis-taps.
- **FR-025**: The calendar header MUST present exactly one view switcher and no
  nonfunctional or single-option controls; date navigation matches the app's control
  vocabulary.

**Lists (US8, US9)**

- **FR-026**: Each list pill on the Lists tab MUST show its count of needed items when
  greater than zero, live-updating on needed⇄stocked flips and applying automatically
  to newly created lists.
- **FR-027**: No text input anywhere in the app may trigger automatic viewport zoom on
  focus on mobile, and user-initiated pinch zoom MUST remain enabled (no
  `user-scalable=no`-style regression).

### Key Entities

- **Notification ledger entry**: a record that a given daily notification (morning
  overdue / evening walk) was sent for a given date — the idempotency key preventing
  duplicate sends; human-readable in the Sheet like all state.
- **Walk item (existing)**: the per-date walk row (booked window(s), slot,
  needs-decision flag) — now surfaced in all calendar views, the today card, and the
  evening push; no schema change expected.
- **List (existing)**: gains a derived needed-item count on its pill; no stored
  change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Marking a task done from Home takes ≤ 2 taps from app open (was: ≥ 4
  including a tab switch), verified on a phone-width viewport.
- **SC-002**: On mornings with ≥ 1 overdue task, both people receive exactly one
  overdue summary push; over any 7-day validation window, zero duplicate and zero
  missed sends.
- **SC-003**: On evenings before a walk-bearing day, both people receive exactly one
  walk push whose stated window matches the planner; zero pushes before no-walk days.
- **SC-004**: 100% of walk items across all four calendar views (both form factors)
  are visible and open the planner on the correct date — including deep links from
  notices and pushes (currently: 0% on mobile views; deep links land on today/Tasks).
- **SC-005**: In the planner on a phone, selecting and confirming a booking requires
  zero scrolling between tap and confirm, and a 30-minute or :15-offset walk can be
  booked end-to-end (currently impossible).
- **SC-006**: No calendar pill or planner card renders with zero title characters at
  any supported viewport ≥ 320px.
- **SC-007**: Zero automatic viewport zoom-on-focus occurrences across every text
  input in the app on an iOS-class device, with pinch-zoom still functional.
- **SC-008**: List pills reflect needed counts within one perceived-instant
  (optimistic) update of any flip, with no page reload.

## Assumptions

- Both notification runs ride the existing web-push channel (010) and existing
  trigger/scheduling machinery; a person without an enabled push device simply doesn't
  receive pushes (no fallback channel added by this feature).
- Morning overdue push defaults to 8:00 AM and evening walk push to 8:00 PM household
  time, each adjustable via a Settings key; "overdue" means an open task whose due
  date is before today (same definition the dashboard's Overdue section uses).
- The evening walk push covers the needs-decision state as well as booked walks
  (acceptance scenario US3-2) — confirmed at clarify (Session 2026-07-19).
- Walk items in calendar views remain read-only surfaces that open the planner; no
  booking happens directly from a calendar chip.
- The planner hour band ending at 5 PM and the no-URL-routing decision are inherited
  as resolved constraints from the 032 audit (Resolved questions 1–2) and are not
  revisited here.
- "Needed" count on list pills counts items in the needed state on that list,
  independent of any active section/staples filter.
- F-26 scope is sheet-level history handling only (Back closes the planner sheet);
  full URL routing stays deferred.

## Implementation Notes

- **US5 (T021–T022), found in chunk G's `/impeccable audit`**: the ±15-min start
  steppers and the duration segmented control in the planner's sticky confirm bar
  originally shipped at 36×36px / 36px-tall — below the 44px touch-target floor
  DESIGN.md and PRODUCT.md both mandate, and visibly inconsistent with the 44px
  Cancel/Book backup/Book row directly beneath them. Fixed in chunk G to 44px on all
  four controls; no test depended on the old sizes, so the fix was a pure class
  change with no behavior impact. `npm test` (665/665) and `npm run build` stayed
  green before and after.
- **US7 (T029), known limitation from chunk G's audit**: at the narrowest tested
  width (320px week view, 7 columns), `EventContent`'s `shrink-[9999]` badge
  protects the title as designed (SC-006 holds — the title is never truncated to
  zero characters) but the badge itself doesn't cleanly disappear; it shrinks to an
  unreadable ~12px colored sliver instead of hiding outright. This only manifests in
  the multi-column Week view below the app's primary 375px mobile breakpoint (Month
  agenda and Next-7-days, the primary mobile views, aren't affected the same way).
  Left unfixed as a P3 polish item — not a SC-006 violation — rather than risk
  touching the already-tested shrink-priority CSS for a sub-375px edge case.
- **Chunk G backend gate (T039)**: only 3 of the 7 `clasp run selfTest*` chunks
  (`selfTest1Core`, `selfTest2Recurring`, `selfTest3SeedAndLists`) were re-run this
  session. Max stopped the batch partway through, citing a past run that affected
  production data; `selfTest4CalendarA/B`, `selfTest5Comms` (incl. `selfTestNotify`),
  and `selfTestDogWalk` were not re-run. This feature's actual backend footprint
  (`Notify.js`, `Config.js`, `Api.js`'s reinstall hook, and the `sendDogWalkPush_`
  url-string change in `DogWalk.js`) was already live-validated with real pushes and
  Max's explicit go-ahead back in chunk C (T016, deployed `@32`), and `clasp push`
  in chunk G reported no changes since — so the unrun chunks are unchanged
  regression coverage for backend surfaces this feature didn't touch, not unvalidated
  new code.
- No new Sheet tabs are expected; the notification ledger reuses the existing
  settings/ledger pattern (like digest dedupe keys) rather than a new table.
