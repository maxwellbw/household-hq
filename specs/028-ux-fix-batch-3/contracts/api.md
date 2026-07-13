# API Contract Changes — 028 UX Fix Batch 3

**No new actions. No changed response shapes. No new OAuth scopes.** API minor-version
bump to 1.5.0 (behavioral additions only).

## `tasks.create` / `events.create` — client-supplied `id` (now part of the contract)

Request payloads MAY include `id` (a UUID string). Behavior (existing since 001, now
relied upon and covered by self-test):

- If no record with that id exists → created with exactly that id.
- If a record with that id already exists → **idempotent replay**: the existing record
  is returned unchanged, nothing is written, no ActivityLog row is appended.
- Omitted/blank `id` → server generates one (unchanged).

The frontend uses this for optimistic creates: it mints `crypto.randomUUID()`, inserts
the row into its cache, and sends the same id — a retry can never duplicate.

## Generator behavior — `generateRecurringEvents()` (trigger/editor, not a web action)

- Window end is now per rule: cadence `annually` or `thanksgiving-sat` →
  `today + recurringEventsYearlyLookaheadDays` (Settings, default 366); all other
  cadences → `today + recurringEventsLookaheadDays` (Settings, default 60, unchanged).
- Everything else (deterministic `v…` ids, watermark advance, season windows, `{nth}`
  titles, inline prep generation, per-rule error isolation) is unchanged.

## Editor entry points (backend maintenance surface)

- **Removed behavior**: `selfTest()` no longer runs the suite; it logs the chunk-runner
  instructions and throws (fail-loud guard against trusting a partial run).
- **Added**: `selfTest1Core()`, `selfTest2Recurring()`, `selfTest3SeedAndLists()`,
  `selfTest4CalendarAndComms()` — each ends with `SELFTEST n/4 (<name>): ALL PASS`.
  Union of the four == the old monolith's coverage (membership listed in SelfTest.js
  header comment).
- **Unchanged**: `selfTestSeedPack()`, `selfTestSessionTokens()`, `setupDatabase()`
  (gains the one Settings-key seed), all trigger installers.

## Frontend behavioral contract (for the quickstart's benefit)

- Task/event create + edit: sheet closes immediately (`mutate`, not awaited); cache is
  patched optimistically; on failure the patch reverts and a toast explains; on settle
  the query invalidates (server state wins).
- One-tap actions (complete/reopen/snooze/unsnooze/acknowledge/list flips): contract
  unchanged — still optimistic.
- Recurring-rule creates from Quick Add: still awaited (not optimistic) by design.
