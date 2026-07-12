# Contract: Cadence values (frontend ⇄ backend)

This feature adds no new API action. The only cross-boundary contract it touches is the
**set of legal `cadence` values**, which both the backend (validation + engine step) and
the frontend (type + display labels + create dropdowns) must agree on. Documented here so
the two sides stay in lockstep.

## The shared value set

Legal `cadence` strings after this feature (order = increasing interval):

```
weekly, biweekly, monthly, sixweekly, eightweekly, quarterly, annually
```

New values introduced by 023: **`sixweekly`** (every 42 days) and **`eightweekly`** (every
56 days).

## Producer/consumer expectations

- **Backend produces** these values in `Recurring` rows returned by any read that includes
  recurring rules (and accepts them on writes). `isValidType_('cadence', v)` is the single
  gate: a value not in `CADENCES` is rejected on write and flagged on read.
- **Backend engine** must have a `CADENCE_STEP_` arm for every value it will ever emit;
  after 023 that includes `sixweekly` → `+42d` and `eightweekly` → `+56d`. A missing arm
  throws `VALIDATION_FAILED` ("Unknown cadence") — so adding the value to `CADENCES` and
  the step function must land together.
- **Frontend consumes** the value in two ways, both of which must tolerate all seven values:
  1. **Display**: `CADENCE_LABELS[cadence]` must have an entry for every value, else the
     label renders `undefined`. Add `sixweekly`/`eightweekly` labels.
  2. **Selection**: the create/edit dropdowns (`RecurringManager`, `QuickAddSheet`) list
     the values a user may choose; include the two new ones for hand-selectability.

## Backward/forward compatibility

- **Old client, new data** (a stale frontend build receives a rule with `sixweekly`): the
  app must not crash. `CADENCE_LABELS[cadence]` would be `undefined` — acceptable
  degradation is showing the raw value; a hard crash is not (spec Edge Case). New clients
  ship the labels, so this only affects an un-refreshed tab.
- **New client, old data**: no impact — the existing five values are unchanged.

## Non-goals

- No numeric/parametric cadence (no "every N weeks" with a count field).
- No change to `RARE_CADENCES` (dashboard rare-chore highlight stays `quarterly`/
  `annually`).
- No new API action, request field, or response field.
