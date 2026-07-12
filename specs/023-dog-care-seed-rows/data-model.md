# Data Model: Dog-care recurring seed rows

No new tables or columns. This feature adds two legal values to an existing typed column
and four rows to the in-code seed pack. All existing entities (Recurring rule, applied-seed
ledger) are reused from features 004/015 unchanged.

## Cadence value set (extended)

`CADENCES` (backend `Config.js`) — the allow-list the `cadence` column is validated
against, and the step vocabulary the recurring engine understands:

| Value | Step (per occurrence) | Status |
|-------|-----------------------|--------|
| `weekly` | +7 days | existing |
| `biweekly` | +14 days | existing |
| `monthly` | +1 calendar month (day-clamped) | existing |
| **`sixweekly`** | **+42 days** | **new** |
| **`eightweekly`** | **+56 days** | **new** |
| `quarterly` | +3 calendar months (day-clamped) | existing |
| `annually` | +12 calendar months (day-clamped) | existing |

- The two new cadences are **day-based** (like weekly/biweekly), so `CADENCE_STEP_` uses
  `addDays_(ymd, 42)` / `addDays_(ymd, 56)`. No month-clamping subtleties.
- Validation is unchanged: `isValidType_('cadence', v)` returns `CADENCES.indexOf(v) >= 0`,
  so listing the values in `CADENCES` is sufficient to permit both API writes and
  hand-typed Sheet values.

### Frontend mirror (`types/domain.ts`)

```ts
export type Cadence =
  | 'weekly' | 'biweekly' | 'monthly'
  | 'sixweekly' | 'eightweekly'
  | 'quarterly' | 'annually'
```

Display labels (`RecurringManager.tsx`, matching `biweekly`'s "Every two weeks" style):
`sixweekly → "Every six weeks"`, `eightweekly → "Every eight weeks"`.

## Dog-care seed chores (appended to `SEED_PACK`)

Each entry has the same shape as the existing 015 chores: `{ seedKey, title, cadence,
anchorRule, defaultOwner }` (no `seasonStart`/`seasonEnd` — year-round).

| seedKey | title | cadence | anchorRule | defaultOwner |
|---------|-------|---------|------------|--------------|
| `flea-tick` | Flea/tick meds | `monthly` | `today` | `both` |
| `heartworm` | Heartworm meds | `monthly` | `today` | `both` |
| `nail-trim` | Nail trim | `sixweekly` | `today` | `both` |
| `grooming` | Grooming | `eightweekly` | `today` | `both` |

- **Identity** = `seedKey` (never title). A chore is "already applied" if its key is in the
  `recurringSeedApplied` ledger **or** is the `seedKey` of a live Recurring row — the 015
  rule, unchanged. Guarantees no duplicates, survives hand-edits/renames, never resurrects
  a hand-deleted chore.
- **Applied-seed ledger** (`Settings.recurringSeedApplied`) — existing `; `-delimited key
  set; the four new keys append to it on first successful seed. No format change.
- Seed keys are globally unique across the whole pack (the existing `unitSeedPack_`
  uniqueness assertion now covers 12 keys).

## Resulting Recurring rows (after seeding)

Each seeded chore becomes an ordinary Recurring row via `createRecord_`: a fresh
`Utilities.getUuid()` `id`, `title`, `cadence`, `anchorDate` = the resolved anchor
(`today`), `defaultOwner` = `both`, empty `lastGenerated`, and the `seedKey`. The nightly
recurring generator (feature 004) then materializes Task occurrences on the cadence with no
rule-specific handling.

## Validation rules (all pre-existing, now covering the new values)

- `cadence` ∈ `CADENCES` (now 7 values) — reject on write, warn on read (unchanged
  `FIELD_TYPES.Recurring.cadence = 'cadence'`).
- `anchorDate` is a valid `YYYY-MM-DD` date (`today` resolves to one).
- `defaultOwner` ∈ `OWNERS` (`both`).
- Required-on-create for Recurring: `title`, `cadence`, `anchorDate`, `defaultOwner` — all
  present in every seed chore.
