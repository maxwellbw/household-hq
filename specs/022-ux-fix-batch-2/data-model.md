# Data Model: UX Fix Batch 2

**No data-model changes.** This feature is frontend-only and introduces no new Sheet columns, tabs, entities, or fields. It surfaces actions on existing entities.

## Entities touched (read-only reference)

| Entity | Fields this feature reads | Purpose |
|--------|---------------------------|---------|
| `Task` (`types/domain.ts`) | `id`, `status`, `dueDate`, `recurringId`, `snoozeHistory` | Snooze uses `id`/`dueDate`; delete uses `id`; confirm copy branches on `recurringId`; existing snooze-history display unchanged. |
| `Event` / `EventWithTasks` (`lib/tether.ts`) | `id`, `tasks[]` | Delete uses `id`; confirm copy uses `tasks.length` for the prep-task count. |

## Backend actions reused (no changes)

- `tasks.snooze` (`{ id, dueDate }`) — via existing `useSnoozeTask`.
- `tasks.delete` (`{ id }`) → `deleteTask_`; hard-deletes the row, mirrors deletion to the shared calendar, appends to ActivityLog. Instance-only for recurring-generated tasks — the rule is untouched.
- `events.delete` (`{ id }`) → `deleteEvent_`; hard-deletes the event, purges all its prep tasks (done + outstanding), removes the calendar mirror, appends to ActivityLog.

No new fields, no migrations, no `clasp` deploy.
