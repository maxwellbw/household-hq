# Data Model: Google Calendar Sync (gcal-sync)

No new tab. One additive column, two new Settings keys, and the shape of a mirrored calendar
entry. All Sheet values stay plain text / ISO 8601 (Principle II).

## Tabs touched

### Events (existing — no schema change)

Uses the already-reserved **`gcalEventId`** column as the mirror pointer.

| Field         | Role in this feature |
|---------------|----------------------|
| `id`          | tag `hhqId` on the calendar entry; `targetId` in the `gcal-sync` log |
| `title`       | calendar entry title body (after the owner prefix) |
| `start`,`end` | calendar entry start/end (ISO datetime, household tz); `end ≥ today` ⇒ desired |
| `owner`       | drives the `[Max]/[Jaz]/[Both]` prefix + event color |
| `gcalEventId` | **pointer**: the mirrored Google event id, or blank. Written by the sync; hand-clearing it forces a fresh mirror |

### Tasks (existing — **one additive column**)

`HEADERS.Tasks` gains **`gcalEventId`** (appended after `listItems` by the generic
`migrateHeaders_` on the next `setupDatabase()`; plain text, hand-readable).

| Field         | Role in this feature |
|---------------|----------------------|
| `id`          | tag `hhqId`; `targetId` in the log |
| `title`       | calendar entry title body |
| `dueDate`     | all-day entry date (ISO `YYYY-MM-DD`, household tz). Non-empty AND `≥ today` required to be desired |
| `owner`       | prefix + color |
| `status`      | desired only when `open` or `snoozed`; `done` ⇒ entry removed |
| `gcalEventId` | **NEW pointer**: the mirrored Google event id, or blank |

**Desired-on-calendar predicate**
- Event: `end` (date part) `≥ today`.
- Task: `dueDate ≠ '' AND dueDate ≥ today AND status ∈ {open, snoozed}`.

A record that is not desired but has a non-blank `gcalEventId` ⇒ delete the entry, clear the
cell.

### Settings (existing — **two new seeded keys**)

Appended to `SETTINGS_SEED` (seeded only if absent, so hand-set values survive):

| Key                   | Default | Notes |
|-----------------------|---------|-------|
| `householdCalendarId` | *(blank)* | already seeded (feature 007). The shared Household calendar id; blank ⇒ sync no-ops |
| `gcalEventReminderMin`| `30`    | popup minutes before a **timed event** |
| `gcalTaskReminderTime`| `09:00` | morning-of popup clock time for **all-day task** entries |
| `timezone`            | `America/Los_Angeles` | already seeded; all date handling |

### ActivityLog (existing — no schema change)

One appended row per calendar mutation: `action = gcal-sync`, `actor = system`,
`targetId = <record id>`, `detail = <human description>`. See [research.md](research.md) D9.

## Owner → calendar color map

Config constant `OWNER_EVENT_COLOR` (see [research.md](research.md) D4):

| Owner | Prefix   | `CalendarApp.EventColor` | Google name |
|-------|----------|--------------------------|-------------|
| max   | `[Max] ` | `CYAN`                   | Peacock     |
| jaz   | `[Jaz] ` | `MAUVE`                  | Grape       |
| both  | `[Both] `| `ORANGE`                 | Tangerine   |

## Mirrored calendar entry (on the Household calendar)

| Property     | Event mirror                          | Dated-task mirror |
|--------------|---------------------------------------|-------------------|
| kind         | timed `createEvent(title, start, end)`| all-day `createAllDayEvent(title, dueDate)` |
| title        | `[Owner] ` + `title`                  | same |
| color        | per owner (table above)               | same |
| reminder     | popup `gcalEventReminderMin` before start | morning-of popup at `gcalTaskReminderTime` |
| tag `hhqId`  | Event `id`                            | Task `id` |
| tag `hhqKind`| `event`                               | `task` |

## Lifecycle → mirror effect

| App action                          | Mirror effect |
|-------------------------------------|---------------|
| Event create (end ≥ today)          | create entry, store `gcalEventId`, tag |
| Event update (title/time/owner)     | update same entry in place |
| Event delete                        | delete entry (if pointer set) |
| Event recedes into past             | left in place (no retro-delete); orphan sweep ignores past |
| Task create with dueDate ≥ today    | create all-day entry, store pointer, tag |
| Task update: dueDate changes        | move same entry to new date |
| Task update: dueDate cleared        | delete entry, clear pointer |
| Task update: owner changes          | update prefix + color in place |
| Task complete (`done`)              | delete entry, clear pointer |
| Task reopen (`open`)                | re-create entry (pointer was cleared) |
| Task delete                         | delete entry (if pointer set) |
| Row deleted directly in the Sheet   | nightly **orphan sweep** deletes the tagged entry |
| `householdCalendarId` blank         | all of the above no-op |
