# Contract: Scheduling a Someday Task (reused `tasks.update`)

**Feature**: 013-someday-list | **Phase 1**

**This feature adds no new backend action.** Scheduling a someday task is a plain
`tasks.update`, which already exists, is `LockService`-wrapped, appends to ActivityLog,
and mirrors to the calendar (`backend/Api.js` → `updateTask_`). No `/backend` change, no
clasp redeploy.

## Action consumed: `tasks.update`

**Request** (via the app's `apiCall`, `text/plain` POST with JSON body + ID token):

```json
{
  "action": "tasks.update",
  "id": "<task uuid>",
  "dueDate": "2026-08-15",
  "owner": "max"
}
```

- `id` — required; the someday task being scheduled.
- `dueDate` — ISO `YYYY-MM-DD` in the household timezone. Non-empty (a someday task
  cannot be "scheduled" to nothing — enforced client-side by `canConfirm`, FR-008).
- `owner` — `max` | `jaz` | `both`. Explicitly chosen in the dialog (FR-007); never
  inferred from the caller's identity.
- **Not sent**: `status`, `completedBy`, `completedAt` — `updateTask_` rejects these with
  `BAD_REQUEST`. The task is already `open`; scheduling must not touch status.

**Response**: the updated task record (post-mirror re-read), e.g.

```json
{ "task": { "id": "…", "title": "Air-duct cleaning", "dueDate": "2026-08-15",
            "owner": "max", "status": "open", "eventId": "", … } }
```

**Side effects (already implemented, relied upon here)**:
- ActivityLog append: an `update` row (timestamp, actor, action, targetId) — satisfies
  FR-015 with no new code. The actor is resolved from the ID token / acting person
  (shared account resolves to a real person).
- Calendar mirror updated via `mirrorTaskToCalendar_` (the task now has a date).

**Idempotency**: re-sending the same `{id, dueDate, owner}` is a no-op patch (constitution
V) — safe under optimistic retries.

## Client integration

- Hook: `useScheduleTask()` in `src/hooks/useMutations.ts`, cloning `useUpdateEvent()`:
  `mutationFn` → `apiCall('tasks.update', payload, { token, actingPerson })`;
  `onSuccess` → `queryClient.invalidateQueries({ queryKey: ['tasks'] })`;
  errors routed through `handleAuthError` then re-thrown (drives the FR-014 toast).
- Payload built by `buildSchedulePayload(draft)` (see data-model.md).

## Error modes

| Case | Client behavior |
|---|---|
| Network / 5xx | Task stays in Someday; toast "Couldn't schedule — try again" (FR-014); dialog may stay open for retry. |
| Auth expired | `handleAuthError` triggers the existing re-auth path; no silent data loss. |
| Concurrent change (other user scheduled/completed it first) | On invalidate/refetch the list reflects current truth; a stale second write is a harmless no-op or updates an already-dated task — no resurrection of a stale row (edge case in spec). |
