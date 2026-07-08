# Data Model: Recurring Chore Engine (Phase 1)

No new tab and no new columns — the Recurring and Tasks tabs already carry every field this
feature needs (provisioned in feature 001, `Config.HEADERS`). This file documents the fields
as **used by feature 004**, the one new Settings key, and the derived (not stored) values.

## Recurring (rule) — existing tab, now writable via the API

Columns (`Config.HEADERS.Recurring`), in provisioned order:

| Field | Type (`FIELD_TYPES`) | Writable via API | Meaning in 004 |
|---|---|---|---|
| `id` | uuid | server-generated | Stable rule id (`Utilities.getUuid()`; blank-id rows adopted per 001 FR-022). |
| `title` | text | ✅ required on create | Becomes each generated Task's title. |
| `cadence` | `cadence` | ✅ required on create | One of `weekly`/`biweekly`/`monthly`/`quarterly`/`annually` (`CADENCES`). |
| `anchorDate` | `date` | ✅ required on create | `YYYY-MM-DD`; establishes the cycle's phase (weekday for weekly/biweekly, day-of-month for the rest). |
| `defaultOwner` | `owner` | ✅ required on create | `max`/`jaz`/`both`; becomes each generated Task's owner. |
| `lastGenerated` | `date` | ❌ generator-managed (D8) | High-water mark: newest occurrence date already considered. Blank ⇒ never generated. |
| `seasonStart` | `month` (1–12) | ✅ optional | Inclusive first month of the season window. Blank ⇒ year-round. |
| `seasonEnd` | `month` (1–12) | ✅ optional | Inclusive last month. `start > end` wraps the year (Nov–Feb = 11,12,1,2). |

**Validation** (write path, all reused):
- `rejectUnknownFields_(TABS.RECURRING, payload)` — only the columns above are accepted.
- `requireFields_` against `REQUIRED_ON_CREATE.Recurring = ['title','cadence','anchorDate','defaultOwner']`.
- `validateFields_(TABS.RECURRING, payload)` — types per the table (`cadence`, `date`,
  `owner`, `month`).
- `validateSeasonWindow_(seasonStart, seasonEnd)` — both-or-neither; each 1–12; wrap-around
  legal (already implemented + unit-tested in `Validation.js` / `SelfTest.js`).
- `lastGenerated` present on create/update ⇒ `BAD_REQUEST` (D8).

**Lifecycle**:
- *create* → row inserted, `lastGenerated` blank; logs `create` by acting user.
- *update* → title/cadence/anchorDate/defaultOwner/season edited; already-generated Tasks
  untouched (FR-008); logs `update` by acting user.
- *delete* → row removed; already-generated Tasks remain as ordinary tasks (FR-010); logs
  `delete` by acting user.
- *generation* → `lastGenerated` advanced by `system` (logged `update`, only when changed).

## Tasks (generated occurrence) — existing tab, rows added by the generator

A generated occurrence is an ordinary Task (`Config.HEADERS.Tasks`); the generator sets:

| Field | Value set by generator |
|---|---|
| `id` | **Deterministic** `'r' + hex(MD5(recurringId + '|' + dueDate))` (D1) — the idempotency key. |
| `title` | Rule's `title` (FR-004). |
| `dueDate` | The occurrence date `YYYY-MM-DD` (FR-004). |
| `owner` | Rule's `defaultOwner` (FR-004). |
| `status` | `open`. |
| `recurringId` | Rule's `id` — the back-link (FR-005). |
| `eventId`, `completedBy`, `completedAt`, `snoozeHistory`, `listItems` | blank. |

Once created it is a normal task: complete/reopen/edit/delete behave exactly as feature 003
specifies, and none of them touch the rule (FR-008). The deterministic id means a user who
deletes the row and a generator that re-runs do **not** collide — combined with the
`lastGenerated` watermark, the occurrence is not resurrected (D2/FR-013).

## Settings — one new key

| Key | Seed value | Notes |
|---|---|---|
| `recurringLookaheadDays` | `30` | feature 004; days ahead the nightly generator materializes (FR-016). Blank/≤0 ⇒ 30. |

Added to `SETTINGS_SEED` (append-only; `seedSettings_` never overwrites a hand-set value).

## Derived values (computed each run, never stored)

- **windowStart** = `lastGenerated` if set, else `today − 1 day` (so a never-generated rule
  starts at `today` inclusive). Occurrences are taken strictly `> windowStart`.
- **windowEnd** = `today + recurringLookaheadDays`. Occurrences taken while `≤ windowEnd`.
- **occurrence set** = cadence-stepped dates from `anchorDate` within `(windowStart,
  windowEnd]`, each filtered by `inSeason_(month, seasonStart, seasonEnd)` before creation.
- **new lastGenerated** = newest occurrence date **considered** in the window (created or
  season-skipped); unchanged if the window held none.

## Enumerations (existing, `Config.js`)

- `CADENCES = ['weekly','biweekly','monthly','quarterly','annually']`
- `OWNERS = ['max','jaz','both']`
- Actor for generation: `system` (existing `ACTOR_DISPLAY_NAMES.system = 'System'`).
