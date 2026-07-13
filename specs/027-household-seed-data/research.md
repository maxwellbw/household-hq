# Research: Household Seed Data + Engine Extensions

All unknowns from the Technical Context resolved. Decisions are grounded in the existing
codebase (feature 015/023 seed pack, 004/025 recurrence engine, 005 prep templates, 024
lists) so the feature reuses proven mechanics rather than inventing new ones (Principle IV).

## R1 — Idempotent seeding of four heterogeneous data kinds

**Decision**: Keep the existing `seedRecurringPack()` pattern and add **three sibling
functions** — `seedLists()`, `seedTemplates()`, `seedEvents()` — plus a `seedHousehold()`
wrapper that calls all four (the existing recurring-task seeding is folded in by appending
the new maintenance/yard/holiday/vet rows to the existing `SEED_PACK`). Each sibling:
per-item `seedKey`, a dedicated Settings applied-ledger key, `createRecord_` for writes,
per-item try/catch isolation, and a no-op-writes-nothing tail — a structural copy of
`seedRecurringPack()`.

**Rationale**: Three straight-line functions that each read like the one we already trust are
more debuggable than one generic seeder parameterized over four schemas (Principle IV —
"three similar lines beat one clever indirection"). Idempotency and permanent-deletion come
for free from the seedKey-in-row-OR-in-ledger check already proven in 015/023.

**Alternatives considered**: (a) One generic `seedPack(tab, rows, ledgerKey)` — rejected:
the four kinds differ enough (Lists create parent+children with generated foreign ids;
Events compute anchors; Templates are flat) that the "generic" grows conditionals and
becomes harder to read than three explicit functions. (b) Seeding via the public API actions
(`createListItem_`, etc.) — rejected: those enforce business rules that fight seeding (e.g.
`createListItem_` forces new items to `need` and dedupes by name), whereas seeding must set
explicit `stocked`/`need` status and its own `seedKey`. `seedRecurringPack()` already writes
via `createRecord_` directly for exactly this reason.

## R2 — Where `seedKey` lives; the migration

**Decision**: Add a `seedKey` column to `Lists`, `ListItems`, `TaskTemplates`, and
`RecurringEvents` (the `Recurring` tab already has it). Provision/migrate via the existing
`setupDatabase()` column-adding path. Idempotency ledgers are new Settings keys:
`listSeedApplied`, `templateSeedApplied`, `eventSeedApplied` (recurring tasks keep using the
existing `recurringSeedApplied`).

**Rationale**: The seedKey-in-a-column convention is exactly how `Recurring` already supports
rename-safe, deletion-permanent seeding; matching it keeps the mental model uniform and the
Sheet readable (a short slug column). Deferring to `setupDatabase()` matches how every prior
schema change shipped (019, 024).

**Consequence / gotcha**: Adding columns to the `SCHEMA` arrays means the app fails closed
with `SCHEMA_MISMATCH` on requests touching those tabs until `setupDatabase()` is run — the
same post-merge step 019/023/024 documented. `setupDatabase()` + `selfTest()` are a required
manual follow-up (quickstart §A). `seedKey` is optional free text (blank on hand-added
rows), so hand-editing is unaffected.

**Alternatives considered**: Natural-key idempotency (listName+itemName) with no column —
rejected: a hand-rename of an item or list would then create a duplicate on re-run, breaking
Principle II's "tolerate rows edited by hand".

## R3 — Six-month cadence

**Decision**: Add `semiannually` to `CADENCES` (Config.js) and a
`case 'semiannually': return addMonthsClamped_(ymd, 6)` to `CADENCE_STEP_` (Recurring.js);
add it to the frontend `Cadence` type, the three cadence label maps, and the three cadence
dropdown arrays. Label: "Every 6 months".

**Rationale**: A verbatim mirror of how `sixweekly`/`eightweekly` were added in feature 023 —
the smallest, most boring possible change, and it gives full task+event parity because both
generators route through `CADENCE_STEP_` via `occurrencesInWindow_`.

**Alternatives considered**: Reusing `quarterly` (3 mo) — rejected by the household (too
often). A generic "every N months" field — rejected: over-general for one household; the
fixed-cadence enum is the established, hand-selectable model.

## R4 — Ordinal "Nth anniversary" titles

**Decision**: Store the anniversary rule's `title` with a documented `{nth}` token (e.g.
`"{nth} dating anniversary"`, `"Rufus's {nth} gotcha day"`). In `generateForEventRule_`
(RecurringEvents.js), when building each occurrence's baked title, replace `{nth}` with
`ordinal_(occurrenceYear − anchorYear)` where `anchorYear` is the year of `rule.anchorDate`;
a title with no token is used verbatim (so birthdays and plain events are unaffected). Add
pure helpers `ordinal_(n)` ("1st","2nd","3rd","4th",…"11th","21st") and the token render.

**Rationale**: Token-in-title needs **no schema change** and stays human-readable in the
Sheet (an editor sees `{nth} wedding anniversary` and understands it). The count is baked
into each generated occurrence's stored title, so it is correct on the calendar, the
dashboard, and the mirrored Google Calendar event with zero frontend work, and it increments
naturally because next year's occurrence is a new row generated with the new ordinal. Past
occurrences keep their historical ordinal.

**Edge handling**: `occurrenceYear − anchorYear` is ≥ 1 in practice — anchors are the true
historical years (2020–2025) and the generation window is forward from today (2026+), so the
2020–2025 occurrences are stepped past without emission and never surface a "0th". Defensive:
if the delta ≤ 0, `ordinal_` still renders but the generator may fall back to a token-less
title; documented, not expected to fire.

**Alternatives considered**: (a) A `countYears` boolean column + fixed format string —
rejected: the gotcha-day possessive ("Rufus's Nth …") doesn't fit one fixed format, and a
token is more flexible and needs no migration. (b) Frontend computes the count at render —
rejected: would have to special-case recurring-event occurrences everywhere they appear
(calendar, dashboard, gcal mirror) instead of once at generation.

## R5 — Computed "weekend before Thanksgiving"

**Decision**: Add a special cadence `thanksgiving-sat`. In `occurrencesInWindow_`
(Recurring.js), branch before the fixed-step loop: for each year from the anchor year
through the window-end year, compute `thanksgivingSaturday_(year)` and emit it if it falls in
`(startExclusive, endInclusive]`. Pure helpers: `fourthThursdayOfNovember_(year)` (first
Thursday of Nov + 21 days) and `thanksgivingSaturday_(year)` (that Thursday − 5 days = the
Saturday of the weekend before). Add a harmless `case 'thanksgiving-sat'` to `CADENCE_STEP_`
(step +12 mo) so no code path throws, and surface it in the frontend cadence list with label
"Weekend before Thanksgiving".

**Rationale**: The household explicitly rejected the drift of a fixed annually anchor ("I like
the computed since you know when Thanksgiving is"). US Thanksgiving is deterministic (4th
Thursday of November), so the date is a pure function of the year. The branch is isolated,
pure, and unit-testable; it touches the one shared occurrence function so the single
Christmas-lights task gets it with no bespoke generator.

**Alternatives considered**: (a) Fixed annually anchor, hand-nudged every few years —
rejected by the household. (b) A separate one-off generator just for this rule — rejected:
more surface area than a guarded branch in the function that already produces occurrences.

## R6 — Per-birthday prep so owner + lead time vary

**Decision**: Model each birthday's prep as its **own `eventType`** in `TaskTemplates`
(e.g. `bday-jazmine`), a single template row with that birthday's `taskTitle`, `offsetDays`
(−7/−14/−21/0), and `defaultOwner` (the gift-buyer). The birthday `RecurringEvents` rule
carries `templateId = <that eventType>`. The existing `syncPrepForEvent_` (feature 005),
already invoked per occurrence by `generateForEventRule_`, generates the prep task at
`start + offsetDays` owned by the template's `defaultOwner`. The two multi-task prep
templates ("Guests arrive", "Leaving for a trip") are ordinary multi-row `eventType`s
attached to one-off events the household creates.

**Rationale**: The prep mechanism keys tasks by `eventType` and reads owner + offset from the
template row — so giving each birthday its own single-row eventType lets both the owner
(Max buys for Jaz; Jaz buys for Max) and the lead time differ per person with **zero engine
change**. It reuses `syncPrepForEvent_` verbatim (the recurring-event generator already calls
it). Uncle's day-of group-chat text is just `offsetDays 0`, `defaultOwner both`.

**Alternatives considered**: One shared `birthday` eventType — rejected: a single template
row can't express opposite owners and three different lead times. Extending prep-gen to
inherit the event's owner — rejected: unnecessary engine change when per-person eventTypes
express it cleanly and stay hand-editable.

## R7 — List-item search UX

**Decision**: Add a controlled search `<input>` to `ListsView.tsx` that filters the
already-loaded `itemsForList` by a case-insensitive, trimmed substring match on item name,
applied in **both** the Needed (aisle-order) and All views before grouping. Extract a pure
`filterItemsByName(items, query)` into `lib/lists.ts` with unit tests. Show a small
empty-result state when a non-empty query matches nothing; clearing the box restores the full
list. The existing `ListItemRow` toggle is unchanged and keeps working on filtered results.

**Rationale**: Purely client-side over data already in memory (no new API, no server
behavior — Principle IV/least surface). A pure filter helper is trivially testable and keeps
`ListsView` thin. Matches the feature's "extremely low-friction" bar for lists.

**Alternatives considered**: A backend search action — rejected: the full item set is already
loaded client-side; server search would add a round-trip and an action for no benefit at this
scale.
