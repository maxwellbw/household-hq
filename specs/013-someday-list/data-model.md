# Data Model: Someday List

**Feature**: 013-someday-list | **Date**: 2026-07-10 | **Phase 1**

No new persisted entities, fields, tabs, or statuses. This feature adds **view models** over the existing `Task` and one reused write. The Sheet schema is unchanged (constitution II).

## Existing entity (unchanged): Task

From `src/types/domain.ts` / the Tasks tab. Relevant fields for this feature:

| Field | Type | Role here |
|---|---|---|
| `id` | string (uuid) | Selector for the schedule write. |
| `title` | string | Shown in the row. |
| `dueDate` | `string?` (ISO `YYYY-MM-DD`) | **Absent/empty ⇒ "someday".** The write sets this to schedule. |
| `owner` | `'max' \| 'jaz' \| 'both'` | Shown as identity chip; set by the schedule write. |
| `status` | `'open' \| 'done' \| 'snoozed'` | Someday shows `open` only. |
| `eventId` | `string?` | If set, the task is event-tethered ⇒ **excluded** from Someday (via `standaloneTasks`). |

## Derived view: SomedayTask (a filtered `Task`, not a new type)

**Selector** (pure; unit-tested):

```
somedayTasks(model, visibleOwners) =
  model.standaloneTasks
    .filter(t => t.status === 'open' && !t.dueDate && visibleOwners.has(t.owner))
```

- `model.standaloneTasks` comes from `buildCalendarModel` and already excludes event-tethered tasks.
- Ordering: stable, by `title` (there is no date to sort by). `standaloneTasks` currently arrives sorted by `dueDate`; for the undated subset that collapses to insertion order — apply an explicit `localeCompare` on `title` for determinism.
- **Invariant (FR-004)**: `somedayTasks` and the calendar's `visibleStandaloneTasks` (which requires `t.dueDate`) are disjoint for the same task set.

## Draft view model: ScheduleDraft (ephemeral dialog state)

Held in the dialog's local state; never persisted.

| Field | Type | Initial | Rule |
|---|---|---|---|
| `taskId` | string | (the tapped/dragged task) | Immutable for the dialog's life. |
| `date` | `string` (ISO `YYYY-MM-DD`) or `''` | `''` on tap; **drop date** on drag (US3) | Must be non-empty and ≥ today (household tz) to confirm. |
| `owner` | `'max' \| 'jaz' \| 'both' \| null` | `null` (no pre-selection) | Must be non-null to confirm (FR-007). |

**Validation / state transitions**:

- `canConfirm(draft) = draft.date !== '' && draft.owner !== null` (FR-008). Confirm control is `disabled` while false.
- Cancel/dismiss → discard draft, no write (FR-010).
- Confirm → `useScheduleTask.mutate(buildSchedulePayload(draft))`, dialog enters pending; on success dialog closes and the task transitions surfaces (see below); on error dialog stays open / task remains in Someday with a toast (FR-014).

## Write: buildSchedulePayload (pure; unit-tested)

```
buildSchedulePayload(draft) = { id: draft.taskId, dueDate: draft.date, owner: draft.owner }
```

Sent to `tasks.update` (see contracts/api-tasks-schedule.md). No `status` is sent (rejected by the backend and unnecessary — the task is already `open`).

## Surface transition (emergent, no bespoke code)

```
open + no dueDate  --(schedule: set dueDate + owner)-->  open + dueDate
      │                                                        │
   in SomedayList                                       on the calendar
```

After the write invalidates `['tasks']`, the refetched task fails `!t.dueDate` (drops out of `somedayTasks`) and passes `CalendarHome`'s `t.dueDate` filter (appears on its day). Completing a someday task instead (`open → done`) removes it from `somedayTasks` via the `status === 'open'` filter, with no date ever assigned.
