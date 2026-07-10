# Contract: tasks.snooze / tasks.unsnooze (+ reused actions)

Transport is unchanged (feature 001): `text/plain` POST of `{ action, token, payload }`;
HTTP is always 200; `ok` is the success discriminator. Shared-account callers must include
`payload.actingPerson ∈ {max, jaz}` on these actions (see below).

## NEW — `tasks.snooze`

Move an open/snoozed task to a later due date and mark it `snoozed`, appending to its
snooze history. Idempotent.

**Request payload**
| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | task id |
| `dueDate` | ISO date | yes | the new (later) due date to snooze until |
| `actingPerson` | `max`\|`jaz` | shared-account only | resolves the actor |

**Behavior**
- Auth gate runs first (feature 002); `actor` is the verified person (never client-supplied).
- `withLock_` → read task by id (`NOT_FOUND` if missing).
- If task is already `snoozed` **and** `dueDate` already equals the requested date →
  no-change: return `{ task, changed:false }`, **no** ActivityLog row, **no** history append.
- Else: set `status='snoozed'`, set `dueDate=<new>`, append one `snoozeHistory` entry
  (`<oldDue|∅>→<newDue> @ <nowIso>`), write the row, append ActivityLog `snooze`.
- Returns `{ task, changed:true }`.

**Response** `{ ok:true, data:{ task:<Task>, changed:boolean } }`

**Errors**: `NOT_FOUND` (bad id), `BAD_REQUEST` (missing/invalid `id` or `dueDate`),
`ACTING_PERSON_REQUIRED` (shared account without `actingPerson`), standard auth errors.

## NEW — `tasks.unsnooze`

Return a snoozed task to `open` (keeps its current dueDate; history is preserved).
Idempotent.

**Request payload**
| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | task id |
| `actingPerson` | `max`\|`jaz` | shared-account only | resolves the actor |

**Behavior**
- If task is already `open` → no-change (`changed:false`, no log row).
- Else set `status='open'`, write, append ActivityLog `unsnooze`. `snoozeHistory` untouched.

**Response** `{ ok:true, data:{ task:<Task>, changed:boolean } }`

**Errors**: as for `tasks.snooze` (minus `dueDate`).

## Config changes supporting these actions

- `ACTION_VERBS += { snooze: 'snoozed', unsnooze: 'un-snoozed' }` so the Feed renders e.g.
  "Max snoozed 'Change air filter'".
- `isWriteAction_` extended to also match the lifecycle verbs
  `complete|reopen|snooze|unsnooze` (not only create/update/delete), so shared-account
  callers resolve to a real `actor` on every state change (constitution VI). This also
  fixes the pre-existing shared-account gap for complete/reopen.

## Reused actions (no change — used by the new UI)

| UI surface | Action(s) |
|---|---|
| Tasks list load | `tasks.list` |
| Check-off / reopen from Tasks list | `tasks.complete` / `tasks.reopen` (existing) |
| Feed view | `activity.list` (existing; now also renders snooze/unsnooze verbs) |
| Event create (with end) | `events.create` (existing; payload already carries `end`) |
| Event edit (new sheet) | `events.update` (existing) |
| Recurring manager | `recurring.list` / `recurring.create` / `recurring.update` / `recurring.delete` (existing) |
| Templates manager | `templates.list` / `templates.create` / `templates.update` / `templates.delete` (existing) |

## SelfTest coverage to add (`backend/SelfTest.js`)

1. snooze open task → `changed:true`, `status='snoozed'`, `dueDate` updated, `snoozeHistory`
   has one entry, one ActivityLog `snooze` row.
2. snooze again to a new date → second history entry, dueDate moved, second log row.
3. snooze to the same date again → `changed:false`, no new history/log row (idempotent).
4. unsnooze → `status='open'`, history preserved, one `unsnooze` log row; unsnooze again →
   `changed:false`.
5. shared-account snooze without `actingPerson` → `ACTING_PERSON_REQUIRED`; with it → actor
   is the named person in the log (guards the R4 `isWriteAction_` change).
