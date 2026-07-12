# Phase 0 Research — Recurring Events

All decisions below resolve the design space around the spec + clarify session. There were
no open `NEEDS CLARIFICATION` markers entering planning; the three clarify answers (all-day
default, separate 60-day horizon, cascade-clean prep on delete) are treated as fixed inputs
and recorded here with their implementation consequence.

---

## D1 — Where recurring-event rules live: new tab vs. shared `Recurring` tab

**Decision**: A **new `RecurringEvents` tab**, separate from feature 004's `Recurring` tab.

**Rationale**: The clarify session fixed recurring-event rules as a *distinct rule type*
from recurring chores. Event rules need columns chores don't (occurrence `startTime`,
`durationMinutes`, `templateId`, `location`, `notes`); folding them into `Recurring` with a
discriminator would leave every chore row carrying blank event columns and vice-versa,
hurting the hand-editable readability the constitution requires (Principle II). Two tabs
keep each engine's schema tight and its generator independent (they even run on different
trigger hours). The `RecurringEvents` generator reuses the *pure* date math from
`Recurring.js` (`occurrencesInWindow_`, `inSeason_`, `addMonthsClamped_`, `addDays_`,
`monthOf_`, `ymd_`), so "separate tab" costs no duplicated logic.

**Alternatives considered**:
- *Shared `Recurring` tab + `kind` column*: rejected — mixes two schemas, clutters rows,
  and risks a chore generator and an event generator both scanning rows they must skip.
- *A `type`/marker on Events instead of a rules tab*: rejected — there is no rule entity to
  edit; recurrence requires a durable rule row, which is the whole point of 004's design.

---

## D2 — Occurrence timing representation (all-day vs. timed)

**Decision**: All-day is the **default** and is stored as **date-only** `start`/`end`
(`YYYY-MM-DD`). A rule with a `startTime` (`HH:mm`) produces a **timed** occurrence:
`start = date + 'T' + startTime`, `end = start + durationMinutes` (default 60 when a
`startTime` is set but `durationMinutes` is blank).

**Rationale**: The frontend already treats a date-only `start` (or `start === end`) as
all-day via `isAllDay()` in `frontend/src/lib/datetime.ts`, and the bespoke calendar views
render all-day chips from exactly that shape — so birthdays/anniversaries render correctly
with **no calendar changes**. The generator writes occurrences through `createRecord_`,
which does **not** run type validation (that lives only in the API handler layer), so a
date-only `start` on the datetime-typed Events column is written cleanly — the same way
feature 004 writes a date-only `dueDate` and feature 015's recurring-task pseudo-events
render all-day today.

**Consequence**: To let a user *edit* an all-day occurrence's date through the API without a
`VALIDATION_FAILED`, Events `start`/`end` validation must accept an all-day (date-only)
value in addition to a full datetime. This is a small, principled relaxation that finally
lets all-day events round-trip through the API (it scopes the long-parked "all-day toggle"
down to just acceptance, no new UI toggle).

**Alternatives considered**:
- *Store all-day as a 9:00 AM timed event* (the current time-less default): rejected — the
  clarify answer explicitly chose true all-day (date only, no time); a 9 AM birthday chip is
  the wrong result.
- *Add an explicit `allDay` boolean column to Events*: rejected as scope creep — the
  date-only convention already fully drives the frontend; a boolean would duplicate that
  signal and reopen the parked toggle work.

---

## D3 — Linking an occurrence back to its rule

**Decision**: Add a **`recurringEventId`** column to the `Events` tab, set to the rule's id
on every generated occurrence (blank on ordinary events). Parity with `Tasks.recurringId`.

**Rationale**: FR-004 requires each occurrence link back to its rule. The deterministic
occurrence id encodes the rule one-way only; a real column gives reversible provenance
(future "this repeats" UI hints, and a clean way to tell generated occurrences apart).
`setupDatabase()` provisions new headers additively and the app tolerates extra/hand-added
columns, so this is a backward-compatible migration — the same "run `setupDatabase()` then
`selfTest()` after deploy" step already used for prior tab/column additions.

**Alternatives considered**: reuse the existing `type` column (rejected — `type` is the
user-facing event category and must not be overloaded); rely solely on the deterministic id
(rejected — not reversible, and brittle for UI).

---

## D4 — Idempotency & never-resurrect

**Decision**: Reuse 004's two mechanisms verbatim. (a) **Deterministic occurrence id**
`recurringEventOccurrenceId_(ruleId, date) = 'v' + hex(MD5(ruleId + '|' + date))`; because
`createRecord_` returns the existing row when an id is already present, re-runs and
overlapping executions collapse to one row. (b) **`lastGenerated` watermark** per rule: the
generator advances it to the latest occurrence date it has materialized and starts the next
run strictly after it, so a user-deleted occurrence is never regenerated (never-resurrect,
FR-006) exactly as recurring tasks behave.

**Rationale**: This is the constitution's Principle V pattern already proven in production
for 004; copying it removes an entire class of risk. The `'v'` prefix (for eVent occurrence)
is distinct from `'r'` (recurring task) and `'p'` (prep task); an `isRecurringEventId_()`
shape check (`/^v[0-9a-f]{32}$/`) mirrors `isPrepTaskId_()`.

**Alternatives considered**: a per-occurrence "deleted" tombstone (rejected — the watermark
already suppresses regeneration with zero extra state); random UUID ids (rejected — breaks
idempotent replay).

---

## D5 — Prep for occurrences

**Decision**: The recurring-event generator, immediately after `createRecord_`-ing each
occurrence, calls the existing **`syncPrepForEvent_(occurrence, 'system')`** from
`PrepTasks.js` — unchanged. The occurrence is created with the rule's `templateId` and a
blank `prepGeneratedFor`, so `syncPrepForEvent_` sees a transition and generates the prep
set, dated by each step's `offsetDays` relative to the occurrence's date.

**Rationale**: Mirrors `createEvent_`, which already calls `syncPrepForEvent_` after
creating an event with a template. Prep-task ids are deterministic on the (occurrence id,
step id) pair, so re-runs never duplicate prep and each occurrence's prep is independent
(FR-011). A rule with no template, or one pointing at a deleted template, simply yields an
occurrence with no prep and no error (FR-012) — that is already `syncPrepForEvent_`'s
behavior for an empty/absent template. The nightly `generatePrepTasks()` trigger remains a
backstop but is not relied upon for correctness.

**Consequence — trigger ordering**: install the recurring-events generator at **hour 2**,
before the recurring-task generator (hour 3), prep (hour 4), gcal (hour 5), digest (hour 6),
so it never contends and its occurrences exist before every downstream job. (Prep is already
generated inline, so ordering vs. hour 4 is a belt-and-suspenders nicety, not a dependency.)

---

## D6 — Lookahead horizon

**Decision**: A dedicated, hand-tunable **`recurringEventsLookaheadDays`** Settings key,
**default 60**, independent of feature 004's 30-day `recurringLookaheadDays`. Fallback
constant `RECURRING_EVENTS_LOOKAHEAD_DEFAULT_DAYS = 60` when the key is blank/≤0.

**Rationale**: The clarify session chose a separate, longer events horizon so annual events
surface sooner and a long-lead prep step (e.g. "book venue 6 weeks out") materializes before
its offset date — a 30-day window would date such a step in the past at first materialization.
Keeping it Sheet-only (not in `EDITABLE_SETTINGS`) matches how `recurringLookaheadDays` is
managed today; it can be promoted to the Settings editor later if wanted.

**Alternatives considered**: reuse the 30-day chore horizon (rejected — starves long-lead
prep and hides annual events); auto-extend per-rule to max prep offset (rejected — more
moving parts than a single hand-tunable horizon needs).

---

## D7 — Deleting an occurrence: cascade-clean prep (FR-017)

**Decision**: No new code needed. `deleteEvent_` (`backend/Api.js`) **already** removes
*all* prep tasks linked to an event (`eventId` match ∧ `isPrepTaskId_`) — completed and
outstanding alike — before deleting the event row, as existing, deliberate feature 005
behavior (005's own FR-017). Occurrence events are ordinary Events deleted through the same
`events.delete` action, so they already get this cascade with zero new code. This feature's
job is to **test** that the existing cascade covers occurrences (SelfTest T013) and to word
its own FR-017 to match reality.

**Correction record**: the clarify question that produced this decision was framed on a
false premise — it assumed `events.delete` orphaned prep tasks today. It does not; that
premise was wrong, discovered while reading `Api.js` during implementation. The clarify
*answer* (cascade-clean) still holds and is already satisfied, just more completely than
asked (all prep removed, not only outstanding) — so no behavior change or design pivot was
needed, only correcting the spec's wording to describe what already happens.

**Alternatives considered**: changing `deleteEvent_` to keep completed prep as history
(rejected — would be an unrequested behavior change to already-shipped, explicitly-spec'd
005 behavior, and no one asked for it); cascading only when `recurringEventId` is set
(moot — the existing cascade already applies uniformly to every event).

---

## D8 — Rule CRUD & validation

**Decision**: New `recurringEvents.create/update/delete/list` actions mirror `recurring.*`.
`createRecurringEvent_`/`updateRecurringEvent_` reuse `rejectUnknownFields_`,
`requireFields_`, `validateFields_`, `validateSeasonWindow_`, `mutablePatch_`, and the
`lastGenerated` guard (generator-managed; rejected on create/update). A new **`time`** field
type (`/^([01]\d|2[0-3]):[0-5]\d$/`) validates `startTime`; `durationMinutes` is `posint`;
`templateId` is free text (lenient — an unknown/deleted template is tolerated, FR-012).
Required-on-create: `title`, `cadence`, `anchorDate`, `defaultOwner` (timing optional →
all-day).

**Rationale**: Straight parallel of the well-tested recurring-chore CRUD; no new validation
architecture. Deleting a *rule* uses the generic `deleteEntity_` (occurrences already on the
calendar remain, FR-008).

**Alternatives considered**: validating `templateId` against existing templates (rejected —
005 already tolerates a missing template by producing no prep; matching that keeps behavior
uniform and avoids a create-order dependency between templates and rules).

---

## Constitution re-check (post-design)

Unchanged from the plan's gate: all seven principles PASS. The design adds no external
service, no scale/role concepts, keeps the Sheet hand-editable, reuses idempotent logged
primitives, and mirrors existing patterns. No new OAuth scope (`script.scriptapp` already
granted). No violations to track.
