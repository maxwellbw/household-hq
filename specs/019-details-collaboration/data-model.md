# Data Model — Feature 019: Task & Event Details + Collaboration

All additive. Column order below is the position `migrateHeaders_` will append them in
(after the last existing column of each tab). Everything is stored as plain text (Principle
II); dates are ISO in the household timezone.

## Tasks (tab) — three new columns

Current header order (`Config.js`):
`id, title, dueDate, owner, status, eventId, recurringId, completedBy, completedAt,
snoozeHistory, listItems, gcalEventId`

Appended by this feature:

| Column | Type | Written by | Notes |
|---|---|---|---|
| `notes` | free text | user (create/update) | Free-form; may contain `http(s)://` URLs rendered as links on display. Optional; default `''`. |
| `ackBy` | `max` \| `jaz` \| `''` | server (`tasks.acknowledge`) | The assignee who committed. Non-empty and equal to `owner` ⇒ acknowledged. Cleared on reassignment. |
| `ackAt` | ISO datetime \| `''` | server (`tasks.acknowledge`) | When acknowledged, `YYYY-MM-DDTHH:mm` household tz (via `nowIso_`). Part of the notice dedup key. |

- `notes` is free text → **no** `FIELD_TYPES.Tasks` entry (like `snoozeHistory`).
- `ackBy`/`ackAt` are server-managed → rejected on `tasks.create`/`tasks.update` (join the
  existing `status`/`completedBy`/`completedAt` guard list). No `FIELD_TYPES` entry; values
  are only ever written by the server.

### Acknowledgement lifecycle

Let `P = owner` (a single person, i.e. `owner ∈ {max, jaz}`), `O = otherPerson_(P)`.

| State | Condition | UI (both users) | UI (assignee = P) | UI (assigner = O) |
|---|---|---|---|---|
| **Not committed** | `owner ∈ {max,jaz}` ∧ `status ∈ {open, snoozed}` ∧ `ackBy ≠ owner` | "not yet committed" badge | + **I've got it** button | badge only |
| **Committed** | `ackBy === owner` | no badge | — | dismissible "P has it" notice (until dismissed) |
| **N/A** | `owner === both` ∨ self-view ∨ `status === done` | nothing | nothing | nothing |

Transitions:

- **Acknowledge** (`tasks.acknowledge`, actor must be `P`): `ackBy = P`, `ackAt = now`, log
  `acknowledge`, ping `O` (best-effort). Idempotent: if `ackBy` already `=== P`,
  `changed:false`, no log, no ping.
- **Reassign** (`tasks.update` changes `owner`): if new owner differs, `ackBy = ''`,
  `ackAt = ''` in the same patch (one `update` log row). New assignee re-reads as "not
  committed".
- **Complete** (`tasks.complete`): status→done; the badge disappears (status guard) but the
  assigner's notice does **not** auto-clear (persists until dismissed, per clarify). `ackBy`/
  `ackAt` are untouched by completion.

### Derived predicates (frontend `lib/tasks.ts`)

```
isUncommitted(task, viewer):   // viewer ∈ {max, jaz}
  task.owner !== 'both'
  && (task.status === 'open' || task.status === 'snoozed')
  && task.ackBy !== task.owner

canAcknowledge(task, viewer):
  isUncommitted(task, viewer) && viewer === task.owner
```

Assigner notice (frontend `lib/ackNotices.ts`), for viewer `V`:

```
noticeTasks = tasks.filter(t =>
  t.owner !== 'both' && t.owner !== V && t.ackBy === t.owner)   // V is the non-owner assigner
  minus dismissed keys `${t.id}:${t.ackAt}` (localStorage)
```

## Events (tab) — one new column

Current header order:
`id, title, start, end, owner, type, templateId, notes, gcalEventId, prepGeneratedFor`

Appended by this feature:

| Column | Type | Written by | Notes |
|---|---|---|---|
| `location` | free text | user (create/update) | Free-form address/place. Optional; default `''`. Mirrored to the calendar event's location field (007). |

- `location` is free text → no `FIELD_TYPES.Events` entry.
- `notes` (already present) becomes editable via create/edit UI this feature; its display
  gains link rendering. No schema change for `notes`.

### Calendar mirror mapping (via `syncCalendarForEvent_`)

| App field | Calendar event field | Behavior |
|---|---|---|
| `location` | `setLocation()` | Set on create and on update-in-place; `''` clears it. Enables Maps/directions from the synced calendar. Idempotent — reconciler runs it every sync. |

Tasks are mirrored without a location (tasks have none).

## ActivityLog (tab) — no schema change

New `action` value `acknowledge` (feed verb "committed to" — see contracts). Note/location
edits reuse the existing `update` action. All are appended via the existing `appendLog_`.

## Non-persisted state

- **Ack notice dismissals**: `localStorage` key set of `"<taskId>:<ackAt>"` strings
  (`lib/ackDismissals.ts`). Per-device UI state only; never written to the Sheet (research
  R4). Cleared naturally when a key is no longer produced (task deleted / re-acknowledged).
