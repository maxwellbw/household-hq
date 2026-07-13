# Data Model: Household Seed Data + Engine Extensions

The authoritative **row-level dataset** (every list item, birthday, anniversary, task, and
prep step, with owners/dates/offsets) lives in `docs/seed-data.md` and is not duplicated
here. This document defines the **schema deltas, new enumerations, ledgers, and generation
semantics** the seed packs and engine extensions depend on.

## 1. Schema migrations (`setupDatabase()`)

Add one column, `seedKey` (text, optional, defaults `''`), to four tabs. `Recurring` already
has it. Blank on any hand-added row; a short slug (e.g. `bday-jazmine`, `list-groceries`) on
seeded rows. Never client-supplied through the API; only the seed functions set it.

| Tab | New column | Notes |
|---|---|---|
| `Lists` | `seedKey` | identity for a seeded list across renames |
| `ListItems` | `seedKey` | identity for a seeded item across renames |
| `TaskTemplates` | `seedKey` | identity for a seeded template row |
| `RecurringEvents` | `seedKey` | identity for a seeded birthday/anniversary rule |

Resulting column orders (append `seedKey` last, mirroring `Recurring`):

```
Lists:           id, name, seedKey
ListItems:       id, listId, name, status, section, staple, note, seedKey
TaskTemplates:   id, eventType, taskTitle, offsetDays, defaultOwner, seedKey
RecurringEvents: id, title, cadence, anchorDate, startTime, durationMinutes,
                 defaultOwner, templateId, location, notes, seasonStart, seasonEnd,
                 lastGenerated, seedKey
```

`seedKey` is untyped free text in the type maps and **not** in any required-on-create list
(it is never part of an API create payload). Until `setupDatabase()` runs, requests touching
these tabs fail closed with `SCHEMA_MISMATCH` (documented follow-up — quickstart §A).

## 2. New Settings keys (applied ledgers + existing)

`; `-delimited slug ledgers, identical in format to the existing `recurringSeedApplied`.
Added to the Settings defaults so `setupDatabase()` provisions them blank.

| Key | Default | Purpose |
|---|---|---|
| `listSeedApplied` | `''` | seedKeys of applied Lists + ListItems |
| `templateSeedApplied` | `''` | seedKeys of applied TaskTemplates rows |
| `eventSeedApplied` | `''` | seedKeys of applied RecurringEvents rules |
| `recurringSeedApplied` | *(exists)* | reused for the new recurring **task** rows |

These are **not** added to `EDITABLE_SETTINGS` (internal bookkeeping, not user-editable via
the Settings screen — same as today's `recurringSeedApplied`).

## 3. New cadence enumerations

`CADENCES` (Config.js) gains two values; both get full task+event parity because both
generators route through `occurrencesInWindow_` → `CADENCE_STEP_`.

```js
// Config.js
var CADENCES = ['weekly', 'biweekly', 'monthly', 'sixweekly', 'eightweekly',
                'quarterly', 'annually', 'semiannually', 'thanksgiving-sat'];
```

| Cadence | Step / semantics | Frontend label |
|---|---|---|
| `semiannually` | `addMonthsClamped_(ymd, 6)` — fixed 6-month step | "Every 6 months" |
| `thanksgiving-sat` | **special**: one occurrence per year = Saturday before US Thanksgiving (4th Thursday of Nov − 5 days), computed in `occurrencesInWindow_`; `CADENCE_STEP_` returns +12 mo only as a non-throwing fallback | "Weekend before Thanksgiving" |

Season windows (`seasonStart`/`seasonEnd`) and validation (`validateSeasonWindow_`, cadence
membership) are unchanged and apply to the new cadences too.

## 4. Ordinal-title token (`{nth}`)

- A `RecurringEvents.title` **may** contain the literal token `{nth}`.
- At generation (`generateForEventRule_`), each occurrence's baked `Events.title` =
  `rule.title` with `{nth}` replaced by `ordinal_(occYear − anchorYear)`, where
  `anchorYear = Number(rule.anchorDate.slice(0,4))` and `occYear` is the occurrence's year.
- No token → title used verbatim (birthdays, plain events).
- `ordinal_(n)`: `1→"1st", 2→"2nd", 3→"3rd", 4→"4th", … 11→"11th", 12→"12th", 13→"13th",
  21→"21st"` (standard English ordinal rules).
- Baked per occurrence → correct on calendar, dashboard, and the 007 Google Calendar mirror;
  next year's occurrence is a new row with the incremented ordinal.

## 5. Seed packs (structure only; rows in `docs/seed-data.md`)

All packs are arrays of plain objects in `Config.js`, consumed by the matching `Seed.js`
function. Each row carries a unique `seedKey`.

### 5a. `SEED_PACK` additions — recurring **tasks** (§4–§7)

Appended to the existing array; seeded by the existing `seedRecurringPack()` (no new
function). Fields: `{ seedKey, title, cadence, anchorRule, defaultOwner, seasonStart?,
seasonEnd? }`. New cadence/anchor coverage required:

- `semiannually` cleans, anchors staggered `today+2mo … today+7mo` (six distinct months):
  water-filter (+2, both), clean-dishwasher (+3, **max**), deep-clean (+4, both),
  clean-fridge (+5, both), clean-oven (+6, both), clean-washing-machine (+7, **jaz**).
- leaf-cleanup: `biweekly`, anchor late-Oct, `seasonStart 10`/`seasonEnd 12`, both.
- rake-dirt-fence: `monthly`, anchor today, both.
- tree-trim-winter: `annually`, anchor Dec 1, both. tree-trim-spring: `annually`, Apr 1, both.
- holiday-shopping: `annually`, anchor Nov 1, both.
- christmas-lights: `thanksgiving-sat`, anchor today, both.
- vet-annual: `annually`, anchor Oct 1, **max** — title "Call vet — schedule annual visit + vaccines".

### 5b. `EVENT_SEED_PACK` — birthdays + anniversaries (§2–§3)

Seeded by `seedEvents()` into `RecurringEvents`. Fields: `{ seedKey, title, cadence:
'annually', anchorRule | anchorDate, defaultOwner: 'both', templateId? }`.

- **Birthdays** (8): `anchorRule: 'monthday-MM-DD'` (next future occurrence), `templateId`
  = the birthday's own eventType (§5c), title `"<Name>'s birthday"`, owner `both`.
- **Anniversaries** (5): literal historical `anchorDate` (e.g. `2020-01-24`) so the ordinal
  base year is correct; title carries `{nth}` (§4); no `templateId`; owner `both`.

### 5c. `TEMPLATE_SEED_PACK` — prep templates (§2 prep + §8)

Seeded by `seedTemplates()` into `TaskTemplates`. Fields: `{ seedKey, eventType, taskTitle,
offsetDays, defaultOwner }`.

- **Per-birthday** (8 rows): one row per birthday eventType (`bday-*`), with that person's
  gift/reservation/text `taskTitle`, `offsetDays` ∈ {−7,−14,−21,0}, and gift-buyer owner.
- **`guests-arriving`** (4 rows) and **`leaving-trip`** (5 rows): the checklists from §8 with
  their per-task `offsetDays` and owners.

### 5d. `LIST_SEED_PACK` — shopping lists (§1)

Seeded by `seedLists()`. Two parts:

- **Lists** (2): `{ seedKey, name }` — `list-groceries` "Groceries", `list-notgrocery`
  "Not grocery".
- **Items** (~38): `{ seedKey, listSeedKey, name, section, staple, status }`. `seedLists()`
  resolves `listSeedKey → listId` (looking up the seeded/hand-renamed list by its seedKey, or
  the id captured when it was just created this run) and writes each item via `createRecord_`
  with explicit `status` (bypassing `createListItem_`'s force-to-`need` + name-dedupe).

## 6. New `computeSeedAnchor_` anchorRules

Extend the existing switch (Seed.js). Existing: `today`, `today+7`, `fall-oct15`,
`fall-nov1`. Add (regex-parsed, kept readable):

| anchorRule | Resolves to |
|---|---|
| `today+Nmo` (e.g. `today+4mo`) | `addMonthsClamped_(today, N)` |
| `monthday-MM-DD` (e.g. `monthday-10-01`, `monthday-01-02`) | `nextMonthDayOnOrAfter_(today, MM, DD)` — reuses the existing helper |

`fall-nov1` (Nov 1) is reused for holiday-shopping; `monthday-*` covers Oct 1 / Dec 1 / Apr 1
/ late-Oct / the eight birthday month-days. `EVENT_SEED_PACK` anniversaries pass an explicit
`anchorDate` instead of an `anchorRule`.

## 7. Entities (recap)

- **List / ListItem** — as feature 024, plus `seedKey`.
- **RecurringEvents rule** — as feature 025, plus `seedKey`; anniversaries use the `{nth}`
  title token; birthdays use `templateId`.
- **Recurring task** — as feature 004, using the new `semiannually` / `thanksgiving-sat`
  cadences and season windows.
- **TaskTemplates row (prep)** — as feature 005, plus `seedKey`; grouped by `eventType`.
- **Applied ledgers** — three new Settings keys making each pack idempotent + deletion-permanent.

## 8. Validation & idempotency invariants

- A seed row is "already applied" iff its `seedKey` is present as a live row **or** in the
  pack's ledger → re-runs create nothing; hand-deletions are permanent (ledger retains the key).
- Matching never uses title/name → hand-renames never duplicate.
- Every created row logs via `createRecord_`; a fully no-op run logs nothing.
- Six `semiannually` cleans occupy six distinct calendar months (anchors +2…+7 mo).
- `thanksgiving-sat` yields exactly one occurrence per year on the correct computed date.
- Anniversary ordinal = occYear − anchorYear, strictly increasing year over year.
