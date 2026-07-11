# Contract: `seedRecurringPack()` — editor-run function

This feature adds **no API action**. Its only new interface is a public Apps Script function invoked
manually from the editor, in the same family as `setupDatabase()` and `installRecurringTrigger()`.
Documented here as the feature's "command contract".

## `seedRecurringPack()`

- **Kind**: public function (no trailing underscore), run from the Apps Script editor Run menu. Not
  registered in `Api.js`/`doPost`; not a trigger handler.
- **Preconditions**: `setupDatabase()` has been run (Recurring + Settings tabs exist, including the
  `seedKey` column and `recurringSeedApplied` key). The function is defensive if the ledger row is
  missing (creates it), so run order relative to `setupDatabase()` is not strict.
- **Parameters**: none.
- **Behavior**:
  1. Read the Recurring tab once (`listRecords_`) and the Settings map (`readSettingsMap_`).
  2. Compute `applied` = ledger keys ∪ live-row `seedKey`s.
  3. For each chore in `SEED_PACK` whose `seedKey ∉ applied`: append a Recurring row (via
     `createRecord_`, locked, real UUID `id`, `seedKey` set, computed placeholder `anchorDate`) and
     stage its key. `createRecord_` appends its own `create` `ActivityLog` row per chore (actor
     `system`) — the same per-row logging the recurring generator already uses per occurrence, so
     each addition is individually attributed without a bespoke summary-log mechanism.
  4. If any keys were staged: write them into `recurringSeedApplied`.
  5. If nothing was staged: make no Recurring/Settings writes (and therefore no log rows) —
     idempotent no-op.
- **Returns**: a small summary (e.g. count added, count skipped) logged via `Logger.log`; no HTTP
  response.
- **Idempotency**: running any number of times yields at most one row per `seedKey` (Principle V).
- **Never-resurrect**: a `seedKey` present in the ledger is skipped even if its row was deleted.
- **Errors**: a malformed single chore must not abort the rest (defensive per-chore try/catch,
  mirroring `generateRecurringTasks`); the function surfaces failures via `console.error`.

## Documentation deliverable (FR-010)

`backend/README.md` gains an **"Alternating-week bins"** recipe: to alternate two biweekly pickups,
create both as `biweekly` rules and set their `anchorDate`s exactly 7 days apart; add a `weekly`
rule for anything collected every week. Includes the concrete trash/recycling/yard-waste example and
notes that editing the anchor dates shifts the whole schedule while preserving the pattern.
