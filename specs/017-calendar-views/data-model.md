# Data Model — Calendar views & 7-day surfaces (017)

**No stored entities are added or changed.** This feature is presentation-only; the Sheet,
API, and domain types (`Event`, `Task`, `TaskStatus`, `Owner`) are untouched. Below are the
**derived, in-memory view-models** the UI computes from already-fetched `Event[]` + `Task[]`.

## Existing types reused (unchanged)

- `Owner = 'max' | 'jaz' | 'both'`
- `TaskStatus = 'open' | 'done' | 'snoozed'`
- `Event { id, title, start, end, owner, ... }`
- `Task { id, title, owner, dueDate?, status, eventId?, completedBy?, completedAt? }`
- `EventWithTasks extends Event { tasks: Task[]; openTaskCount }` (from `lib/tether.ts`)

## Derived view-models (new / extended)

### 1. `EventWithTasks` — extended (lib/tether.ts)

Add two derived counts alongside the existing `openTaskCount`:

| Field | Type | Derivation |
|-------|------|-----------|
| `totalTaskCount` | `number` | `tasks.length` |
| `doneTaskCount` | `number` | `tasks.filter(t => t.status === 'done').length` |

Drives the chip's **"M/N tasks"** indicator (M = `doneTaskCount`, N = `totalTaskCount`),
shown only when `totalTaskCount > 0`. (FR-010, FR-011, R6.)

### 2. Calendar item (Schedule-X pseudo-event) — extended (CalendarHome)

The existing map from event/task → Schedule-X item gains one display flag for tasks:

| Field | Type | Meaning |
|-------|------|---------|
| `_overdue` | `boolean` (tasks only) | `true` when the source task is open and its `dueDate` is before today (household tz). |

**Placement rule (display date):**
- Event → its real `start`/`end`.
- Standalone task, **not** overdue → its real `dueDate`.
- Standalone task, **overdue** (`status==='open' && dueDate < todayKey(tz)`) → **today**, with
  `_overdue: true`; **not** emitted on its original date. (FR-012, FR-013, R5.)

No stored field backs `_overdue`; it is recomputed each render from `todayKey(tz)`.

### 3. `DayCell` — new (bespoke week / next-7 / single-day views)

One entry per rendered day in `DayListView`:

| Field | Type | Meaning |
|-------|------|---------|
| `dateKey` | `string` (YYYY-MM-DD) | The day this column represents. |
| `isToday` | `boolean` | `dateKey === todayKey(tz)`. |
| `items` | `CalendarItem[]` | Events + tasks (incl. overdue-on-today) whose display date bucket === `dateKey`, owner-filtered. |

`DayListView` modes:
- **week** — 7 cells, Sunday–Saturday of the focused week (`weekRange`).
- **next7** — 7 cells, today + next 6 (`nextNDaysRange(7)`).
- **day** — 1 cell (reached from month "+N more"); `dateKey` = clicked date.

### 4. `DayTileSummary` — new (dashboard SevenDayStrip)

One entry per tile in the rolling 7-day strip:

| Field | Type | Meaning |
|-------|------|---------|
| `dateKey` | `string` | The tile's day (today first, then next 6). |
| `isToday` | `boolean` | Highlight flag. |
| `countsByOwner` | `{ max: number; jaz: number; both: number }` | Item counts per owner for that day (drives colored dots/counts). |
| `total` | `number` | Sum; `0` ⇒ tile renders empty-but-present (FR-018). |

Tapping a tile emits `dateKey` up to `App.tsx` → sets `calendarFocusDate`, switches to the
Calendar tab (FR-017, R7).

## Pure helpers (new / extended in lib/datetime.ts)

| Helper | Signature | Notes |
|--------|-----------|-------|
| `nextNDaysRange` | `(n: number, tz?) => DayRange` | Today → today+(n-1), inclusive; today first. |
| `isOverdue` | `(task: Task, todayKey: string) => boolean` | `task.status==='open' && !!task.dueDate && task.dueDate < todayKey`. Pure, unit-tested. |
| `weekRange` | *(existing, reused)* | Already Sun–Sat; used by fixed-week view + dashboard week math. |

## Lifecycle / state (UI only)

- **View mode** (`month | week | next7 | day`): local `CalendarHome` state; not persisted.
- **`calendarFocusDate`**: lifted to `App.tsx`; consumed once by `CalendarHome` to seed
  `selectedDate`, then normal navigation takes over.
- **Overdue**: never a stored state; purely `open + past dueDate` recomputed per render.
  Clears when the task is completed (`done`) or rescheduled to a non-past date — both via
  existing logged mutations (FR-014); no new write path.

## Invariants

- A task appears in exactly one calendar cell: its real due date, or today if overdue — never
  both. (FR-012)
- Owner color coding is applied identically across month, week, next-7, single-day, and the
  dashboard strip (identity, not decoration).
- All day-bucketing uses `dayKey` / `todayKey` in the household timezone (FR-019).
