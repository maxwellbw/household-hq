# Research: Dog-care recurring seed rows

Only one design question needed resolving (the cadence gap, already decided in clarify);
the rest is applying feature 015's established pattern. Recorded here for the record.

## R1 — Representing the 6-week and 8-week cadences

**Decision**: Add two new **fixed** cadences to the recurring engine: `sixweekly` (step
+42 days) and `eightweekly` (step +56 days). They join the existing fixed-step family
(`weekly` +7, `biweekly` +14). Store the tokens `sixweekly` / `eightweekly` in the
Recurring tab's `cadence` column.

**Rationale**:
- The engine's cadence model is a fixed enum with a per-cadence step function
  (`CADENCE_STEP_` in `Recurring.js`). Weekly/biweekly are already exact day-steps, so
  6-week/8-week fit the same shape with zero new mechanism (Constitution IV — boring).
- Approximating to `monthly` was rejected: monthly (~30d) fires far more often than every
  6 or 8 weeks, and nothing between `monthly` and `quarterly` (~91d) exists, so the
  household could never hand-tune to the real rhythm — the cadence simply wouldn't exist.
- A generic "every N weeks" cadence with a numeric count column was rejected as
  over-scoped: it adds a Sheet column and cross-cutting engine/validation/UI changes for a
  two-value need. Two fixed cadences are the minimal change and keep the Sheet plainly
  readable.

**Naming**: `sixweekly` / `eightweekly` — single lowercase tokens matching `biweekly`'s
style and self-describing when read straight from the Sheet (Constitution II). Frontend
display labels follow `biweekly`'s "Every two weeks" spelling: **"Every six weeks"** and
**"Every eight weeks"**.

**Alternatives considered**: approximate to `monthly` (loses the rhythm, un-tunable);
generic interval-N cadence (schema + engine + UI churn); leave nail trim/grooming out until
a future cadence feature (delays 2 of 4 chores for no real saving).

## R2 — Where the two new cadences must be reflected

**Decision**: Backend — `CADENCES` array (`Config.js`) and `CADENCE_STEP_` switch
(`Recurring.js`). Validation needs **no** change: `isValidType_('cadence', v)` already
tests membership in `CADENCES`, so adding to the array both permits writes and accepts
hand-typed values. Frontend — the `Cadence` union (`types/domain.ts`), the
`RecurringManager.tsx` label map + dropdown list, and `QuickAddSheet.tsx`'s dropdown list
(for parity so a user can create these cadences too).

**Rationale**: A cadence value that the engine steps but the frontend type doesn't know
would break `CADENCE_LABELS[rule.cadence]` (undefined label) and hide the option from the
Recurring editor, contradicting the "stays hand-selectable" clarification (FR-003a).

**Dashboard (`lib/dashboard.ts`)**: `RARE_CADENCES` stays `{quarterly, annually}` —
every-6/8-weeks is not rare enough to warrant a dashboard highlight. No logic change; the
widened `Cadence` type just flows through (`RARE_CADENCES.has(rule.cadence)` is correctly
`false` for the new values). Confirmed the union widening type-checks with no other edits.

**Ordering**: In the dropdowns, place the two new cadences by frequency between `monthly`
(~30d) and `quarterly` (~91d): weekly → biweekly → monthly → every six weeks → every eight
weeks → quarterly → annually.

## R3 — Seed-chore anchors and titles (applying the 015 pattern)

**Decision**: Reuse the existing `anchorRule: 'today'` for all four dog-care chores (no
new anchor rule needed). Titles: "Flea/tick meds", "Heartworm meds", "Nail trim",
"Grooming". Seed keys: `flea-tick`, `heartworm`, `nail-trim`, `grooming`. No season window
(year-round).

**Rationale**: These dates are placeholders the household hand-tunes to their real
med/groomer schedule (User Story 3), so `today` is the honest default and needs no new
`computeSeedAnchor_` branch. Distinct, stable seed keys drive idempotency/never-resurrect
exactly as the 015 chores do. Titles match the backlog wording.

**Alternatives considered**: staggering anchors (e.g. `today+7`) to avoid four dog tasks
landing on day one — rejected as needless; the first occurrence is trivially hand-moved and
`today` is the truthful "set it up now" default.

## R4 — Out of scope: annual vet visit + vaccines

**Decision**: Not seeded in this feature. The backlog defers them to feature 025's
yearly-recurrence work (or a yearly rule if 025 lands first). `annually` already exists, but
these are intentionally excluded here to keep 023 to the four routine dog-care chores.
