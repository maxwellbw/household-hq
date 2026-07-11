# UI Contract — Calendar views & 7-day surfaces (017)

This feature exposes no network API. Its "contracts" are the component props and interaction
behaviors the pieces agree on. All data flows from existing hooks (`useEvents`, `useTasks`,
`useSettings`) — no new endpoints, no backend change.

## CalendarViewSwitcher

```ts
type CalendarViewMode = 'month' | 'week' | 'next7'   // 'day' is reached only via "+N more"

interface CalendarViewSwitcherProps {
  mode: CalendarViewMode
  onChange: (mode: CalendarViewMode) => void
  isMobile: boolean            // affects labeling/layout only, not available options
}
```

- MUST render on both desktop and mobile (FR-002b).
- Options: **Month**, **Week** (fixed Sun–Sat), **Next 7 days** (rolling).
- Accessible: labeled control group; current mode has `aria-pressed`/`aria-current`.

## CalendarHome (modified)

```ts
interface CalendarHomeProps {
  visibleOwners: Set<Owner>
  focusDate?: string           // YYYY-MM-DD; seeds Schedule-X selectedDate once (deep-link)
}
```

Behavior contract:
- Schedule-X config: `firstDayOfWeek: 7` (Sunday); `monthGridOptions: { nEventsPerDay: <cap> }`;
  `onClickPlusEvents(date)` → switch to single-day `DayListView` for that date (FR-008, FR-009).
- Holds `mode: CalendarViewMode` + optional single-day focus; renders Schedule-X for `month`,
  `DayListView` for `week`/`next7`/`day`.
- Builds Schedule-X items and day-list items from the same model; **overdue** open standalone
  tasks are placed on today with `_overdue` and omitted from their original date (FR-012/013).
- `focusDate`, when provided, sets the initial `selectedDate` (month view centered there) then
  yields to normal navigation.

## DayListView / DayColumn

```ts
interface DayListViewProps {
  mode: 'week' | 'next7' | 'day'
  focusDate?: string           // anchor for 'day' (and 'week' when navigated); defaults today
  items: CalendarItem[]        // owner-filtered events + tasks (incl. overdue-on-today)
  timezone: string
  onEventClick: (id: string) => void   // reuses CalendarHome's event/task detail routing
  onNavigate?: (deltaDays: number) => void  // prev/next: ±7 for week/next7, ±1 for day
}
```

- Renders N `DayColumn`s (7 for week/next7, 1 for day), **Sunday-first** for week.
- Each `DayColumn`: date header (with today emphasis) + owner-colored chips reusing the
  `EventContent` visual language (owner edge/tint/dot/initial). All-day list, no hourly grid.
- Empty days render as an empty column, not omitted (edge case: empty week).
- Task chips carry the overdue badge when `_overdue`.

## EventContent (modified)

- Prep progress: when the event has prep tasks, render **"{done}/{total} tasks"**
  (`done = doneTaskCount`, `total = totalTaskCount`); render nothing when `total === 0`.
  Replaces the current "{open} prep tasks" text. (FR-010/011)
- Task chips: render a distinct **"Overdue"** badge (text + color, not color-only) when the
  item is `_overdue`. (FR-012)

## SevenDayStrip (dashboard)

```ts
interface SevenDayStripProps {
  tiles: DayTileSummary[]      // exactly 7, today first
  onOpenDate: (dateKey: string) => void
}
```

- Exactly 7 tiles, today first (FR-015); each summarizes items by owner via colored
  dots/counts (FR-016); empty day ⇒ present-but-empty tile (FR-018).
- Tapping a tile calls `onOpenDate(dateKey)` (FR-017). Tiles are buttons with accessible names
  (e.g. "Open Tue Jul 14 — 3 items").

## App.tsx (wiring)

- Owns `calendarFocusDate: string | null`. Dashboard's `SevenDayStrip.onOpenDate` sets it and
  switches `active` to `'calendar'`; passes it to `CalendarHome.focusDate`. Cleared after use
  or on manual nav away.

## Non-goals (contract boundaries)

- No new API actions, Sheet columns, triggers, or stored fields.
- No change to how events/tasks are fetched, mutated, or logged.
- Overdue is never written back; completing/rescheduling uses existing mutations unchanged.
