# Contract: Seed Functions (editor entry points)

Seeding is **not** an API action and **not** a trigger handler — it is run manually from the
Apps Script editor, exactly like `seedRecurringPack()`, `setupDatabase()`, and
`installRecurringTrigger()`. All entry points are public (no trailing underscore) so they
appear in the editor Run dropdown (CLAUDE.md gotcha).

## Entry points

| Function | Effect | Idempotency ledger |
|---|---|---|
| `seedHousehold()` | Runs all four packs in order: `seedLists()`, `seedTemplates()`, `seedEvents()`, `seedRecurringPack()`. The one function to run after `setupDatabase()`. | — (delegates) |
| `seedLists()` | Creates the two Lists and their ~38 ListItems (`LIST_SEED_PACK`). | `listSeedApplied` |
| `seedTemplates()` | Creates the per-birthday prep rows + the two multi-row prep templates (`TEMPLATE_SEED_PACK`). | `templateSeedApplied` |
| `seedEvents()` | Creates the 8 birthday + 5 anniversary rules (`EVENT_SEED_PACK`). | `eventSeedApplied` |
| `seedRecurringPack()` | *(existing)* now also creates the 13 new maintenance/yard/holiday/vet tasks appended to `SEED_PACK`. | `recurringSeedApplied` |

Order rationale: templates before events is tidy (events reference `templateId`), though
referential integrity is not enforced at seed time — prep generation happens later at
occurrence materialization, which tolerates a missing template (produces no prep) and
self-heals once the template exists.

## Behavioral contract (each seed function)

1. **Idempotent** (Principle V): an item is skipped iff its `seedKey` is a live row's
   `seedKey` **or** present in the function's ledger. A second full run creates 0 rows and
   writes 0 changes.
2. **Deletion-permanent**: once a `seedKey` is applied it stays in the ledger even after the
   row is hand-deleted → a later run never resurrects it.
3. **Rename-safe**: identity is `seedKey`, never `name`/`title` → a hand-renamed seeded row
   is recognized as applied and left untouched.
4. **Direct writes**: rows are written via `createRecord_` (locked, UUID `id`, appends its own
   ActivityLog `create` row), not via the public create actions — so seeding can set explicit
   `status`/`section`/`staple`/`offsetDays`/`seedKey` that the public actions would override.
5. **Per-item isolation**: one row's failure is logged and skipped without aborting the rest
   (mirrors `seedRecurringPack()` / `generateRecurringTasks`).
6. **No-op silence**: a run that applies nothing makes no writes and appends no log rows.
7. **Ledger update**: only newly-applied keys are appended to the ledger, serialized sorted
   and `; `-delimited (reusing `serializeAppliedKeys_`).

## Post-seed generation (already wired, no new contract)

- **RecurringEvents** occurrences (and their prep) are produced by the existing nightly
  `generateRecurringEvents()` trigger / editor run — birthdays' prep flows through
  `syncPrepForEvent_` unchanged.
- **Recurring tasks** occurrences are produced by the existing `generateRecurringTasks()`.
- To see data immediately after seeding without waiting for the nightly triggers, run
  `generateRecurringEvents()` and `generateRecurringTasks()` once from the editor
  (quickstart §D/§E).
