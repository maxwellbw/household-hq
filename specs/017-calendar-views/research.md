# Research — Calendar views & 7-day surfaces (017)

All findings are grounded in the installed `@schedule-x/calendar` ^4.6.1 build and the
existing `/frontend` code (CalendarHome, EventContent, tether, datetime). No NEEDS
CLARIFICATION remained after `/speckit-clarify`; the four clarified decisions are the
inputs to R1/R3/R4/R5 below.

## R1 — Week & next-7 views: bespoke day-list, not Schedule-X week view

**Decision**: Build the fixed-week and next-7-days horizons as **our own React
`DayListView` / `DayColumn` components** (all-day chip columns), fed by the same in-memory
event/task model CalendarHome already builds. Keep Schedule-X only for `month-grid`
(desktop) and `month-agenda` (mobile). A new `CalendarViewSwitcher` toggles the mode.

**Rationale**:
- The clarification chose **day-list / agenda columns** over an hourly time-grid. Schedule-X's
  `createViewWeek` is an hourly time-grid — the wrong shape for a household app whose items are
  overwhelmingly all-day; it would render mostly empty space.
- Constitution IV (boring & debuggable): a 7-column flex/grid of chips is straight-line React we
  fully control; it reuses `EventContent` styling and owner tokens.
- Feature 013 was deferred precisely because Schedule-X month-grid internals (no stable
  `data-date`, `is-leading-or-trailing` keyed to `selectedDate`) are fragile. Owning the week
  layout avoids fighting those internals for range math, Sunday-start, and tap targets.

**Alternatives considered**:
- *Schedule-X `createViewWeek` (time-grid)* — rejected: wrong shape (hourly), poor for all-day
  data, and adds the same responsive/DOM-churn surface 016 had to disable.
- *Schedule-X custom-view API* — rejected: heavier coupling to internal view contracts for no
  benefit over plain components.

## R2 — Sunday-start everywhere

**Decision**: Pass `firstDayOfWeek: 7` to the Schedule-X calendar config for the month grid;
compute all bespoke week/next-7/strip ranges from the existing Sunday-based helpers in
`datetime.ts`.

**Rationale**: The installed build defines `FirstDayOfWeek` as `MONDAY=1 … SATURDAY=6,
SUNDAY=7`, validated to be "a number between 1 and 7", so **Sunday = `7`**. `datetime.ts`
already has `weekRange()` computing Sun–Sat (dayOfWeek 7 = Sunday, start of week) — reuse it
for the fixed-week view and the dashboard week math; add a sibling `nextNDaysRange(n)` for the
rolling window.

**Alternatives considered**: `firstDayOfWeek: 0` — rejected; 0 is out of the validated 1–7
range and would throw.

## R3 — Mobile view switcher

**Decision**: Add `CalendarViewSwitcher` rendered above the calendar on **both** breakpoints.
On desktop it also drives the month vs. week/next-7 choice; on mobile it replaces the
"no dropdown" gap (today mobile only ever shows `month-agenda`). Selecting Month on mobile
maps to `month-agenda`; Month on desktop maps to `month-grid`; Week / Next-7 use the bespoke
`DayListView` on both.

**Rationale**: Clarification chose "desktop + add mobile picker." Keeping one switcher
component avoids two code paths. `isMobile` (already in CalendarHome) only decides which
Schedule-X view backs "Month"; the week horizons are breakpoint-agnostic (a scrollable stack
of day-columns on narrow screens, a row on wide).

## R4 — Desktop month de-clutter + "+N more" jump-to-day

**Decision**: Configure `monthGridOptions: { nEventsPerDay: <cap> }` (Schedule-X caps per-day
events and renders the overflow control automatically). Wire the calendar's
`onClickPlusEvents(...)` callback to **navigate to a focused single-day list** for that date
(bespoke `DayListView` in single-day mode), per the clarification.

**Rationale**: The installed build exposes `monthGridOptions.nEventsPerDay` (default 4) and an
`onClickPlusEvents` callback — exactly the built-in overflow + hook we need, so we don't
hand-roll cell clipping. Routing its click to our single-day list gives a deterministic
"jump to that day's view" without depending on Schedule-X agenda-scoping semantics.

**Open detail for implementation**: confirm `onClickPlusEvents` payload carries the clicked
date (or derive it from the calendar's selected date) and the exact `nEventsPerDay` value that
keeps a cell within one grid row at the app's desktop widths (start at 3–4, tune in
`/impeccable` pass). Mobile is unaffected (agenda list has no cap).

## R5 — Overdue on today (display-only)

**Decision**: In CalendarHome's `scheduleXEvents` builder (and the bespoke day-list model), a
standalone task with `status === 'open'` and `dueDate < todayKey(tz)` is emitted as an all-day
pseudo-event **on today** with an `_overdue: true` flag, and is **not** emitted on its original
past date. `EventContent` renders an "Overdue" badge when `_overdue`. A pure helper
`isOverdue(task, todayKey)` + the today-remap live in a unit-tested function.

**Rationale**: FR-012/013 + clarification: today-only, stored `dueDate` untouched, no re-sync.
Today the builder maps each dated standalone task to `Temporal.PlainDate.from(task.dueDate)`;
the change is a conditional remap of the *display* date only. Non-overdue dated tasks keep
mapping to their real date. `done`/`snoozed` tasks are never overdue (TaskStatus =
`open | done | snoozed`). Completing or rescheduling flows through existing mutations, which
naturally clear the flag on refetch (FR-014).

**Alternatives considered**: nightly date-rewrite / gcal re-sync — explicitly rejected by the
spec (churn, mutates the Sheet).

## R6 — Prep-task progress "M/N tasks"

**Decision**: Extend `tether.ts`'s `EventWithTasks` with `doneTaskCount` (tasks with
`status === 'done'`) alongside the existing `openTaskCount`; `totalTaskCount = tasks.length`.
`EventContent` renders `"{done}/{total} tasks"` when `total > 0`, replacing today's
`"{open} prep tasks"` string. Events with no prep tasks render no indicator.

**Rationale**: `buildCalendarModel` already groups tasks under events and computes
`openTaskCount`; adding a done count is one `.filter`. TaskStatus has no separate "complete"
— **done** is the completed state. FR-010/011 satisfied purely from already-fetched data;
progress updates reactively when a prep task is completed (query invalidation → re-derive).

**Alternatives considered**: showing open-count (status quo) — rejected; spec wants
completed/total progress, which reads as readiness ("3/7 tasks").

## R7 — Dashboard 7-day strip + calendar deep-link

**Decision**: New `SevenDayStrip` renders seven tiles for `nextNDaysRange(7)` starting today,
each summarizing that day's items by owner (colored dots/counts) from the same
events+tasks the dashboard already loads. Tapping a tile calls an `onOpenDate(dateKey)`
passed down from `App.tsx`, which sets a lifted `calendarFocusDate` and switches `active` to
`'calendar'`. `CalendarHome` gains an optional `focusDate` prop that seeds Schedule-X
`selectedDate` (month view centered on that date) instead of the hardcoded today.

**Rationale**: FR-015–018. Reuses the dashboard's existing `useTasks`/`useEvents` and the
same day-bucketing (`dayKey`) as the rest of the app. The deep-link is a lifted-state bridge
(App already owns `active` nav state) — boring and debuggable, no router added. Empty days
render as present-but-empty tiles (FR-018).

**Alternatives considered**: introducing a URL router for `/calendar?date=` — rejected;
over-engineering for a two-tab in-memory nav state.

## Cross-cutting

- **Timezone**: every range/day computation uses `todayKey(tz)` / Temporal `PlainDate` from
  `datetime.ts` — never device-local `Date`. (FR-019, existing R7 convention.)
- **Accessibility**: view switcher is a labeled control group; day-tiles and "+N more" are
  real buttons with accessible names ("Open <date>", "3 more items on <date>"); overdue badge
  has non-color text; owner dots pair color with initial/text (identity, not color-only).
  `/impeccable audit` before PR (constitution DoD).
- **Tests**: pure helpers (`nextNDaysRange`, `isOverdue`, overdue-remap, done/total counts)
  get unit tests; `CalendarViewSwitcher`, `DayListView`, `SevenDayStrip` get component tests;
  overdue-on-today and "M/N" get regression tests. Target: keep the suite green and grow it.
