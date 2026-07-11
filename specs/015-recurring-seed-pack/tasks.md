---
description: "Task list for feature 015 — Recurring Seed Pack & Alternating Weeks"
---

# Tasks: Recurring Seed Pack & Alternating Weeks

**Input**: Design documents from `/specs/015-recurring-seed-pack/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/seed-pack.md](contracts/seed-pack.md),
[quickstart.md](quickstart.md)

**Tests**: This project validates the backend through editor-run `SelfTest.js` (see quickstart §0
and the definition of done in CLAUDE.md). Self-test tasks are therefore included per user story —
they are the feature's regression net, not optional TDD scaffolding.

**Scope note**: Backend + documentation only. No `/frontend` work, no new API action (the seeder is
an editor-run function like `setupDatabase()`), and **no recurrence-engine changes** — alternating
bins ride the existing `biweekly` cadence.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish carry no story label)

## Path Conventions

Apps Script backend under `backend/` (flat `.js` files, clasp-managed). No `src/` nesting.

---

## Phase 1: Setup (schema & pack data)

**Purpose**: Declare the one schema addition and the pack data all stories build on. All three edit
`backend/Config.js`, so they are sequential.

- [x] T001 Add `seedKey` as the last column of `HEADERS.Recurring` in `backend/Config.js` (after `seasonEnd`); leave it out of `FIELD_TYPES` and `REQUIRED_ON_CREATE` so it stays free-text and optional.
- [x] T002 Add `['recurringSeedApplied', '', 'feature 015; "; "-delimited seed keys already applied; enables never-resurrect. Clear a key (and delete its row) to re-enable seeding.']` to `SETTINGS_SEED` in `backend/Config.js`.
- [x] T003 Add the `SEED_PACK` constant (the 8 chores from [data-model.md](data-model.md): `seedKey`, `title`, `cadence`, an `anchorRule` tag, `defaultOwner: 'both'`, and `seasonStart`/`seasonEnd` on `mow-lawn` only) to `backend/Config.js` in the feature-004 recurring section.

**Checkpoint**: Schema constant and pack data exist. Running `setupDatabase()` after this will
migrate the `seedKey` column and seed the empty `recurringSeedApplied` key via the existing
append-only paths (no new migration code needed).

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The `Seed.js` module scaffold and the shared helpers every story needs. Must complete
before US1–US3.

- [x] T004 Create `backend/Seed.js` with the module header and ledger helpers: `parseAppliedKeys_(value)` and `serializeAppliedKeys_(set)` for the `; `-delimited `recurringSeedApplied` value (trim, drop blanks, de-dupe, stable order).
- [x] T005 Add anchor-computation helpers in `backend/Seed.js`: today as `YYYY-MM-DD` in the household tz (reuse `getTimezone_`), a `+7` offset (reuse `addDays_` from `Recurring.js`), and "next occurrence of month/day ≥ today" for the fall anchors — one small function per `anchorRule` tag used in `SEED_PACK`.
- [x] T006 [P] Add `setSettingValue_(key, value)` to `backend/Sheets.js`: upsert a Settings row by key (update the value cell if present, else append a plain-text row), so the seeder can write the ledger back. Mirror `writeRowAsText_`/`readSettingsMap_` conventions.

**Checkpoint**: `Seed.js` compiles with helpers; the ledger can be read and written.

---

## Phase 3: User Story 1 — Seed the starter pack in one run (Priority: P1) 🎯 MVP

**Goal**: One editor run turns an empty Recurring tab into the full home-maintenance schedule.

**Independent Test**: From a Recurring tab without the pack, run `seedRecurringPack()`; confirm all
8 rules appear with correct fields + `seedKey`, the ledger lists all 8 keys, and each newly-seeded
row has its own ActivityLog entry.

- [x] T007 [US1] Implement the append path of `seedRecurringPack()` in `backend/Seed.js`: read the Recurring tab once (`listRecords_`), and for each `SEED_PACK` chore build a rule (computed `anchorDate` from its `anchorRule`, `seedKey` set, `defaultOwner: 'both'`, `lastGenerated: ''`, season fields where present) and append it via `createRecord_(TABS.RECURRING, rec, 'system')`.
- [x] T008 [US1] **Implemented differently than originally planned** — no bespoke summary log. `createRecord_` already appends its own `create` ActivityLog row per chore (actor `system`), matching how the recurring generator logs per occurrence (Principle IV: reuse the existing mechanism rather than add a second one). `Logger.log` reports a run summary (counts) for the editor console only; this is not a Sheet write.
- [x] T009 [US1] Add `unitSeedPack_()` + `liveSeedPack_()` to `backend/SelfTest.js`: `unitSeedPack_` validates the `SEED_PACK` constant's shape (8 unique keys, valid cadences/owners, mow-lawn's season window, gutters as a single annual rule) and the anchor/ledger helper functions directly. `liveSeedPack_` exercises the real `seedRecurringPack()` end-to-end against a small isolated test pack (not production `SEED_PACK`, to avoid permanently seeding real chores as a side effect of running tests) — first run seeds both test chores and updates the shared `recurringSeedApplied` ledger. Self-cleans.

**Checkpoint**: US1 independently testable — the pack seeds and the engine can generate from it.

---

## Phase 4: User Story 2 — Safe re-run: idempotent, edit-preserving, never-resurrect (Priority: P1)

**Goal**: The seeder is safe to re-run — no duplicates, no clobbered edits, deleted chores stay gone.

**Independent Test**: Run the seeder, edit a seeded row and delete another by hand, re-run; confirm
no duplicate, the edit survives, the deleted chore is not re-added, and a no-op run writes nothing.

- [x] T010 [US2] In `seedRecurringPack()`, compute `applied = parseAppliedKeys_(ledger) ∪ {live row seedKeys}` and skip any chore whose `seedKey ∈ applied`; after appending, write the union of prior + newly-seeded keys back to `recurringSeedApplied` via `setSettingValue_` (creating the row if absent).
- [x] T011 [US2] Add the no-op guard: when no chore was appended, make no Recurring/Settings writes and append **no** ActivityLog row (FR-009); `Logger.log` an "already seeded, no changes" line like `setupDatabase()`.
- [x] T012 [US2] Wrap per-chore processing in a defensive try/catch (mirror `generateRecurringTasks`) so a single malformed chore logs via `console.error` without aborting the rest.
- [x] T013 [US2] Extend `liveSeedPack_()` in `backend/SelfTest.js`: re-run the seeder and assert 0 new rows + unchanged ledger; hand-edit a seeded row's owner/title/anchor then re-run and assert the edit is preserved (rename included, since identity is the seed key); delete a seeded row then re-run and assert it is **not** re-added (its key still in the ledger); confirm a no-op re-run leaves the ledger value byte-for-byte unchanged. Self-clean.

**Checkpoint**: US2 independently testable — re-running the seeder is provably safe.

---

## Phase 5: User Story 3 — Alternating bins without new machinery (Priority: P2)

**Goal**: Trash weekly + recycling/yard-waste on opposite weeks, using only existing rules, plus a
documented recipe.

**Independent Test**: Over an 8-week window, trash is due every week and recycling/yard waste each in
4 non-overlapping weeks; the pattern is reproducible by hand from `backend/README.md`.

- [x] T014 [US3] Add `unitAlternatingBins_()` to `backend/SelfTest.js`: pure math (no Sheet writes) using `occurrencesInWindow_` over an 8-week window (day 0–55) from the `SEED_PACK` `trash`/`recycling`/`yardwaste` anchor rules — asserts trash yields 8 weekly occurrences, recycling and yard waste each yield 4, and no week contains both (SC-004).
- [x] T015 [P] [US3] Add an **"Alternating-week bins"** recipe to `backend/README.md`: model alternating pickups as two `biweekly` rules with `anchorDate`s exactly 7 days apart, plus a `weekly` rule for anything every week; include the concrete trash/recycling/yard-waste example and note that editing anchors shifts the schedule while preserving the pattern (FR-010, SC-006).

**Checkpoint**: US3 independently testable — bins alternate and the recipe is documented.

---

## Phase 6: Polish & cross-cutting

- [x] T016 Document `seedRecurringPack()` in `backend/README.md`: run once from the editor, idempotent, appends only, plus the new `seedKey` Recurring column and `recurringSeedApplied` Settings key. (Same file as T015 — sequenced after it.)
- [x] T017 **Manual — human only.** Validated 2026-07-10 via the new public `selfTestSeedPack()` runner (log ended `SEED PACK: ALL PASS`) rather than the full `selfTest()`: the full suite has grown past Apps Script's 6-minute execution limit (the calendar blocks make real Calendar API calls), so a targeted runner for the three feature-015 test blocks was added. `setupDatabase()` migrated the `seedKey` column + `recurringSeedApplied` key.
- [x] T018 **Manual — human only.** Validated live 2026-07-10: `clasp push`'d, ran `setupDatabase()` and `seedRecurringPack()` from the editor; confirmed the 8 seeded rows, the `recurringSeedApplied` ledger value, and per-row ActivityLog entries.

---

## Dependencies & execution order

- **Setup (T001–T003)** → **Foundational (T004–T006)** → user stories.
- **US1 (T007–T009)** depends on Foundational. This is the MVP.
- **US2 (T010–T013)** builds on the US1 seeder function (same `seedRecurringPack()` body) — do after US1.
- **US3 (T014–T015)** depends only on the seeded pack existing (US1); independent of US2. Can start once US1 lands.
- **Polish (T016–T018)** last. T017/T018 require all code complete.

## Parallel opportunities

- **T006** (`Sheets.js`) runs in parallel with **T004/T005** (`Seed.js`) — different files.
- **T015** (`README.md` recipe) runs in parallel with **T014** (`SelfTest.js`) — different files.
- Within Config.js (T001–T003) and within `seedRecurringPack()` (T007→T010→T011→T012), tasks are
  sequential (same file / same function body).

## Implementation strategy

**MVP = Phase 1 + 2 + US1 (T001–T009).** That alone delivers "one run seeds the pack," the feature's
core value (SC-001). US2 hardens re-runs (the trust layer); US3 proves + documents the bin pattern.
Ship incrementally in this order; each checkpoint is independently demonstrable.

## Task summary

- **Total tasks**: 18
- **Setup**: 3 (T001–T003) · **Foundational**: 3 (T004–T006)
- **US1 (P1, MVP)**: 3 (T007–T009) · **US2 (P1)**: 4 (T010–T013) · **US3 (P2)**: 2 (T014–T015)
- **Polish**: 3 (T016–T018)
- **Parallel markers**: T006, T015
