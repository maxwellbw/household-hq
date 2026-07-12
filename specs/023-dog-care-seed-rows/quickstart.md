# Quickstart: Dog-care recurring seed rows

Validates that the four dog-care chores seed correctly, use the right cadences (including
the two new ones), and inherit 015's idempotency guarantees.

## Prerequisites

- Backend pushed + deployed: `cd backend && clasp push && clasp deploy -i <deploymentId>`.
- Frontend builds clean: `cd frontend && npm run build` (proves the `Cadence` type + labels
  compile).
- Open the Apps Script editor: `cd backend && clasp open-script`.

## A. Backend self-test (fast, isolated)

The seed self-test runs against an isolated test pack and restores the ledger, so it never
permanently seeds production rows.

1. In the Apps Script editor, run **`selfTestSeedPack()`** (or the full `selfTest()`).
2. **Expected**: log ends with `SEED PACK: ALL PASS`. This exercises:
   - `SEED_PACK` now has **12** chores, all with valid cadences/owners and unique seed keys
     (`unitSeedPack_`).
   - The new cadence step math: `sixweekly` advances exactly 42 days and `eightweekly`
     exactly 56 days per occurrence.
   - Idempotent re-run, hand-edit preservation, and never-resurrect (unchanged 015 checks).

## B. Real seed + inspect the Sheet (US1)

1. In the Apps Script editor, run **`seedRecurringPack()`** (no argument → the real pack).
2. Open the Sheet → **Recurring** tab.
3. **Expected**: four new rows —
   | title | cadence | defaultOwner | anchorDate |
   |-------|---------|--------------|------------|
   | Flea/tick meds | `monthly` | `both` | today |
   | Heartworm meds | `monthly` | `both` | today |
   | Nail trim | `sixweekly` | `both` | today |
   | Grooming | `eightweekly` | `both` | today |
   Each has a UUID `id` and a `seedKey` (`flea-tick`/`heartworm`/`nail-trim`/`grooming`).
4. Open the **ActivityLog** tab → **Expected**: one `create` row per newly-seeded chore,
   actor `system`.
5. Open the **Settings** tab → `recurringSeedApplied` now contains the four new keys.

## C. Idempotent re-run (US2 / SC-002)

1. Run **`seedRecurringPack()`** again.
2. **Expected**: no new Recurring rows (still exactly one per dog-care seed key), no new
   ActivityLog rows, `recurringSeedApplied` unchanged. Log reads
   `already seeded, no changes`.

## D. Never-resurrect a deletion (US2)

1. In the Recurring tab, delete the **Grooming** row by hand (or via the app's delete).
2. Run **`seedRecurringPack()`** again.
3. **Expected**: Grooming is **not** recreated (its key is still in `recurringSeedApplied`).

## E. Hand-tune survives re-seed (US3 / SC-004)

1. In **More → Recurring** (the app), edit **Nail trim**: change its next date, and confirm
   the cadence dropdown offers **"Every six weeks"** and **"Every eight weeks"**; optionally
   change the owner.
2. Run **`seedRecurringPack()`** again.
3. **Expected**: your edits persist; no duplicate Nail trim row.

## F. Occurrences generate through the existing engine (SC-003)

1. Run **`generateRecurringTasks()`** (or wait for the nightly trigger).
2. **Expected**: each seeded dog-care rule produces Task occurrences on its cadence
   (flea/tick + heartworm monthly; nail trim every 6 weeks; grooming every 8 weeks) with no
   rule-specific handling, and they appear on the calendar/Tasks views.

## G. Frontend display sanity

1. In **More → Recurring**, confirm all four dog-care rules render with correct cadence
   labels ("Every six weeks" / "Every eight weeks" for nail trim / grooming, "Monthly" for
   the meds) — no blank/undefined label.
