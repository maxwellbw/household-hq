# Data Model: Sheets Schema and API (001)

One Google Sheet ("Household HQ DB"), six tabs, one header row each (frozen). All
columns formatted plain text (`@`) at provisioning so Sheets never coerces dates or
UUIDs (research D6). Column order below is the provisioned order, but the app reads by
header name, never by position (research D3). Hand-added extra columns are ignored and
preserved.

Conventions:

- **id**: UUID string (`Utilities.getUuid()` or client-supplied). Blank IDs on
  hand-added rows are adopted per FR-022.
- **datetime**: `YYYY-MM-DDTHH:mm` local household time; **date**: `YYYY-MM-DD`.
  Household timezone lives in Settings (`timezone`, default `America/Los_Angeles`).
- **owner enum**: `max` | `jaz` | `both` — rejected on write otherwise (FR-014);
  surfaced as-is on read.
- **empty cell** = "not set" for every optional field.
- **list values** (snoozeHistory, listItems): `; `-delimited plain text — readable in
  the cell, splittable in code. No JSON blobs (Principle II).

## Events

| Column | Type | Req | Notes |
|---|---|---|---|
| id | UUID | ✔ | |
| title | text | ✔ | non-empty |
| start | datetime | ✔ | |
| end | datetime | ✔ | must be ≥ start |
| owner | enum | ✔ | max/jaz/both |
| type | text | | event type keyword; matches TaskTemplates.eventType (005) |
| templateId | UUID | | reserved for feature 005 |
| notes | text | | arbitrary length, stored intact |
| gcalEventId | text | | reserved for feature 007; never written in 001 |

## Tasks

| Column | Type | Req | Notes |
|---|---|---|---|
| id | UUID | ✔ | |
| title | text | ✔ | non-empty |
| dueDate | date | | undated tasks allowed |
| owner | enum | ✔ | max/jaz/both |
| status | enum | ✔ | `open` \| `done` \| `snoozed`; default `open` on create |
| eventId | UUID | | tether to Events.id (prep task) |
| recurringId | UUID | | tether to Recurring.id (chore instance) |
| completedBy | text | | actor who completed; single value — one completion closes a `both` task (clarified 2026-07-07) |
| completedAt | datetime | | set with completedBy |
| snoozeHistory | list | | `; `-delimited `date→date` entries; behavior in a Phase 2 feature (brief §5 item 11) |
| listItems | list | | `; `-delimited; behavior in a Phase 3 feature (brief §5 item 18) |

Lifecycle: `open → done` (sets completedBy/completedAt) · `open → snoozed → open` ·
any → hard-deleted (row removed; ActivityLog is the record). Reopening a done task
clears completedBy/completedAt.

## TaskTemplates

| Column | Type | Req | Notes |
|---|---|---|---|
| id | UUID | ✔ | |
| eventType | text | ✔ | matches Events.type |
| taskTitle | text | ✔ | |
| offsetDays | integer | ✔ | may be negative: −2 = two days before event start |
| defaultOwner | enum | ✔ | max/jaz/both |

Read-only via API in 001 (`templates.list`); hand-maintained until feature 005.

## Recurring

| Column | Type | Req | Notes |
|---|---|---|---|
| id | UUID | ✔ | |
| title | text | ✔ | |
| cadence | enum | ✔ | `weekly` \| `biweekly` \| `monthly` \| `quarterly` \| `annually` |
| anchorDate | date | ✔ | recurrence phase anchor |
| defaultOwner | enum | ✔ | max/jaz/both |
| lastGenerated | date | | high-water mark; written by feature 004's trigger |
| seasonStart | integer 1–12 | | with seasonEnd: instances only in window (clarified 2026-07-07) |
| seasonEnd | integer 1–12 | | window may wrap year end (11→2 = Nov–Feb); blank pair = year-round |

Validation: seasonStart/seasonEnd must both be set or both blank; each 1–12
(wrap-around is legal, so start > end is valid). Read-only via API in 001
(`recurring.list`); generation behavior is feature 004.

## ActivityLog

| Column | Type | Req | Notes |
|---|---|---|---|
| timestamp | datetime | ✔ | household timezone |
| actor | text | ✔ | declared identity until 002 verifies; `system` for provisioning/blank-ID adoption |
| action | text | ✔ | `create` \| `update` \| `delete` \| `adopt-id` \| `provision` (later features add verbs) |
| targetId | text | ✔ | affected record's id (or tab name for `provision`) |
| detail | text | | human-readable summary, e.g. deleted record's title |

Append-only; no id column (rows are never referenced or edited); exactly one row per
successful mutation (FR-019), zero for failures.

## Settings

Key–value layout: columns `key` | `value` | `notes`. Seeded by `setupDatabase()`:

| key | seeded value | consumer |
|---|---|---|
| allowedEmails | *(blank — fill by hand)* | feature 002; `; `-delimited pair |
| timezone | `America/Los_Angeles` | all date handling (FR-009) |
| householdCalendarId | *(blank)* | feature 007 |
| digestSchedule | *(blank)* | feature 008 |
| ntfyTopicMax / ntfyTopicJaz | *(blank)* | feature 009 |
| workIcsUrlMax / workIcsUrlJaz | *(blank)* | feature 011 |
| householdLat / householdLon | *(blank)* | feature 011 |
| weatherHeatF / weatherMorningCutoff / weatherPrecipPct / weatherColdFloorF | `80` / `10:00` / `40` / `25` | feature 011 |

Read-only via API in 001 (`settings.list`); hand-edited in the Sheet. `settings.list`
returns all keys — nothing secret lives here (topics/URLs arrive with their features,
and R1's outcome may move genuinely sensitive values before any are added).

## Relationships

```text
Events 1 ←— 0..n Tasks (Tasks.eventId)
Recurring 1 ←— 0..n Tasks (Tasks.recurringId)
TaskTemplates —(eventType keyword)→ Events.type      [generation-time only, feature 005]
ActivityLog —(targetId, informational)→ any record   [no referential enforcement]
```

Referential integrity is advisory, not enforced: a Task whose eventId no longer exists
is still served (its tether is simply dangling — the UI decides presentation). Deletes
do not cascade in 001; cascade questions belong to features 003/005.
