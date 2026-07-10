# Phase 0 Research: Home Dashboard

All decisions below stay within the decided stack (Constitution "Platform Constraints") and
introduce no new dependencies. The spec's three clarified scope questions are already
resolved in `spec.md#clarifications`; this file records the remaining implementation-level
decisions.

## R1 — Data sourcing: reuse existing queries, add nothing to the backend

**Decision**: The dashboard reads from the four existing react-query hooks —
`useTasks` (`['tasks']`), `useEvents` (`['events']`), `useRecurring` (`['recurring']`),
`useSettings` (`['settings']`, exposes `timezone`). No new API method, Sheet column, or
backend deploy.

**Rationale**: Features 012 and 013 established that the frontend already holds all task,
event, recurring, and settings data. The dashboard is a *reorganization* of that data, so
adding backend surface would violate "Boring and Debuggable" (unnecessary moving parts) and
"The Sheet Is the Source of Truth" (no shadow aggregates). React Query already dedupes and
caches these, so the dashboard adds zero network round-trips when the cache is warm.

**Alternatives considered**: A backend `dashboard.summary` endpoint that returns
pre-computed counts — rejected: pushes date/timezone logic into Apps Script for no benefit,
adds a deploy, and duplicates logic the frontend already has for the calendar/tasks views.

## R2 — Timezone-correct date bucketing

**Decision**: Compute Today / This weekend / This week / This month entirely in the
household timezone using the existing `lib/datetime.ts` helpers (`todayKey`, `dayKey`, both
already timezone-pinned via `temporal-polyfill`). Add small pure range helpers to the same
file (see R3). Bucketing compares `YYYY-MM-DD` day-keys with string comparison, which is
correct and boring for ISO dates.

**Rationale**: `datetime.ts` already solved "naive household-local string vs. device clock"
(its header comment). Reusing `todayKey`/`dayKey` guarantees the dashboard and calendar
agree on what "today" is. Day-key string comparison (`a < b`) is valid for zero-padded ISO
dates and avoids any `Date`-in-device-zone traps.

**Alternatives considered**: `new Date()` math — rejected; it reintroduces the device-zone
bug the existing helpers exist to prevent.

## R3 — New datetime range helpers (household timezone, Settings week start)

**Decision**: Add pure, timezone-aware helpers to `lib/datetime.ts`, each returning inclusive
`{ startKey, endKey }` day-key ranges relative to "today" in the household timezone:

- `weekendRange(timezone)` → the current/upcoming **Friday–Sunday** (clarified). When today
  is Fri/Sat/Sun, it is *this* weekend (Friday of the current weekend through its Sunday);
  otherwise the next upcoming Friday–Sunday.
- `weekRange(timezone, weekStartsOn)` → the current week; `weekStartsOn` defaults to Sunday
  to match the email-digest "week ahead" convention (Settings can override later).
- `monthRange(timezone)` → the first through last day of the current calendar month.

A helper `inRange(dayKey, range)` does inclusive `startKey <= dayKey <= endKey` comparison.

**Rationale**: Keeping ranges as `{startKey, endKey}` string pairs makes them trivially
unit-testable with fixed "today" inputs and keeps all weekday arithmetic in one boring place.
Weekday-of-a-day-key is derived with `Temporal.PlainDate.from(key).dayOfWeek` (ISO: Mon=1 …
Sun=7), no device `Date`.

**Alternatives considered**: A date-range library — rejected (new dependency, Constitution
IV). Storing ranges as `Date` objects — rejected (device-zone ambiguity).

## R4 — Load-balance counting (US2)

**Decision**: In `lib/dashboard.ts`, `loadBalance(tasks, range)` counts **open** tasks
(`status === 'open'`) whose `dueDate` day-key falls in `range`, grouped by owner into
`{ max, jaz, both }`. `both` is its **own figure**, never added into `max` or `jaz`
(clarified). Undated tasks are excluded (no day-key). Snoozed/done are excluded (not open
workload). The week figure and month figure use the same function with different ranges.

**Rationale**: Directly implements FR-006/FR-007/FR-008 and the clarification. A single pure
function keeps week and month consistent and reconciles exactly to a hand count (SC-004).

**Viewer perspective ("you have 4, Jaz has 5")**: The acting person (`session.actingPerson`
or `who.identity` when not shared) is rendered as "you"; the other person by name. When the
shared household account is signed in with no acting person resolved, both are shown by name
(Max / Jaz) with no "you" — the shared account is never an owner (FR-009).

## R5 — Smart-view grouping (US1)

**Decision**: `lib/dashboard.ts` exposes pure selectors over tasks + events:
- **Today**: open tasks with `dueDate` day-key == today; events whose day-range includes
  today.
- **Overdue**: open tasks with `dueDate` day-key **strictly < today**. (Events are not
  "overdue"; only tasks.)
- **This weekend**: open tasks with due day-key in `weekendRange`; events overlapping it.
- An item in Overdue is never also in Today (mutually exclusive by the `<` vs `==` split,
  FR-003 / edge case).

**Rationale**: Mirrors the calendar's day-key bucketing so the two views never disagree.
Events use overlap against the range to handle multi-day events (an event Fri–Sun shows in
"This weekend" and, on Friday, in "Today").

## R6 — Highlights heuristic (US3, sparse)

**Decision**: `lib/dashboard.ts` `highlights(events, recurring, tasks, timezone)` returns a
short, capped list (≤ 3) of callouts:
- **Noteworthy event**: an upcoming event within the next ~7 days that is multi-day OR falls
  on the weekend — phrased with its day range (e.g. "Friends are here Fri–Sun"). Title comes
  straight from the event.
- **Rare chore coming up**: an open task linked to a recurring rule (`task.recurringId`)
  whose rule cadence is **rarer than monthly** — i.e. cadence in `{quarterly, annually}`
  (clarified: interval longer than one month) — with a due day-key within the next ~14 days.
- If nothing qualifies, returns `[]`; the UI renders nothing (or a calm empty line), never
  filler (FR-010, US3 scenario 4).

**Rationale**: `Cadence` is an existing enum (`weekly | biweekly | monthly | quarterly |
annually`); "rarer than monthly" maps cleanly to `quarterly`/`annually`, so no threshold
guessing is needed — the clarified rule is expressible directly against existing data.
Capping at ≤ 3 enforces "highlights stay sparse."

**Alternatives considered**: Inferring "rare" from gaps between materialized instances —
rejected (fragile, needs history); the rule cadence is the authoritative, boring signal.

## R7 — Navigation & landing (fixed)

**Decision**: Add `'home'` as the first `NavSection` in `navItems.ts` (icon: `Home` from
lucide-react, already a dependency). In `App.tsx`, initialize `active` to `'home'` and render
`<DashboardHome />` for it. The calendar tab, its owner filter, and the Someday list are
untouched and remain reachable in one tap (FR-001, FR-007). Landing is hard-coded, not a
Settings option (clarified).

**Rationale**: The app already uses a simple `useState<NavSection>` tab switch; changing the
initial value and adding one nav entry is the smallest possible change that satisfies
"dashboard is home" without introducing routing or a settings knob (Constitution I & IV).

## R8 — Empty states & read-only guarantee

**Decision**: Each section renders a calm, on-brand empty state when it has no items (reuse
the tone/pattern of the existing `calendar/EmptyState.tsx`). The dashboard performs **no
mutations** — task items may link/navigate to existing detail sheets later, but the core
dashboard neither completes nor edits anything (FR-013). Loading falls back to the same
skeleton/spinner pattern the other views use while queries are pending.

**Rationale**: Satisfies FR-011/SC-006 and keeps the view read-only, so Constitution VI
(logging) is trivially satisfied (nothing to log).

## Resolved unknowns

No `NEEDS CLARIFICATION` markers remain. The three spec-level scope questions were resolved
in `/speckit-clarify` (2026-07-10); the implementation-level decisions above (R1–R8) are all
within the existing stack with zero new dependencies.
