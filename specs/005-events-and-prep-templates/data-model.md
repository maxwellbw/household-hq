# Data Model: Events and Prep Templates (Phase 1)

One additive column (`prepGeneratedFor` on Events); everything else reuses tabs and fields
provisioned in feature 001 (`Config.HEADERS`). This file documents the fields **as used by
feature 005**, the schema change and its migration, and the derived (not stored) values.

## Events — existing tab, +1 column, prep wired into CRUD

Columns (`Config.HEADERS.Events`), provisioned order, with the new field appended:

| Field | Type (`FIELD_TYPES`) | Writable via API | Meaning in 005 |
|---|---|---|---|
| `id` | uuid | server-generated | Stable event id (`Utilities.getUuid()`; blank-id rows adopted per 001 FR-022). |
| `title` | text | ✅ required on create | Event title. |
| `start` | `datetime` | ✅ required on create | ISO `YYYY-MM-DDTHH:mm`; prep dates key off its **date part**. |
| `end` | `datetime` | ✅ required on create | ISO; must be `>= start` (existing invariant). |
| `owner` | `owner` | ✅ required on create | `max`/`jaz`/`both`. |
| `type` | text | ✅ optional | Free descriptive/display label (concert, work trip). **Does not drive prep** (FR-002a). |
| `templateId` | text | ✅ optional | Prep-checklist **selector**: matches a checklist's `eventType`. Blank ⇒ no prep. |
| `notes` | text | ✅ optional | Free notes. |
| `gcalEventId` | text | (reserved) | External-calendar reference (feature 007). |
| `prepGeneratedFor` | text | ❌ generator-managed (D9) | **NEW.** The `templateId` whose prep has been materialized for this event. Blank ⇒ none yet. Tombstone that gates creation to transitions (D2). |

**Validation** (write path, all reused): `rejectUnknownFields_(TABS.EVENTS, payload)` (now
includes `prepGeneratedFor` as a column, but it is refused when client-supplied, below);
`requireFields_` against `REQUIRED_ON_CREATE.Events = ['title','start','end','owner']`;
`validateFields_` (`start`/`end` datetime, `owner`); `end >= start` invariant.
`prepGeneratedFor` present on `events.create`/`events.update` ⇒ `BAD_REQUEST` (D9); it is
written only by the generator.

**Lifecycle** (prep side effects via `syncPrepForEvent_`, D3):
- *create* → row inserted (`prepGeneratedFor` blank); logs `create` by user; then
  `syncPrepForEvent_` generates prep for `templateId` (if set) and sets `prepGeneratedFor`.
- *update* → editable fields patched; logs `update` by user; then `syncPrepForEvent_` re-dates
  outstanding prep if `start` moved (FR-015) and swaps the set if `templateId` changed (FR-016).
- *delete* → `deleteEvent_` removes the row **and all** prep tasks for the event (FR-017); logs
  `delete` for the event and each purged prep task, by the acting user.

## TaskTemplates (prep-checklist step) — existing tab, now API-writable

A "checklist" is the set of steps sharing an `eventType`. Columns (`Config.HEADERS.TaskTemplates`):

| Field | Type (`FIELD_TYPES`) | Writable via API | Meaning in 005 |
|---|---|---|---|
| `id` | uuid | server-generated | Stable step id; the deterministic prep-task id depends on it (D1). |
| `eventType` | text | ✅ required on create | The event kind this step belongs to; the join key matched against an event's `templateId`. |
| `taskTitle` | text | ✅ required on create | Becomes the generated prep task's title. |
| `offsetDays` | `int` | ✅ required on create | Signed days relative to event start; T−2 = `-2` (D5). |
| `defaultOwner` | `owner` | ✅ required on create | `max`/`jaz`/`both`; becomes the prep task's owner. |

**Validation**: `rejectUnknownFields_` → `requireFields_` against the new
`REQUIRED_ON_CREATE.TaskTemplates = ['eventType','taskTitle','offsetDays','defaultOwner']` →
`validateFields_` (`offsetDays` int, `defaultOwner` owner). **Editing/deleting a step does not
rewrite already-generated prep** (D8); a new step is picked up on the next tag/retag/generation
of an event of that kind.

## Tasks (generated prep task) — existing tab, rows added by the generator

A generated prep task is an ordinary Task (`Config.HEADERS.Tasks`); `syncPrepForEvent_` sets:

| Field | Value set by generator |
|---|---|
| `id` | **Deterministic** `'p' + hex(MD5(eventId + '|' + templateStepId))` (D1) — the idempotency key **and** the prep-task discriminator (`^p[0-9a-f]{32}$`). |
| `title` | Step's `taskTitle` (FR-009). |
| `dueDate` | `dateOf(event.start) + offsetDays` — ISO `YYYY-MM-DD` (FR-009); may be in the past (FR-018). |
| `owner` | Step's `defaultOwner` (FR-009). |
| `status` | `open`. |
| `eventId` | The event's `id` — the back-link (FR-010). |
| `recurringId`, `completedBy`, `completedAt`, `snoozeHistory`, `listItems` | blank. |

Once created it is a normal task: complete/reopen/edit/delete behave exactly as feature 003
specifies, and none of them touch the event or the checklist (FR-013). The deterministic id +
the `prepGeneratedFor` marker together give at-most-once creation and non-resurrection of a
hand-deleted prep task (D1/D2 · FR-011/FR-014).

## Schema change & migration

- **`Config.HEADERS.Events`** gains a trailing `prepGeneratedFor` column. Order-independent —
  `buildHeaderMap_` maps by name — but it **must physically exist** on the live Events tab or
  `buildHeaderMap_` fails `SCHEMA_MISMATCH`.
- **`Setup.js` migration**: `setupDatabase()` is extended to, for each already-provisioned tab
  (row 1 non-empty), **append any expected header that is missing** to the end of row 1 (plain
  text, existing columns/data untouched). Idempotent and general (future column adds ride the
  same path). Re-run once after this feature's `clasp push` (quickstart step 1).
- No new tab. No new Settings key. `API_VERSION` bumps `1.1.0` → `1.2.0` (additive).

## Derived values (computed each run, never stored)

- **desired prep set** for an event = for each `TaskTemplates` row with `eventType ==
  event.templateId`: `{ id: prepTaskId_(event.id, step.id), dueDate: addDays_(event.start[0:10],
  offsetDays), title: taskTitle, owner: defaultOwner, eventId, status: open }`.
- **transition vs steady state** = `event.templateId != event.prepGeneratedFor` ⇒ create the
  desired set + retire the old template's outstanding prep + advance the marker; `==` ⇒ re-date
  outstanding survivors only, create nothing (D2/D3).
- **an event's prep tasks** = `Tasks` where `eventId == event.id` and `id` matches
  `^p[0-9a-f]{32}$` (excludes a user's manually event-linked tasks).

## Enumerations & actors (existing, `Config.js`)

- `OWNERS = ['max','jaz','both']` (for `owner`/`defaultOwner`).
- `offsetDays` is any signed integer (`int` type); negatives are the common case.
- Actor for generation / re-dating / marker writes: `system`
  (`ACTOR_DISPLAY_NAMES.system = 'System'`). Event/template CRUD: the acting user.
