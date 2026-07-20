# Research — Feature 033

## R1 — iOS focus-zoom root cause (US9 / FR-027)

**Decision**: make the coarse-pointer 16px rule win over Tailwind text-size utilities
with `font-size: 16px !important` inside the existing `@media (pointer: coarse)` block
(and de-duplicate the two identical blocks currently in `index.css` — lines ~130 and
~189 — into one), then sweep every `<input>`/`<select>`/`<textarea>` for `text-sm`/
`text-xs` utilities and remove the now-dead size utilities on touch-relevant controls.

**Rationale**: verified in source — `index.css` sets `input, select, textarea
{ font-size: 16px }` under `pointer: coarse` (added in 028, kept in 032 when
`maximum-scale=1` was removed for WCAG 1.4.4), but it's an element selector
(specificity 0,0,1). The Lists add-item, search, and new-list-name inputs all carry
Tailwind `text-sm` (class, 0,1,0), which outranks it → 14px on focus → iOS auto-zoom.
This is exactly the "some text boxes" symptom: only inputs with an explicit text-size
utility zoom. `!important` inside one narrowly-scoped media query is the boring,
future-proof fix (a newly added `text-sm` input can never regress it); the sweep keeps
the stylesheet honest.

**Alternatives considered**: (a) removing `text-sm` everywhere with no `!important`
backstop — regresses the first time anyone adds a sized input; (b) a Tailwind plugin
emitting `min-font-size` — no such CSS property, and clever where boring works;
(c) re-adding `maximum-scale=1` — rejected, WCAG 1.4.4 regression (F-39).

## R2 — Notification architecture (US2, US3 / FR-004..008)

**Decision**: new `backend/Notify.js` with two public trigger handlers —
`sendMorningOverduePush()` and `sendEveningWalkPush()` — plus one idempotent public
installer `installNotifyTriggers()` (delete-then-create, one daily trigger each at
`morningOverduePushHour` / `eveningWalkPushHour`). Each handler: read Settings, check
its hour gate is plausible (trigger already fires at the right hour; no extra gate
needed beyond dedupe), compute payload, then **check-send-log under `LockService`**
exactly like `Digests.sendOne_`: dedupe key is an ActivityLog row with action
`notify-overdue` / `notify-walk` and targetId = the household date (`YYYY-MM-DD`).
Send via the existing `sendPushToPerson_('max', …)` + `sendPushToPerson_('jaz', …)`
(guaranteed-never-throw, prunes dead subscriptions, logs per-person fan-out).

**Rationale**: `Digests.js` already solved every hard part of this shape (daily
trigger, re-run dedupe via ActivityLog natural key, lock around check-then-send,
Settings-driven hour, installer re-run on settings change) and it's been live since
008. Two separate triggers beat one hourly poller: fewer wasted wakeups, and each
handler stays single-purpose/debuggable.

**Overdue definition**: mirror `frontend/src/lib/dashboard.ts` exactly — status
`open` (snoozed excluded) AND non-empty dueDate AND `dueDate < today` in household
timezone. Backend restates this in `Notify.js` with a comment pointing at the
frontend selector so the two can't silently diverge without a trail.

**Content**: morning body = `"N overdue: title1, title2, title3 +K more"` (first 3
titles, each truncated via the existing `truncateTitle_` pattern; clarified
2026-07-19). Evening body = booked: `"Dog walk tomorrow · 8:00–8:45 AM"` (both
windows listed when a second walk exists); needs-decision: `"Tomorrow's walk needs a
decision"`. Times formatted with `Utilities.formatDate` in household timezone.

**Settings**: `morningOverduePushHour` (default `8`), `eveningWalkPushHour` (default
`20`) added to `DEFAULT_SETTINGS`-equivalent seed + `EDITABLE_SETTINGS`; the
`settings.update` action reinstalls the notify triggers when either changes (same
mechanism `digestHour` already uses). Settings screen gains the two fields (020's
editor pattern).

**Alternatives considered**: (a) Script Properties ledger — rejected, ActivityLog is
the established, Sheet-visible dedupe home (constitution II/VI); (b) one combined
morning digest push — rejected, the two sends have different times and audiences of
attention; (c) reusing email digests — the ask is push, not email.

## R3 — Push deep-link URL params (FR-007, FR-010 / F-33)

**Decision**: extend the existing `?task=<id>` param contract with `?walk=<YYYY-MM-DD>`
(evening push, and `sendDogWalkPush_`'s existing needs-decision pushes switch to it)
and `?overdue=1` (morning push). `sw.js` needs no change (it passes the notification's
`url` through to `openWindow`/postMessage already). `lib/deeplink.ts` generalizes from
`onTaskId` to a small parsed union (`{kind: 'task'|'walk'|'overdue', …}`), strips the
param via `replaceState` as today, and `App.tsx` routes: task → Tasks tab (unchanged),
walk → open planner sheet on that date, overdue → Home (Overdue region is the top of
the dashboard, so landing there IS the overdue view).

**Rationale**: matches the 010 contract exactly (one query param, consumed once);
sheet-level navigation without URL routing per the F-26 resolution.

## R4 — App-level planner hosting (FR-010, FR-013 / F-02, F-04, F-33)

**Decision**: lift `DogWalkPlanner` open-state from `DashboardHome` to `App`
(`walkPlannerDate: string | null`), render the sheet at App level, and pass
`openWalkPlanner(date)` down to Home (day-card walk rows, walk notices) and Calendar
(walk chip taps). The planner needs only `dateKey` + `timezone` (from `useSettings`),
both available in App.

**Rationale**: three entry points (dashboard, calendar, push deep link) now need to
open the same sheet; hosting it where all three routes converge avoids duplicated
sheet state per tab and makes the push deep link work regardless of active tab.

**F-04 fix**: `calendarFocusDate` moves from "clear via effect on tab switch" (races
the lazy mount and loses) to the proven consume-on-mount callback pattern MoreView
already uses (`initialSubscreen` + `onConsumedInitialSubscreen`): CalendarHome gets
`focusDate` + `onConsumedFocusDate`, calls the latter in its own mount effect after
seeding Schedule-X's `selectedDate`. The clearing effect in App is deleted.

**F-26/FR-013 (Back closes the sheet)**: on planner open, `history.pushState({hqSheet:
'planner'})`; a `popstate` listener closes the sheet; closing via ✕/scrim calls
`history.back()` when its own state is on top (guarded so a cold-start deep link that
lands directly on the planner still has a sane behind-state). Implemented as a tiny
`useSheetHistory(open, onClose)` hook scoped to the planner per the audit resolution —
not generalized to all 9 dialogs in this feature.

## R5 — Walk items in the bespoke calendar views (F-03) and clickable chips (F-02)

**Decision**: `CalendarHome` already builds `dogWalkItems`/`dogWalkFlagItems` for the
Schedule-X month grid; the bespoke `DayListView`/`DayColumn` (week & next-7 & mobile
month day-list) source from a different bucket builder that omits them. Extend the
shared bucketing to include walk items (kind `dogwalk`/`dogwalk-flag`), rendered via
the same row/pill components with the 🐾/⚠️ vocabulary the seven-day strip already
uses, and give every walk chip/row an onClick → `openWalkPlanner(date)` (replacing the
current no-op documented in `CalendarHome`'s `onEventClick` for `dogwalk-` ids and the
dead desktop month pill).

**Rationale**: single source for "what's on this day" is the 028 lesson
(`itemsForDay` keeps strip and panel agreeing); walks join the same discipline.

## R6 — Planner booking UX (F-06, F-07, F-22, F-21)

**Decision** (frontend-only; `bookWalkManually_` already accepts arbitrary
`windowStart/windowEnd/durationMin` and a `slot` field, and `dogwalks.day` already
returns `primaryDurationsMin`/`secondDurationMin` per the 031 contract deviation):

- **Selection + pinned confirm (F-06)**: selected hour gets a filled/outlined
  selected state (token vocabulary, not new colors); the confirm bar becomes
  `sticky bottom-0` inside the sheet's scroll container, appearing whenever
  `pendingBook` exists; tapping an hour also `scrollIntoView`s nothing (the bar is
  always visible by construction).
- **Start/duration adjust (F-07)**: once an hour is tapped, the confirm bar grows
  −15/+15 start steppers and a duration segmented control seeded from
  `primaryDurationsMin` (or `secondDurationMin` for the second slot); the client
  pre-validates the adjusted window against the day plan's busy blocks + hourly gates
  (both already in the `dogwalks.day` payload) and disables Confirm with a reason
  when it doesn't fit; the backend remains the final validator (its existing
  override-confirmation flow covers the edge).
- **Backup slot (F-07)**: when the day plan has a backup candidate, the confirm bar
  (or the backup card itself) offers "Book backup" wiring `slot: 'backup'` — the
  hardcoded `'primary'` goes away.
- **Compact timeline (F-22)**: hours where every 15-min window is ineligible
  (gate-failed or busy) render at a compressed height (single collapsed band with an
  expand affordance at the band edges); `PX_PER_MIN` stays for eligible hours.
- **Status copy (F-21)**: `"Live weather."` → `"Live forecast · updated N min ago"`
  (freshness from the day plan's cache timestamp; falls back to `"Cached forecast ·
  from HH:MM"` on cache fallback).

**Alternatives considered**: draggable window handles — rejected for this pass
(touch-drag on a dense timeline is fiddly; steppers are boring and testable).

## R7 — Walk notice copy & collapse (F-10 / FR-019, FR-020)

**Decision**: `dogWalkNotices` selector gains urgency tiering (today/tomorrow =
urgent; else quiet) and the component: (a) date-aware reason strings — the
`REASON_LABEL` map's hardcoded "today" becomes a template with the formatted day
("No good-weather window on Thu"); (b) ≥2 non-urgent notices collapse to one row
("2 upcoming walks need a decision") expanding in place; (c) quiet tier drops the
2px alarm border for the standard notice treatment; (d) the action becomes "Open
planner" → `openWalkPlanner(date)`.

## R8 — Month-grid owner dots (F-12) and header cleanup (F-11)

**Decision**: the mobile month grid's day dots are Schedule-X chrome. Repoint them via
the existing `calendar-theme.css` override layer (custom `monthGridEvent`-adjacent
styling / per-owner classes on our event payloads — our items already carry owner in
`calendarId`), capped at 3 dots + overflow, matching `SevenDayStrip`'s convention. For
F-11: suppress Schedule-X's rendered header "Date"/"View" controls via the override
layer (the View select is single-option and dead; date nav is duplicated), keeping our
`CalendarViewSwitcher` + existing prev/next controls as the single vocabulary. If a
needed control turns out to be irreplaceable chrome (month title/date picker), restyle
it to tokens instead of hiding it — decide at implement with a live check.

**Rationale**: 032's F-17 already established the override-layer approach and its
limits; F-11/F-12 are its next increments, not a new mechanism.

## R9 — List pill counts (US8 / FR-026)

**Decision**: pure selector `neededCountByList(items)` in `lib/lists.ts` (Map of
listId → count of `status === 'needed'`); `ListsView` renders the count inside each
pill (`Grocery · 4`-style chip suffix, hidden at zero) from the already-cached
`useListItems()` data, so optimistic flips update it for free.

## R10 — Testing approach

- Frontend: unit tests per changed selector (`deeplink`, `dogwalks` notices,
  `lists` counts) + component tests (TaskDetailSheet done action, DayPeekPanel
  toggle, DogWalkNotice tiers/collapse, planner selection/steppers/backup, ListsView
  pills, CalendarHome focusDate consumption). Regression: the 029 DOM-identity test
  guards the CalendarHome changes.
- Backend: new `selfTestNotify()` suites exercising the public handlers' gate +
  dedupe + content builders against scratch data with a send seam (no real pushes),
  mirroring how digest suites test `sendDigests` without emailing; wire into the
  chunk runners (chunk 5 with dog-walk, or a new small chunk if 4/5 are near the
  6-min cap — chunk 4 sits at 5m31s, so the new suites go to chunk 5).
- Live validation per quickstart: real trigger installs, one forced morning/evening
  run against production data, on-device zoom + push checks device-gated as usual.
