# Phase 1 Data Model: Home Dashboard

**No Sheet schema change.** The dashboard introduces **no new stored entities** — it derives
view-models in memory from existing data. This file documents those derived shapes and the
existing fields they read. Existing entities are defined in
`frontend/src/types/domain.ts` (mirrors the Sheet columns).

## Existing entities read (unchanged)

| Entity | Fields the dashboard reads | Source hook / query key |
|--------|----------------------------|-------------------------|
| `Task` | `id`, `title`, `dueDate?`, `owner` (`max`/`jaz`/`both`), `status` (`open`/`done`/`snoozed`), `recurringId?`, `eventId?` | `useTasks` → `['tasks']` |
| `Event` | `id`, `title`, `start`, `end`, `owner` | `useEvents` → `['events']` |
| `RecurringRule` | `id`, `title`, `cadence` (`weekly`/`biweekly`/`monthly`/`quarterly`/`annually`) | `useRecurring` → `['recurring']` |
| `Settings` | `timezone` | `useSettings` → `['settings']` |

The dashboard writes to none of these.

## Derived view-models (in-memory only, `lib/dashboard.ts`)

### `DayRange`
Inclusive day-key range in the household timezone. Produced by the `lib/datetime.ts` helpers.

| Field | Type | Notes |
|-------|------|-------|
| `startKey` | `string` | `YYYY-MM-DD`, inclusive |
| `endKey` | `string` | `YYYY-MM-DD`, inclusive |

Ranges used: `weekendRange` (Fri–Sun), `weekRange` (Sun-start default), `monthRange`
(1st–last of month). Membership: `startKey <= dayKey <= endKey`.

### `SmartViews` (US1)
Grouped items for the three smart sections.

| Field | Type | Rule |
|-------|------|------|
| `today` | `{ tasks: Task[]; events: Event[] }` | open tasks with `dayKey(dueDate) == todayKey`; events whose `[start,end]` day-range includes today |
| `overdue` | `Task[]` | open tasks with `dayKey(dueDate) < todayKey` (strictly before) |
| `weekend` | `{ tasks: Task[]; events: Event[] }` | open tasks with due day-key in `weekendRange`; events overlapping `weekendRange` |

Invariant: `overdue` and `today.tasks` are disjoint (`<` vs `==`). Undated and non-open
tasks never appear.

### `LoadSummary` (US2)
Open-task counts for a period, per owner.

| Field | Type | Rule |
|-------|------|------|
| `max` | `number` | count of open tasks, `owner==='max'`, due day-key in range |
| `jaz` | `number` | count of open tasks, `owner==='jaz'`, due day-key in range |
| `both` | `number` | count of open tasks, `owner==='both'`, due day-key in range — **standalone, never folded into `max`/`jaz`** |

Computed twice: once with `weekRange`, once with `monthRange`. Month is a superset of week
for the same data (SC / US2 scenario 4). Reconciles exactly to a hand count (SC-004).

### `Highlight` (US3)
A single sparse callout. The list is capped at ≤ 3; may be empty.

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `'event' \| 'rareChore'` | drives phrasing/icon |
| `title` | `string` | event title, or the rare chore's task/rule title |
| `detail` | `string` | e.g. day range "Fri–Sun" for events; due-relative for chores |
| `owner` | `Owner` | for owner color coding |
| `refId` | `string` | source event id or task id (for optional navigation) |

Qualification (from research R6):
- `kind: 'event'` — upcoming event within ~7 days that is multi-day or on the weekend.
- `kind: 'rareChore'` — open task with `recurringId` whose rule `cadence ∈ {quarterly,
  annually}` (rarer than monthly) and due within ~14 days.

### `ViewerContext`
Resolves the "you vs. them" framing for the load balance (research R4).

| Field | Type | Notes |
|-------|------|-------|
| `youOwner` | `'max' \| 'jaz' \| null` | acting person; `null` when shared account with no acting person |

When `youOwner` is set, that person renders as "you" and the other by name; when `null`,
both render by name (shared account is never an owner, FR-009).

## Validation rules (all derived, none persisted)

- All day-key derivation uses household timezone (`Settings.timezone`), never device clock
  (FR-012).
- Only `status === 'open'` tasks count toward smart views and load balance (FR-003, FR-008).
- `both` tasks are counted only in the shared figure (FR-008).
- Empty groups yield empty arrays / zero counts, surfaced as calm empty states (FR-011).
