# Phase 1 Data Model: Recurring Seed Pack & Alternating Weeks

## Schema changes

### Recurring tab — new column `seedKey`

Added to `HEADERS.Recurring` (`backend/Config.js:63`), landing after `seasonEnd` via the existing
`migrateHeaders_` migration (`backend/Setup.js:60`). New full header order:

```
id · title · cadence · anchorDate · defaultOwner · lastGenerated · seasonStart · seasonEnd · seedKey
```

| Field | Type | Written by | Notes |
|-------|------|-----------|-------|
| `seedKey` | text (slug) | `seedRecurringPack()` only | Stable per-chore identifier for pack-origin rows, e.g. `trash`, `hvac-filter`. Blank for hand- or API-created rules. Free-text (not in `FIELD_TYPES`), so it is neither validated nor required. The recurrence generator ignores it. |

No other Recurring field changes. `seedKey` is **not** added to `REQUIRED_ON_CREATE` and **not**
typed in `FIELD_TYPES` — hand/API rules simply leave it empty.

### Settings tab — new key `recurringSeedApplied`

Added to `SETTINGS_SEED` (`backend/Config.js:198`) so `setupDatabase()` creates the row:

| key | value (seed) | notes |
|-----|--------------|-------|
| `recurringSeedApplied` | `` (empty) | feature 015; `; `-delimited list of seed keys the seeder has applied. Durable record enabling never-resurrect. Clear a key by hand (and delete its row) to re-enable seeding of that chore. |

The **applied-keys ledger** is this value parsed as a `; `-delimited set. `seedRecurringPack()`
reads it via `readSettingsMap_()`, unions it with the `seedKey`s of live Recurring rows to decide
skips, and writes back the row (creating it if absent) after appending any newly-seeded keys.

## The seed pack

Eight rules. `defaultOwner` = `both` for all. Anchors are **placeholders computed at seed time**
relative to the run date `T` (household corrects them afterward). Cadences use only existing engine
values.

| seedKey | title | cadence | anchor (placeholder) | seasonStart | seasonEnd | Purpose |
|---------|-------|---------|----------------------|-------------|-----------|---------|
| `trash` | Trash | weekly | `T` (next collection day) | — | — | Weekly curbside trash |
| `recycling` | Recycling | biweekly | `T` (week A) | — | — | Alternating with yard waste |
| `yardwaste` | Yard waste | biweekly | `T + 7` (week B) | — | — | Offset one week from recycling |
| `hvac-filter` | Change HVAC air filter | quarterly | `T` | — | — | Quarterly maintenance |
| `dishwasher-filter` | Clean dishwasher filter | monthly | `T` | — | — | Monthly maintenance |
| `gutters` | Clean gutters | annually | next `MM-15` in Oct ≥ `T` | — | — | Once/year, fall (single rule per clarify) |
| `detector-batteries` | Replace smoke/CO detector batteries | annually | next `Nov-01` ≥ `T` | — | — | Once/year, fall (DST convention) |
| `mow-lawn` | Mow lawn | weekly | `T` | `4` | `10` | Weekly, April–October only (FR-006) |

**Anchor computation** (implementation detail, captured for tasks): `T` = today in the household
timezone as `YYYY-MM-DD`. `recycling` and `yardwaste` anchors differ by exactly 7 days so their
14-day biweekly steps interleave (R1). Fall anchors (`gutters`, `detector-batteries`) resolve to the
next occurrence of their month/day on or after `T`.

## Entities (from spec)

- **Starter pack** → the `SEED_PACK` constant in `Config.js`: an ordered array of
  `{ seedKey, title, cadence, anchorRule, defaultOwner, seasonStart?, seasonEnd? }`. Source of
  *initial* data only.
- **Seeded recurring rule** → an ordinary Recurring row whose `seedKey` is non-empty. Structurally
  identical to any other rule; the generator treats it no differently.
- **Seed key** → the `seedKey` column value; sole identity for dedup/edit-preservation.
- **Applied-keys ledger** → the parsed `recurringSeedApplied` Settings value; durable applied-set
  for never-resurrect.
- **Alternating bin pair** → the `recycling` + `yardwaste` rows; a documented relationship, not a
  distinct entity.

## Idempotency & lifecycle

- **First run** (no keys applied): appends all 8 rows with `seedKey` set (each via the existing
  `createRecord_`, which appends its own `create` `ActivityLog` row, actor `system` — the same
  per-row logging the recurring generator already uses for occurrences); adds all 8 keys to the
  ledger.
- **Re-run, nothing changed**: every key is in `applied` → zero rows appended, ledger unchanged, **no**
  ActivityLog entry (FR-009).
- **Re-run after a household edit** (owner/anchor/cadence/season/title of a seeded row): the row's
  `seedKey` is in `applied` → skipped untouched (FR-004).
- **Re-run after a household deletes a seeded row**: its key is still in the ledger → skipped, **not**
  re-added (FR-004b, never-resurrect).
- **Deliberate re-seed**: household deletes the row **and** removes its key from `recurringSeedApplied`
  → next run re-appends it.

## Validation rules

- All seeded `cadence` values ∈ `CADENCES` (`Config.js:78`); all `defaultOwner` ∈ `OWNERS`.
- Seeded `anchorDate` is a valid `YYYY-MM-DD` string in the household timezone.
- `seasonStart`/`seasonEnd` are whole months 1–12 (only `mow-lawn` sets them: 4 and 10).
- Writes go through `createRecord_` (locked, id via `Utilities.getUuid()`), so seeded rows get real
  UUID `id`s and are safe under concurrent writes (Principle V).
