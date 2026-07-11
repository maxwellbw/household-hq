# Data Model: UX Fix Batch

**No schema change.** This feature adds no Sheet columns, entities, or backend fields. It exposes editing of fields the Task entity already has.

## Task (existing — `Tasks` tab)

Relevant columns (from `backend/Config.js` `SCHEMA.Tasks`): `id`, `title`, `dueDate`, `owner`, `status`, `eventId`, `recurringId`, `snoozeHistory`, `gcalEventId`, …

| Field | Type | Editable in this feature? | Rules |
|-------|------|---------------------------|-------|
| `id` | uuid | No | Immutable identity; used as the `tasks.update` key. |
| `title` | string | **Yes** | MUST be non-empty after trim (FR-009). |
| `owner` | `max` \| `jaz` \| `both` | **Yes** | One of the three owner identities (FR-006). |
| `dueDate` | ISO `YYYY-MM-DD` or empty | **Yes** | May be set to a date or cleared to `''` (→ undated/Someday) (FR-007). |
| `status` | `open` \| `snoozed` \| `done` | **No** | Not editable via `tasks.update` (backend rejects); completion/snooze keep their own paths (FR-010). |
| `eventId` / `recurringId` / `gcalEventId` | string | No | Managed by tether/recurrence/sync; untouched. |

### Undated task (Someday) — the create path (US1)

A one-time task created with **no** `dueDate` is valid (`REQUIRED_ON_CREATE.Tasks = ['title','owner']`). Such a task:
- has empty `dueDate`,
- appears in the **Someday** list (feature 013),
- does **not** appear on the calendar (calendar filters standalone tasks to those with a `dueDate` — `CalendarHome` `visibleStandaloneTasks` already requires `t.dueDate`).

### Editable-field set (edit sheet)

`TaskEditSheet` sends only changed fields in the `tasks.update` payload:

```
{ id, title?, owner?, dueDate? }   // dueDate: 'YYYY-MM-DD' to set, '' to clear
```

State transitions the edit produces (all via one `tasks.update`, all logged to ActivityLog by the backend):

- **dated → undated**: `dueDate: ''` → task leaves the calendar, joins Someday, calendar mirror removed (backend `mirrorTaskToCalendar_`).
- **undated → dated**: `dueDate: 'YYYY-MM-DD'` (+ owner already required to be set) → task appears on the calendar.
- **reassign**: `owner` change → owner color/identity updates everywhere; calendar mirror recolored (backend).
- **rename**: `title` change → propagates to list, calendar, dashboard on `['tasks']` invalidation.
