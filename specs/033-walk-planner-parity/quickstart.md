# Quickstart — Feature 033 live validation

Prereqs: backend pushed + deployed (`cd backend && clasp push && clasp deploy -i
<deploymentId>`), frontend built clean (`cd frontend && npm run build`), dev session
token in `localStorage['hq.sessionToken']` for sandbox browsing. Real-device checks
(§F) are device-gated as usual.

## A — Dashboard task completion (US1)

1. Seed/find a task due today. On Home, today's card: the task row shows a complete
   toggle; tap it → row flips to done styling instantly; Feed logs the completion.
2. Tap the task title → detail sheet shows a **Mark done** (or **Reopen**) action;
   use it both directions.
3. Overdue section rows (already `TaskRow`) still complete correctly — regression
   check only.

## B — Notifications (US2, US3)

1. `clasp run installNotifyTriggers` → editor shows 2 new daily triggers at hours
   8 / 20 (or the configured Settings values).
2. With ≥1 overdue task: `clasp run sendMorningOverduePush` → both people's devices
   get one push, body `"N overdue: …"`; ActivityLog has one `notify-overdue` row for
   today. Run it again → no second push, no second row.
3. Zero overdue (complete them): run → nothing sent, nothing logged.
4. With a booked walk tomorrow: `clasp run sendEveningWalkPush` → both get
   `"Dog walk tomorrow · H:MM–H:MM"`; `notify-walk` row for tomorrow; re-run → silent.
   Flip tomorrow to needs-decision (or pick a flagged date) → body is the decision
   prompt. No walk row tomorrow → silent.
5. Tap the morning push → app opens on Home (Overdue on top). Tap the evening push →
   planner sheet opens on tomorrow's date (cold + warm app).
6. `clasp run selfTestNotify` → ALL PASS (gate, dedupe, content, public-name suites).

## C — Walk parity & deep links (US4)

1. Mobile viewport (375px): month day-list, week, and next-7 views each show 🐾
   booked rows (with window) and ⚠️ needs-decision rows; tapping either opens the
   planner on that date.
2. Desktop 1280px: month-grid walk pill click opens the planner (was dead).
3. Home walk notice action ("Open planner") opens the planner on the notice's date —
   not the calendar at today.
4. Day-card "Open in calendar" for a future date lands the calendar **on that date**
   (F-04 regression: repeat with the Calendar tab not yet visited this session, so
   the lazy chunk loads fresh).
5. With the planner open, press browser Back → sheet closes, app stays.
6. Today's card shows the walk line (booked window / needs-decision).

## D — Planner rework (US5) & notices (US6)

1. Tap an eligible hour → visible selected state; confirm bar pinned at sheet
   bottom, no scrolling needed (SC-005).
2. Steppers: shift start to :15/:30/:45; duration control offers the Settings
   durations (60/45/30); confirm books the adjusted window (verify in the Sheet row
   + calendar invite window). An adjustment overlapping a busy block or failed gate
   disables Confirm with a reason.
3. Backup slot: book the backup candidate → row lands with `slot=backup`.
4. Timeline on mobile: ineligible stretches render compressed; total scroll height
   is a small multiple of screen height, not ~10×.
5. Status line reads "Live forecast · updated N min ago" (or the cached fallback).
6. Notices: seed needs-decision walks 5 and 10 days out → ONE quiet collapsed row
   naming both days, no alarm styling, correct dates (no "today"); a needs-decision
   today/tomorrow keeps urgent styling.

## E — Calendar readability (US7) & Lists (US8)

1. Narrow week/next-7 column with a long-titled work event: title characters
   visible, badge yields; tap opens details with full title (SC-006 at 320px too).
2. Month grid: day dots owner-colored (max/jaz/both), 3-dot cap + overflow.
3. A day list whose only items are done tasks: shows "N done ✓" collapsed
   affordance, expandable.
4. Event popover/detail: map link reads "Open map ↗"; Delete no longer adjacent to
   Edit.
5. Calendar header: one view switcher; no single-option "View" select; date controls
   match app vocabulary. 029's DOM-identity regression test still green.
6. Lists: Grocery with N needed shows `N` on its pill; 0-needed list shows no count;
   flipping an item updates the pill instantly; a newly created list gets counts.

## F — Focus-zoom (US9) — device-gated (real iPhone)

1. Lists tab: focus add-item, search, and new-list-name fields → no viewport zoom.
2. Sweep: Quick Add, task/event edit, Settings, planner inputs → no zoom anywhere.
3. Pinch-zoom still works (WCAG 1.4.4 — no `user-scalable=no` regression in
   `index.html`).
4. Sandbox proxy while device-gated: computed `font-size` of every focused text
   control at `pointer: coarse` emulation is ≥16px (the R1 `!important` rule wins
   over `text-sm`).

## G — Regression & gates

- `cd frontend && npm test` (all green, new tests included) and `npm run build`
  (type-clean).
- Backend chunks: `clasp run selfTest1Core` … `selfTest5` chunks + `selfTestNotify`
  + `selfTestDogWalk` → ALL PASS.
- `/impeccable audit` on the changed UI before PR (definition of done).
