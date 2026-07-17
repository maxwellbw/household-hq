# Data Model — Bug-fix batch 4

**No Sheet schema change.** This feature adds no tabs, columns, or new persisted concepts. It surfaces existing data and hardens existing behavior. Entities below are listed only to document what each fix touches and how.

## Entities touched

### DogWalk (existing `DogWalks` tab) — read-only

- Fields used: `id`, `date`, `slot`, `windowStart`, `windowEnd`, `status` (booked / suggested / needs-decision / moved), `reason`.
- US1: `windowStart`/`windowEnd` render in the Day Peek as the walk's time window; `status`/`reason` drive the row's treatment (needs-decision ⚠️).
- No writes. Booking/moving remains out of scope (feature 031).

### Task (existing `Tasks` tab) — read-only for this feature

- Field used: `status` (`open` | `done` | `snoozed`).
- US2: `status === 'done'` drives the strikethrough (`line-through text-ink-faint`) on `TaskDetailSheet` and `EventContent` task chips. No schema or write change.

### Event + TaskTemplate / prep tasks (existing `Events`, `TaskTemplates`, `Tasks` tabs) — existing write path

- Fields used: `Event.templateId` (already exists), `TaskTemplate.eventType`, prep `Task` rows keyed by `prepTaskId_(eventId, stepId)`.
- US5: the new picker sets `Event.templateId` on create/edit. Attachment is done by the **existing** idempotent `syncPrepForEvent_` (reconciles prep against `templateId`; `prepGeneratedFor` tracks the last-applied template so re-apply doesn't duplicate and swap removes not-yet-started prep). Existing ActivityLog rows are appended by the existing `createEvent_`/`updateEvent_`/prep-sync paths.

### Notice dismissal state (existing per-device `localStorage`) — read + write, unchanged shape

- Keys: `hq.dogWalkDismissed` (values `date:slot:reason`), `hq.ackDismissed` (values `taskId:ackAt`).
- US3: the fix is to **read** the already-persisted set on every render (via existing `isDismissed(key)`), not to change what is stored. No shape change.

## Non-persisted / behavior-only changes

- US4 (scroll lock): transient DOM state on the scroll container while a sheet is open; ref-counted, restored on close. No persistence.
- US6 (forecast fetch): in-memory retry inside `fetchForecast_`; no new stored data. (The existing per-slot DogWalks idempotency is preserved.)
- US7 (calendar flash): render-stability only; no data change.

## Invariants preserved

- Idempotent generation (Constitution V): prep attach via `syncPrepForEvent_`; dog-walk finder one-row-per-slot.
- Every state change logged (Constitution VI): the only writes (template attach on event create/edit) already append ActivityLog.
- Sheet remains human-readable/hand-editable (Constitution II): unchanged.
