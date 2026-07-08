# Research: Recurring Chore Engine (Phase 0)

Decisions that resolve the plan's Technical Context. Format: Decision · Rationale ·
Alternatives rejected. IDs are referenced from plan.md, contracts, and tasks.

## D1 — Idempotency via a deterministic Task id

**Decision**: A generated occurrence's Task id is deterministic:
`id = 'r' + hex(MD5(recurringId + '|' + dueDate))` (via
`Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, ...)`). The generator passes this
id to the existing `createRecord_`, whose id-replay branch returns the existing row instead
of inserting a duplicate. `(recurringId, dueDate)` is the natural key for an occurrence.

**Rationale**: Directly satisfies FR-006/FR-007 with zero new machinery — re-runs,
retries, and two overlapping trigger executions all compute the same id and collapse to one
row. `createRecord_` already serializes through `withLock_` and already treats a known id as
success (feature 001 idempotent replay). MD5 is built into Apps Script (`Utilities`), no
dependency (Principle IV).

**Alternatives rejected**:
- *Scan Tasks for an existing (recurringId, dueDate) before inserting* — an extra full-tab
  read per occurrence and a check-then-act race the lock would have to cover manually;
  `createRecord_` already does the atomic thing.
- *Random UUID ids* — cannot dedupe on replay; would require the scan above.
- *SHA-256* — no benefit over MD5 for a non-adversarial dedupe key; longer id.

## D2 — Tombstone (never resurrect a deleted occurrence) via `lastGenerated`

**Decision**: Each run walks occurrences strictly **after** the rule's `lastGenerated`
(a `YYYY-MM-DD` high-water mark) up to `today + lookahead`, then advances `lastGenerated` to
the newest occurrence **considered** in that window (whether created or season-skipped).
Because the generator never revisits dates ≤ `lastGenerated`, a Task a user deletes is never
re-created (FR-013). D1's deterministic id is the belt to this suspenders — it guards the
in-flight window (crash between task-write and watermark-write, or concurrent runs) where
`lastGenerated` has not yet advanced.

**Rationale**: `lastGenerated` exists in the schema precisely as this cursor. High-water
semantics make deletion permanent without a separate "tombstone" tab (Principle II — no
shadow state). Advancing past season-skipped occurrences is correct: an occurrence's month
is fixed, so one skipped for season now is skipped forever — no need to reconsider it.

**Alternatives rejected**:
- *Advance `lastGenerated` to `today + lookahead` each run* — would skip occurrences that
  only enter the window as the horizon slides forward on later nights (missed chores).
- *Separate tombstone list of deleted occurrence ids* — new state that can drift from the
  Sheet; the watermark already encodes it.
- *Rely on the deterministic id alone* — after a delete the id no longer exists, so the next
  in-window run would recreate it (the exact resurrection FR-013 forbids).

## D3 — Occurrence math on ISO date strings, dependency-free

**Decision**: Work in `YYYY-MM-DD` strings (household tz), converting to a `Date` only for
arithmetic:
- **weekly / biweekly**: step `anchor + k·7` / `anchor + k·14` days (`addDays_`).
- **monthly / quarterly / annually**: step `anchor` by `k·1` / `k·3` / `k·12` months with
  **day clamping** (`addMonthsClamped_`) — target day = min(anchorDay, daysInTargetMonth).
  So Jan 31 monthly → Feb 28/29, Mar 31, …; Feb 29 annual → Feb 28 in common years.

The walker finds the first occurrence `> windowStart` by stepping the cadence from the
anchor (skipping elapsed cycles), then yields occurrences until `> windowEnd`. At the
household's rule counts (≤ ~30) and horizons (years since anchor at monthly = a few hundred
steps) this is trivially fast.

**Rationale**: Matches the constitution's date rule (ISO strings in the Sheet, single tz)
and 001's `writeRowAsText_` guard against Date coercion. Clamping is the boring, predictable
month-end behavior users expect. No RRULE library, no dependency (Principle IV).

**Alternatives rejected**:
- *Roll month-end overflow forward (Jan 31 → Mar 3)* — surprising for chores; clamping to
  the last valid day is what "monthly on the 31st" should mean.
- *An RRULE/iCal parser* — heavy dependency for five fixed cadences; disallowed backend dep.
- *Store the next due date on the rule instead of computing* — redundant with `anchorDate` +
  `cadence`; another field to keep consistent and to break under hand-edits.

## D4 — Season windows as inclusive month ranges, wrap-around allowed

**Decision**: `seasonStart`/`seasonEnd` are month integers 1–12 (already provisioned,
`FIELD_TYPES.Recurring` type `month`, validated by the existing `validateSeasonWindow_`). An
occurrence is in-season iff its **month** is within the inclusive range, where
`start ≤ end` is the normal range and `start > end` wraps the year end (e.g. 11–2 = Nov, Dec,
Jan, Feb). Both blank ⇒ year-round. In-season test: `inSeason_(month, s, e)` =
`s ≤ e ? (s ≤ m ≤ e) : (m ≥ s || m ≤ e)`.

**Rationale**: Whole-month granularity is enough for the "mow lawn in season" use case,
keeps the value hand-readable, and reuses the column/type/validator already in the repo
(the `validateSeasonWindow_` unit test already asserts wrap-around and half-window
rejection). No day-level season fields to add (Principle II/IV, minimal schema).

**Alternatives rejected**:
- *Month-day precision (Apr 15 – Oct 20)* — the spec briefly said "month-day"; reconciled to
  months to match the existing schema and avoid new columns. Day precision is unneeded for
  chores and can be added later without breaking data.
- *Two separate always-year rules instead of wrap-around* — worse UX; the range test handles
  wrap in one line.

## D5 — Logging the generation and the watermark advance

**Decision**: Reuse `createRecord_` for each generated Task, so each materialization appends
one `create` row by actor `system` (satisfying FR-011's per-generation logging and giving
the 003 feed a real "System added 'Buy flea meds'" entry). Advancing `lastGenerated` goes
through `updateRecordById_(TABS.RECURRING, …, 'system')`, which appends one `update` row —
but the generator only calls it when the new high-water **differs** from the stored value, so
a night that generates nothing writes and logs nothing.

**Rationale**: Honors Principle VI literally — the watermark is genuine persisted state, and
its change is logged, not silent. Reusing the logged mutation paths means no new
un-audited write path. Feed noise is low: an `update` by `system` appears only when a new
occurrence actually enters the window (≈ once per cadence per rule), alongside the `create`
it caused.

**Alternatives rejected**:
- *Write `lastGenerated` silently (no log)* — violates Principle VI; the constitution wins on
  conflict, and "it's just a cursor" is not an exception it grants.
- *One summary `generate` log per rule-run instead of per-task `create`* — would need a
  no-log create variant and hides which occurrences were made; per-task `create` is more
  useful in the feed and reuses existing code.
- *Suppress `system` rows from the feed here* — a feature-006 presentation choice, not this
  feature's concern; the log stays complete.

## D6 — Lookahead horizon in Settings

**Decision**: Add Settings key `recurringLookaheadDays` (default `30`), read per generator
run via `readSettingsMap_()`; a missing/blank/non-positive value falls back to the `30`
constant. Seeded through `SETTINGS_SEED` (append-only, never overwrites a hand-set value).

**Rationale**: FR-016 — hand-tunable without a code change, consistent with how `timezone`
and the weather thresholds already live in Settings. Fallback keeps the generator working
before the key is seeded.

**Alternatives rejected**:
- *Hardcode 30 in Config* — a code change + redeploy to retune; the household can't adjust
  it from the Sheet.
- *Per-rule lookahead* — unnecessary generality for two users; one household horizon suffices.

## D7 — Nightly trigger installation

**Decision**: `installRecurringTrigger_()` (run once from the editor) creates a single daily
time-driven trigger for `generateRecurringTasks_` at a fixed early-morning hour
(`ScriptApp.newTrigger('generateRecurringTasks_').timeBased().atHour(3).everyDays(1)`). It
first deletes any existing project trigger whose handler is `generateRecurringTasks_`, so
re-running it never stacks duplicate triggers (idempotent installer, Principle V).

**Rationale**: Matches "nightly" (FR-003) and the manual, editor-run setup pattern already
used by `setupDatabase()`/`checkExternalRequestAuth()` — triggers can't be created by a
cross-origin API call and shouldn't be. Early hour keeps generation before the morning
digest/day. Function name (not UUID) is the stable key for de-duping.

**Alternatives rejected**:
- *Auto-install on first `doPost`* — hidden side effect on a web request; setup should be an
  explicit, logged editor action.
- *Multiple sub-daily triggers* — chores don't need sub-daily precision; idempotency makes
  extra runs harmless but they're wasteful.

## D8 — `lastGenerated` is generator-managed (refused on rule create/update)

**Decision**: `recurring.create` and `recurring.update` reject a client-supplied
`lastGenerated` with `BAD_REQUEST` (same pattern 003 uses to refuse `status` on
`tasks.update`). On create the row's `lastGenerated` is left blank so the first run
back-fills from `today`. Hand-editing the Sheet remains the escape hatch to force
re-generation (clear the cell) — a deliberate, inspectable action.

**Rationale**: The watermark is an idempotency invariant; letting a client set it could
resurrect deleted occurrences or skip real ones. Refusing it at the edge keeps the invariant
server-owned while preserving the Sheet as the manual override (Principle II).

**Alternatives rejected**:
- *Accept and trust client `lastGenerated`* — forgeable watermark, breaks FR-013.
- *Silently ignore it* — hides a client mistake; explicit `BAD_REQUEST` is 003's convention.
