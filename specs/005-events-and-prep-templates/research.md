# Research: Events and Prep Templates (Phase 0)

Design decisions resolving the plan's Technical Context. Each is Decision / Rationale /
Alternatives. The dominant constraint is the same as feature 004: **idempotent generation
under re-running triggers** (Principle V), now for event-driven prep rather than cadence
rules. Where 004 already solved a sub-problem, we reuse it rather than re-invent.

## D1 — Deterministic prep-task id (idempotency key + prep-task discriminator)

**Decision**: A generated prep task's id is `'p' + hex(MD5(eventId + '|' + templateStepId))`,
where `templateStepId` is the TaskTemplates row's `id`. Date-independent by design.

**Rationale**:
- **Idempotent creation** (FR-011): the same (event, step) always hashes to the same id, so
  `createRecord_`'s id-replay collapses re-runs, overlaps, and the on-save + nightly double
  path to a single row — exactly the mechanism 004 uses (`recurringTaskId_`).
- **Re-dating in place** (FR-015): because the id does *not* include the date, moving the
  event and re-writing `dueDate` updates the same row instead of orphaning the old date and
  creating a new one. (An id that hashed the date — as 004's does, where occurrences are
  distinct dates — would be wrong here, where one step keeps its identity as the event moves.)
- **Discriminator**: `^p[0-9a-f]{32}$` distinguishes a prep task from a user's manually
  event-linked task (a `Utilities.getUuid()` has hyphens and the wrong length, so it never
  matches). This lets cleanup target only prep tasks and never delete a manual task the user
  linked to the event. Mirrors 004's `'r'` prefix; the two never collide.

**Alternatives considered**: (a) id = hash(eventId|stepId|dueDate) — breaks re-dating
(FR-015) by minting a new row on every move. (b) A random UUID + a "generated" flag column on
Tasks — needs a schema change to Tasks and loses replay-based idempotency. (c) Match prep
tasks only by `eventId` — would sweep up a user's manual event-linked task on cleanup.

## D2 — `prepGeneratedFor` marker on Events (the non-resurrection tombstone)

**Decision**: Add one plain-text column to the **Events** tab, `prepGeneratedFor`, holding the
`templateId` whose prep has been materialized for that event (blank = none yet). Creation of
prep happens **only on a transition** (`event.templateId != event.prepGeneratedFor`); in the
steady state (`==`) the generator re-dates survivors but creates nothing.

**Rationale**: FR-014 forbids resurrecting a hand-deleted prep task on any later run. With a
nightly reconcile that could otherwise "fill the gap," we need to distinguish *never generated*
from *generated then deleted* — 004 got this for free from `lastGenerated`; events have no such
field, so we store one. The marker also:
- Detects a **hand-edited retag** in the raw Sheet (someone changes `templateId` directly):
  next run sees `templateId != prepGeneratedFor` → swaps the prep set (SC-006).
- Detects a **hand-cleared tag** (`templateId` blanked): `prepGeneratedFor` still set → the
  run removes the event's outstanding prep and clears the marker.
- Is fully inspectable (Principle II/IV): reading an Event row tells you whether — and for
  which template — prep was generated. Clearing the cell by hand forces regeneration.

**Why not a marker-free heuristic** ("generate when the event has zero linked prep tasks"):
it resurrects on the *delete-all* case — a user who deletes every prep task but leaves the tag
on would get the whole set re-created on the next nightly run, violating FR-014. The marker is
the only strictly-correct option and is the boring/debuggable one (a visible field beats an
implicit inference).

**Alternatives considered**: (a) a separate tombstone tab of deleted (eventId, stepId) pairs —
more moving parts, a new tab, harder to hand-inspect. (b) scanning ActivityLog for prior
create/delete of each prep id — fragile and slow. (c) a timestamp marker `prepGeneratedAt` —
works for "generated?" but can't detect a retag; storing the `templateId` is strictly more
useful for the same one column.

## D3 — `syncPrepForEvent_(event, actor)`: one idempotent brain for every path

**Decision**: A single function reconciles an event's prep, called by `createEvent_`,
`updateEvent_` (both synchronous, immediate), and the nightly `generatePrepTasks()` (per
event). Steps:

1. `T = event.templateId`, `G = event.prepGeneratedFor`. Read the event's existing prep tasks
   `P` = Tasks where `eventId == event.id` and `id` matches `^p[0-9a-f]{32}$`. Read the current
   checklist `S` = TaskTemplates rows where `eventType == T` (empty if `T` blank).
2. **Desired set** = for each step `s` in `S`: id `prepTaskId_(event.id, s.id)`, `dueDate =
   dateOf(event.start) + s.offsetDays`, `title = s.taskTitle`, `owner = s.defaultOwner`,
   `eventId = event.id`, `status = open`.
3. **If `T != G` (transition):** delete the *outstanding* (`status == open`) prep in `P` whose
   id is not in the desired set (retire the old template's leftovers; keep completed — FR-016);
   `createRecord_` each desired task (deterministic id → a still-present completed one replays,
   no dup); set `event.prepGeneratedFor = T` via `updateRecordById_(TABS.EVENTS, …, 'system')`.
   (If `T` is blank this reduces to: remove outstanding prep, clear the marker.)
4. **If `T == G` (steady state):** create nothing (no resurrection). For each desired `d` whose
   id matches an *outstanding* task in `P` with a different `dueDate`, update that task's
   `dueDate` (FR-015 re-date on move). Leave completed prep untouched.

**Rationale**: One brain means create/update/hand-edit/nightly can't drift apart, and every
requirement (FR-008/011/014/015/016) is satisfied in one place. It writes only through the
existing locked/logged/idempotent `Sheets.js` helpers, so — exactly like 004's
`generateForRule_` — it needs no outer lock and is safe under overlap. Reads are cheap at
two-user scale; the nightly loop re-reads per event (Principle IV: simple over a shared-snapshot
optimization that buys nothing at this size).

**Alternatives considered**: separate `generatePrep_`/`regeneratePrep_`/`redatePrep_`
functions per trigger — four code paths to keep consistent; rejected for the single reconciler.

## D4 — Generation timing: on-save **and** nightly (from clarification)

**Decision**: Prep generates synchronously inside `createEvent_`/`updateEvent_` (immediate, so
the app shows prep the moment an event is tagged) **and** on a nightly reconcile trigger
`generatePrepTasks()` that runs `syncPrepForEvent_` over every event.

**Rationale**: The clarification chose "on save + nightly." The on-save path is the good UX;
the nightly path is the safety net for (a) events/templates added or retagged by hand directly
in the Sheet (SC-006), and (b) a synchronous run that failed mid-flight. Both call the same
idempotent brain (D3), so running both never duplicates. The synchronous path adds negligible
latency (a few extra locked writes within the existing < 5s budget).

**Alternatives considered**: nightly-only (up to ~24h before prep appears — worse UX, rejected
in clarification); on-save-only (misses hand-edited Sheet rows, violating SC-006).

## D5 — Offset application & date extraction

**Decision**: `offsetDays` is a signed integer (clarification: T−2 = `-2`). A prep task's
`dueDate = addDays_(event.start.substring(0,10), Number(offsetDays))`. The event's `start` is
an ISO datetime (`YYYY-MM-DDTHH:mm`); prep keys off its **date part** only (multi-day events
prep relative to their start — spec edge). `addDays_` (from `Recurring.js`) already handles
negative shifts and month/year boundaries.

**Rationale**: Matches the brief's literal `-2` and the existing `TaskTemplates.offsetDays`
`int` type, keeps the Sheet self-documenting, and reuses tested date math (no duplication).
A prep task whose computed date is in the past is still created (FR-018) — no clamping.

**Alternatives considered**: storing offset as a positive "days-before" count — contradicts the
brief and the seeded examples; rejected in clarification.

## D6 — Event delete purges all prep (FR-017)

**Decision**: `events.delete` routes to a new `deleteEvent_` that deletes the event row
(`deleteRecordById_`) **and** deletes every prep task for that event — `Tasks` where
`eventId == id` and `id` matches the prep-id pattern — **completed and outstanding alike**.
Manual (non-prep) tasks linked to the event are left untouched (the pattern excludes them).

**Rationale**: The clarification chose "delete all prep" (no orphans, clean list). Using the
prep-id pattern + `eventId` finds every prep task regardless of later template edits, and
protects a user's manually event-linked tasks. Each deletion logs one `delete` by the acting
user (Principle VI). Contrast with move/retag, where the event persists and completed prep is
preserved (FR-015/016) — only outright deletion clears completed prep.

**Alternatives considered**: keep completed prep on delete (rejected in clarification); cascade
via a Sheet formula (not possible / not hand-safe).

## D7 — Nightly trigger installer `installPrepTrigger()`

**Decision**: A one-time editor-run installer creates a single daily time-driven trigger for
`generatePrepTasks`, removing any existing trigger for the same handler first (idempotent).
Runs at `PREP_TRIGGER_HOUR` (household tz), offset from 004's recurring hour so the two nightly
jobs don't overlap-contend. Public name (no trailing underscore) so the editor/trigger can see
it (CLAUDE.md gotcha).

**Rationale**: Mirrors `installRecurringTrigger()` exactly, including the "delete-then-create"
idempotency and the underscore rule. Reuses the `script.scriptapp` scope already granted for
004 — **no new OAuth scope, no re-authorization**.

**Alternatives considered**: piggy-back on the existing recurring trigger (couples two features'
schedules; a failure in one shouldn't skip the other — keep them separate triggers).

## D8 — TaskTemplates CRUD; template edits don't retroactively regenerate

**Decision**: Add `templates.create/update/delete` mirroring 004's rule CRUD
(`rejectUnknownFields_` → `requireFields_` against a new
`REQUIRED_ON_CREATE.TaskTemplates = ['eventType','taskTitle','offsetDays','defaultOwner']` →
`validateFields_` → `createRecord_`/`updateRecordById_`/`deleteRecordById_`). Editing or
deleting a step does **not** rewrite prep already generated for existing events; a newly added
step is picked up only when an event of that kind is next tagged/retagged (spec edge case).

**Rationale**: Templates are ordinary rows; the generator reads them at run time. Not
retroactively rewriting existing prep matches the spec and keeps template CRUD a pure,
side-effect-free row operation (Principle IV). Stable template `id`s (TaskTemplates ∈ `ID_TABS`)
are what the deterministic prep id depends on, so a step keeps its identity across edits.

**Alternatives considered**: regenerate all affected events' prep on any template edit —
surprising (silently rewrites dated tasks), heavier, and explicitly out of scope per the spec.

## D9 — `prepGeneratedFor` is generator-managed

**Decision**: `createEvent_`/`updateEvent_` reject a client-supplied `prepGeneratedFor`
(`BAD_REQUEST`), exactly as 004 rejects `lastGenerated`. Only `syncPrepForEvent_` (actor
`system`) writes it. A user may still clear it by hand-editing the Sheet to force regeneration.

**Rationale**: The marker is engine state, not user input; letting a client set it could
suppress or force generation incorrectly. Consistent with 004's watermark handling (D8 there).

## D10 — Activity-log attribution

**Decision**: Event create/edit/delete and template create/edit/delete log under the acting
**user** (via the existing handlers). Prep-task generation, re-dating, cleanup, and the
`prepGeneratedFor` write log under `system` (the existing generator actor). Delete-purge of an
event's prep logs each removed prep task under the **user** who deleted the event (it is their
action). No-op steady-state runs (no date change) write and log nothing.

**Rationale**: Principle VI — every state change logged, none silent — while keeping the feed
readable ("System added 'Clean the house'", "Jaz deleted 'Guest weekend'"). Reuses
`appendLog_` inside the `Sheets.js` mutations, so attribution is automatic.

## D11 — Reuse `addDays_` from `Recurring.js` (no duplication)

**Decision**: `PrepTasks.js` calls the existing global `addDays_` for offset math rather than
re-implementing it. All backend files share one Apps Script global scope, so cross-file helper
reuse is free.

**Rationale**: Principle IV — one tested date helper, not two copies that can drift. `addDays_`
already handles negative offsets and month/year rollover, which is all prep dating needs.

## Reused as-is (no research needed)

- **Locking / idempotent writes / logging**: `withLock_`, `createRecord_`,
  `updateRecordById_`, `deleteRecordById_`, `appendLog_` (001/003) — unchanged.
- **Validation**: `rejectUnknownFields_`, `requireFields_`, `validateFields_`, `isValidType_`
  (`int`, `owner`, `datetime`, `date` already defined) (001).
- **Auth**: verified `token` → `actor`, shared-account `actingPerson` on writes (002) —
  `templates.*` and `events.*` are `*.create/update/delete`, already classified writes by
  `isWriteAction_`.
- **Blank-id adoption** for hand-added Event/TaskTemplates rows (001 FR-022) — `readTableForWrite_`.
- **Timezone / date formatting**: `getTimezone_`, ISO strings (001/004).
