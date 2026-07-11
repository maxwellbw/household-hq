# Quickstart & Validation: Recurring Seed Pack & Alternating Weeks (015)

Proves the one-time `seedRecurringPack()` seeder: it appends the starter pack once, is a
duplicate-free no-op on re-run, preserves household edits, never resurrects a deleted chore, and
that the seeded bins alternate correctly. Backend + editor only — this feature adds **no** API
action and **no** frontend work. Run after `/speckit.implement`. Builds on feature 004.

## Prerequisites

- Feature 004 deployed; `backend/Config.js` has the real IDs; the `Settings` allowlist is filled.
- After this feature's `clasp push`, run **`setupDatabase()`** once so the new `seedKey` Recurring
  column and the `recurringSeedApplied` Settings key are provisioned (append-only migration; existing
  data untouched).

## 0. Editor self-test (fastest signal)

In the Apps Script editor run **`selfTest()`**. It now also covers the seeder in-process: seeds the
pack, asserts all 8 rows exist with their `seedKey`s and the ledger lists all 8 keys; re-runs and
asserts zero new rows and an unchanged ledger; edits a seeded row then re-runs and asserts the edit
survives; deletes a seeded row then re-runs and asserts it is **not** re-added; and asserts via
`occurrencesInWindow_` that over 8 weeks trash is due every week while recycling/yard waste each fall
in exactly 4 weeks and never the same week. The block self-cleans its seeded rows and ledger keys.
The log must end **`ALL PASS`**. This covers SC-001 through SC-005. Steps 1–4 confirm the same by hand.

## 1. Deploy + provision

```bash
cd backend
clasp push
clasp deploy -i <deploymentId>     # refresh existing web-app URL (no new scopes → no re-auth)
```

Then once, from the Apps Script editor, run **`setupDatabase()`**. Open the Sheet and confirm the
**Recurring** tab now has a trailing **`seedKey`** column and the **Settings** tab has a
**`recurringSeedApplied`** row (value blank).

## 2. Seed the pack (US1 · SC-001)

From the editor, run **`seedRecurringPack()`**. In the Sheet's **Recurring** tab, confirm 8 new rows:

- `Trash` (weekly), `Recycling` (biweekly), `Yard waste` (biweekly, anchor 7 days after Recycling)
- `Change HVAC air filter` (quarterly), `Clean dishwasher filter` (monthly)
- `Clean gutters` (annually), `Replace smoke/CO detector batteries` (annually)
- `Mow lawn` (weekly, `seasonStart=4`, `seasonEnd=10`)

Each has a non-empty `seedKey`, `defaultOwner=both`, and a real UUID `id`. The **Settings**
`recurringSeedApplied` value now lists all 8 keys (`; `-delimited). The **ActivityLog** has one new
`system` row summarizing the seed. Running **`generateRecurringTasks()`** then materializes dated
tasks from these rules exactly as for any hand-entered rule.

## 3. Idempotence, edit-preservation, never-resurrect (US2 · SC-002/003)

- **Re-run** `seedRecurringPack()` → no new rows appear; `recurringSeedApplied` is unchanged; no new
  ActivityLog row (SC-002).
- **Edit** a seeded row by hand (e.g. change `Mow lawn` owner to `max` and its anchor), then re-run
  `seedRecurringPack()` → your edit is intact, no duplicate row (SC-003).
- **Delete** the `Clean gutters` row by hand, then re-run `seedRecurringPack()` → it is **not**
  re-added, because `gutters` is still in the ledger (never-resurrect).
- **Deliberate re-seed**: delete a seeded row **and** remove its key from `recurringSeedApplied`, then
  re-run → that one chore is re-appended.

## 4. Alternating bins (US3 · SC-004)

With the seeded bin rules in place, run `generateRecurringTasks()` (or inspect the calendar once
tasks materialize). Over any 8-week span: **Trash** is due every week; **Recycling** and **Yard
waste** each come due in 4 of the 8 weeks and never in the same week as each other. Changing the two
biweekly anchors (keeping them 7 days apart) shifts the whole schedule while preserving the pattern.

## 5. Documentation (FR-010)

Confirm `backend/README.md` contains the **"Alternating-week bins"** recipe (two biweekly rules
anchored 7 days apart + a weekly rule) with the trash/recycling/yard-waste example — reproducible by
hand without reading engine source (SC-006).
