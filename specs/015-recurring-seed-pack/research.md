# Phase 0 Research: Recurring Seed Pack & Alternating Weeks

All open questions from the spec were resolved in the 2026-07-10 clarify session. This document
records the resulting engineering decisions and the alternatives weighed.

## R1 — Alternating bins with no new engine concept

**Decision**: Model curbside collection as three ordinary rules against the existing engine:
- **Trash** — `weekly`, anchored on a placeholder collection day.
- **Recycling** — `biweekly`, anchored on the same placeholder day (week A).
- **Yard waste** — `biweekly`, anchored **7 days after** recycling (week B).

The engine's `biweekly` cadence is a fixed 14-day step from `anchorDate`
(`Recurring.js:55`, `CADENCE_STEP_`). Two biweekly rules whose anchors differ by 7 days therefore
never land in the same week and each recurs every other week; the weekly trash rule fills every
week. Verified by `occurrencesInWindow_` over an 8-week window in the self-test (SC-004).

**Rationale**: Satisfies FR-007/FR-008 with zero engine change — the whole point of the feature is
that the existing primitive already covers the most common "alternating" real-world case.

**Alternatives considered**: (a) A new `alternating` cadence or an "every N weeks with phase"
field — rejected: adds a concept the engine doesn't need and the household would have to learn,
violating Principle IV. (b) A single biweekly rule with two titles — impossible; a rule has one
title/owner.

## R2 — Identity & never-resurrect: seedKey column + Settings ledger

**Decision** (from clarify): identify pack-origin rows by a stable **`seedKey`** slug stored in a
new plain-text Recurring column (not by title), and keep a durable **applied-keys ledger** in
Settings (`recurringSeedApplied`, a `; `-delimited list of keys). The seeder skips a pack chore
when its key is *already applied*, where "applied" = present in the ledger **or** present as the
`seedKey` of a live Recurring row.

Skip/append rule per pack chore `c`:
```
applied = set(parse ledger) ∪ { row.seedKey for row in Recurring if row.seedKey != '' }
if c.seedKey ∈ applied:  skip           # present (any title), or deleted-but-remembered
else:                     append row with seedKey = c.seedKey; add c.seedKey to ledger
```

**Rationale**:
- The **column** gives identity that survives a title rename (FR-004) and gives a human opening the
  Sheet visible provenance for pack rows (Principle II).
- The **ledger** is what makes deletion permanent (FR-004b): once a key is applied it stays in the
  ledger even after the row is deleted, so the seeder never resurrects it — mirroring how the engine
  advances its watermark past a deleted occurrence (feature 004). A row alone cannot remember its own
  deletion.
- Taking the **union** with live-row `seedKey`s prevents a duplicate if the household hand-clears a
  ledger key while the row still exists.

**Escape hatch** (FR-011 / edge case): to deliberately re-seed a removed chore, the chore must be
genuinely absent — remove its row **and** delete its key from the `recurringSeedApplied` ledger;
the next run then re-appends it. Clearing only the ledger while the row remains does nothing (no
duplicate), which is the safe default.

**Alternatives considered**: (a) Title-match identity, no column — rejected in clarify: a rename
would cause a re-add and the household edits titles freely. (b) A hidden tombstone column of deleted
keys on Recurring — rejected: pollutes the human-facing tab with machine rows; the Settings ledger
is the natural home for that state and is already the pattern for config.

## R3 — Editor-run entry point, not an API action

**Decision**: `seedRecurringPack()` is a public (no trailing underscore) function run manually from
the Apps Script editor, exactly like `setupDatabase()` and `installRecurringTrigger()`. It is **not**
wired into `Api.js`/`doPost` and is **not** a trigger handler.

**Rationale**: Seeding is a deliberate one-time household action, not something a browser client or a
nightly trigger should invoke. The public-name convention is required so the editor's Run menu lists
it (CLAUDE.md gotcha: trailing-underscore functions are hidden from Run/Debug). No new OAuth scope is
needed — it only touches the Sheet, which the deploying account already authorizes.

**Alternatives considered**: An API action `recurring.seed` — rejected: exposes a destructive-feeling
bulk action to the client for no user benefit, and would need shared-account acting-person handling.

## R4 — The seed pack: cadences, anchors, owners, seasons

**Decision**: eight rules (see [data-model.md](data-model.md) for the full table). Cadences use only
the engine's existing vocabulary (`weekly`, `biweekly`, `monthly`, `quarterly`, `annually` —
`Config.js:78`). Placeholder anchors are computed **relative to the seed run date** so first
occurrences land within the lookahead and the bin alternation is immediately visible; the household
corrects them to their real collection/maintenance days afterward. Default owner is `both` for every
chore.

Key per-chore decisions:
- **Mow lawn** — `weekly`, `seasonStart=4`, `seasonEnd=10` (April–October inclusive), resolving brief
  open question #4 (FR-006). The engine's `inSeason_` already suppresses out-of-window occurrences.
- **Clean gutters** — a **single** `annually` rule anchored in fall (clarify decision); the household
  adds a spring rule by hand if they want twice-a-year cleaning. No biannual cadence is invented.
- **Detector batteries** — `annually`, anchored in fall (daylight-saving-change convention).

**Rationale**: Sensible, editable starting points beat guessing the household's exact schedule; the
spec frames all anchors as placeholders (FR-011).

**Alternatives considered**: Fixed historical anchors (e.g. Jan 1) — rejected: would push first
occurrences oddly far and hide the bin alternation at seed time. Per-chore owner guessing — rejected:
no basis; `both` is the honest default.

## R5 — Schema addition via the existing migration path

**Decision**: add `seedKey` to `HEADERS.Recurring` (`Config.js:63`) and add
`recurringSeedApplied` to `SETTINGS_SEED` (`Config.js:198`). Running `setupDatabase()` after deploy
appends the new column via the existing `migrateHeaders_` path (`Setup.js:60`) and seeds the empty
ledger key via `seedSettings_` — both already idempotent and non-destructive. `seedRecurringPack()`
tolerates the ledger row being absent (creates/updates it defensively) so ordering of the two
editor runs doesn't matter.

**Rationale**: Reuses the proven, idempotent column-migration and settings-seed machinery rather
than writing bespoke schema code (Principle IV). The generator maps columns by header name and
ignores unknown columns, so no engine change is required; API validation (`rejectUnknownFields_`)
treats `seedKey` as an allowed-but-optional field once it is in `HEADERS`.

**Alternatives considered**: Writing the column directly in `Seed.js` — rejected: duplicates
`migrateHeaders_` and risks divergence. Storing the ledger as its own tab — rejected: over-built;
one Settings key suffices.
