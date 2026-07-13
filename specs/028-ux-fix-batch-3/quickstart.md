# Quickstart — 028 UX Fix Batch 3 (live validation)

Prerequisites: PR branch deployed — `cd backend && clasp push && clasp deploy -i <deploymentId>`
(refresh the existing web-app URL); frontend built (`cd frontend && npm run build`) or
merged so Pages redeploys. Real-device steps need an iPhone (this batch exists because of
one).

## §A — Backend self-test chunks (also validates US7 itself)

From the Apps Script editor, run in order and confirm each log line:

1. `setupDatabase()` — seeds the new `recurringEventsYearlyLookaheadDays=366` Settings
   row (idempotent; existing rows untouched).
2. `selfTest1Core()` → `SELFTEST 1/4 (core): ALL PASS`
3. `selfTest2Recurring()` → `SELFTEST 2/4 (recurring): ALL PASS`
4. `selfTest3SeedAndLists()` → `SELFTEST 3/4 (seed+lists): ALL PASS`
5. `selfTest4CalendarAndComms()` → `SELFTEST 4/4 (calendar+comms): ALL PASS`
6. Each chunk's execution time (editor → Executions) is under ~4 minutes.
7. Run `selfTest()` — expect it to **throw immediately** with the pointer to the chunks
   (guard works; no silent partial runs).

## §B — Yearly occurrences backfill (US1)

1. In the Sheet, note 2–3 seeded `RecurringEvents` rows with cadence `annually` whose
   next date is >2 months out (e.g. a spring birthday).
2. Editor: run `generateRecurringEvents()` once.
3. Events tab: each noted rule has an occurrence row for its next date (id starts `v`);
   anniversaries with `{nth}` show next year's ordinal.
4. App calendar: browse 6/9/12 months ahead — every seeded birthday/anniversary visible.
5. Confirm a **weekly/monthly** rule (if any exist) did NOT generate beyond ~60 days.
6. Run `generateRecurringEvents()` again → no new rows (idempotent at the wide window).
7. Next morning (or run `syncCalendar()` manually): occurrences appear once each in the
   shared Google Calendar — no duplicates.

## §C — Instant saves (US2), real device

1. Quick Add → task with a due date → Save. Sheet closes **immediately**; task visible
   in Tasks/dashboard at once. Watch it survive the background settle (no flicker/dupe).
2. Edit an event's title in its detail sheet → Save. Sheet closes immediately; new title
   shows in place; still correct after a manual refresh (server accepted it).
3. Create then immediately open the new task and edit its title. Both changes stick
   (client-minted id means the edit targeted a real row).
4. Failure path: airplane mode → create a task. Sheet closes, item appears, then the
   item **reverts** and an error toast appears when the save fails. Nothing phantom
   remains after airplane mode off + refresh.
5. Regression: complete, snooze, unsnooze, acknowledge, and a list-item flip all still
   feel instant.

## §D — Zoom + safe area (US3), iPhone

1. Focus every input in Quick Add, task edit, event edit, settings — viewport never
   zooms.
2. Double-tap and pinch on the dashboard — layout does not scale (note: pinch in
   Safari-the-browser may still be allowed by iOS's accessibility override; the meta +
   `touch-action` kill focus-zoom and double-tap-zoom, and pinch dies fully in the
   installed PWA come feature 010).
3. Bottom nav: tabs sit visibly above the home indicator; nav background reaches the
   screen's bottom edge (no white/gap strip); repeatedly tapping each tab's lower half
   never triggers the system home swipe.
4. Desktop (`npm run dev`, wide window): nav unchanged, no dead space below it.
5. iOS system text size bumped up (Settings → Accessibility): app text still scales.

## §E — Day peek panel (US4)

1. Dashboard → tap a 7-day-strip tile with items: a panel opens below the strip showing
   that day's events + tasks; you're still on the dashboard.
2. Tap a different tile → panel switches. Tap the open tile again → panel closes.
3. Panel's "Open in calendar" link → calendar at that day.
4. Empty day → friendly empty state (not a blank region).
5. Tap a task in the panel → the standard task detail sheet opens; complete it there →
   panel and tile count update.

## §F — Snoozed items on the strip (US5)

1. Snooze a task until a day 2–3 days out. Its owner's count on that day's tile
   increments; the task shows in that day's peek panel, indistinguishable from open
   tasks.
2. Snooze another until >7 days out → strip unchanged.
3. Smart views and load-balance sections: still exclude snoozed (unchanged).

## §G — Acknowledge redesign (US6)

1. As Max, assign a task to Jaz. On Jaz's phone: the uncommitted state + commit control
   render cleanly on the card at phone width (no wrap/crowding), tap target ≥44px.
2. Tap to commit → state clears, Max gets the ntfy ping + dashboard notice exactly as
   before.
3. `/impeccable audit` on the changed surfaces passes (AA contrast, touch targets).

## §H — Regression sweep

- `cd frontend && npm run build` — clean, no type errors; full vitest suite green.
- Calendar views, gcal mirror, digests untouched by inspection of the diff (backend
  changes are confined to RecurringEvents.js window math, Config/Setup settings seed,
  and SelfTest.js regrouping).
