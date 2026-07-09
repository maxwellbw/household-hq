# Research: Google Calendar Sync (gcal-sync)

Phase 0 decisions. Each: **Decision / Rationale / Alternatives considered**. All resolve the
"how" within the decided stack (Apps Script + `CalendarApp` + the Sheet-as-DB engine).

---

## D1 — Where the app↔calendar mapping is stored

**Decision**: Store the Google Calendar event id **in the Sheet cell** — `Events.gcalEventId`
(already reserved in the schema) and a **new additive `Tasks.gcalEventId` column**. That cell
is the authoritative pointer for update/delete. Additionally **tag** each mirrored calendar
event with its record id and kind via `CalendarEvent.setTag('hhqId', <recordId>)` +
`setTag('hhqKind', 'event'|'task')`, used only as a reverse index for the orphan sweep (D3).

**Rationale**: Principle II — the pointer is a plain, hand-readable string in the Sheet, and
**clearing it by hand is a legible repair lever** (forces a fresh mirror next run). It matches
the schema's already-reserved `gcalEventId` column, so Events needs no migration and Tasks
gets the same additive migration 005 used for `prepGeneratedFor`. The tag lives on the Google
side only to answer "which calendar entries did we create?" for cleanup.

**Alternatives considered**:
- *Advanced Calendar API extended properties as the sole store* — robust, queryable by private
  property, but requires enabling the advanced service, is invisible in the Sheet (violates the
  inspectability spirit of Principle II), and is less boring (Principle IV). Rejected.
- *Deterministic id like 004/005* — impossible: the mirror id is minted by Google, not by us.
- *No stored mapping, reconcile purely by matching title/time* — fragile, duplicates on any
  edit. Rejected.

---

## D2 — Idempotency: never duplicate, safe to re-run (Principle V, FR-009/015)

**Decision**: Per record, the mirror function branches on the pointer cell:
- **empty** → `createEvent`/`createAllDayEvent`, then store the returned id in the cell + tag
  the event.
- **set, event resolvable** (`Calendar.getEventById(id)` non-null) → update it in place
  (title, times, color, reminders).
- **set, event missing** (deleted in Google, stale pointer) → recreate + rewrite the cell
  (FR-015).
- **record not "desired"** → if the cell holds an id, delete the event and clear the cell.

Creation is gated solely on "cell empty," so any number of overlapping/retried runs converge
to exactly one entry (SC-002/005). The pointer write goes through a **locked single-cell
writer** so a concurrent run can't interleave two creates for the same row.

**Rationale**: This is the events-side analogue of 004/005's replay-safety, achieved with a
stored pointer instead of a deterministic id. Straight-line and inspectable.

**Alternatives considered**: pre-scan the whole calendar each run to dedupe by tag — more
calendar reads, same result; kept as the *orphan sweep* (D3) but not the primary create guard.

---

## D3 — The reconciler brain, its call sites, and the orphan sweep (FR-010, US3)

**Decision**: One idempotent function per kind — `syncCalendarForEvent_(event)` and
`syncCalendarForTask_(task)` — sharing calendar helpers. Called two ways:

1. **Immediately (synchronously) after each write** in `Api.js`, wrapped in `try/catch`: a
   mirror failure is logged and swallowed so it **never fails the user's write**; the nightly
   run repairs it. Call sites: `createEvent_`, `updateEvent_`, `deleteEvent_`, `createTask_`,
   `updateTask_`, `completeTask_`, `reopenTask_`, tasks delete.
2. **Nightly** via `syncCalendar()` (time-driven trigger entry point): iterate all Events and
   Tasks, call the same brain per record (per-record `try/catch` isolation, mirroring
   `generatePrepTasks`), **then run the orphan sweep** — `Calendar.getEvents(windowStart,
   windowEnd)`, keep only events carrying our `hhqId` tag, and **delete any whose `hhqId` is
   not in the current desired set** (covers rows deleted directly in the Sheet, which the
   write path never saw).

**Rationale**: Directly mirrors 005's on-save + nightly reconcile duo — a proven, boring
shape. The orphan sweep is the only way the nightly run learns about hand-deleted Sheet rows,
since a deleted row takes its `gcalEventId` with it.

**Alternatives considered**: only-immediate (no trigger) — fails US3 self-healing and misses
hand-edited Sheet rows; only-nightly — fails the clarify "immediate" decision (notifications
would lag). Both rejected in favor of both-paths.

---

## D4 — Owner treatment: title prefix + per-owner color (FR-007)

**Decision**: Title = `'[' + Label + '] ' + record.title` where Label ∈ `Max`/`Jaz`/`Both`.
Color via `CalendarEvent.setColor(CalendarApp.EventColor.X)` using the closest fixed Google
color to each DESIGN.md owner hue:

| Owner | DESIGN token          | Google `EventColor` | Google name |
|-------|-----------------------|---------------------|-------------|
| max   | `#3E6E68` pine teal   | `CYAN`              | Peacock     |
| jaz   | `#7E4A5E` berry/plum  | `MAUVE`             | Grape       |
| both  | `#C6613F` terracotta  | `ORANGE`            | Tangerine   |

**Rationale**: Google's per-event palette is a fixed set of ~11 colors, so exact DESIGN hex
values aren't reproducible — pick the nearest so owner identity stays recognizable across the
phone calendar and the app (Principle: owner color is identity). The text prefix guarantees
owner is legible even where a client renders all one calendar color (accessibility — color is
never the only signal, per DESIGN.md/PRODUCT.md).

**Alternatives considered**: color-only (rejected in clarify — weak for accessibility);
prefix-only (loses the at-a-glance identity). Both were the non-recommended clarify options.

---

## D5 — Reminders so phones actually notify (FR-007a)

**Decision**: On each mirrored entry, reset reminders to a controlled set:
- **Timed event** → `addPopupReminder(gcalEventReminderMin)` (Setting, default **30** min
  before start).
- **Dated-task all-day entry** → a **morning-of** popup at `gcalTaskReminderTime` (Setting,
  default **09:00**). Implemented as a popup reminder computed for that clock time on the due
  date. Because Google measures all-day reminders from the event's midnight start, the builder
  converts `gcalTaskReminderTime` to the equivalent minutes and sets the popup accordingly.

Both Settings are plain, hand-editable values (Principle II). The reminder is (re)applied on
every mirror so drift is corrected.

**Rationale**: The entire point of the feature is not missing things (SC-001) — controlling
reminders is more reliable than depending on each phone's per-calendar default (the
non-recommended clarify option).

**Known risk / to validate in quickstart**: all-day-event reminder *fire time* on mobile can
follow the device's all-day-notification setting. If the morning-of popup proves unreliable on
a subscribed calendar during quickstart, the documented fallback is to render dated-task
mirrors as a **short timed entry at `gcalTaskReminderTime`** instead of all-day. This is a
one-line change in the task-entry builder and is called out in [quickstart.md](quickstart.md)
Scenario D.

---

## D6 — What gets mirrored, and the time window (FR-005/010a)

**Decision**:
- **Events**: every event whose `end` is **today or later** (household tz). Type is ignored —
  all events mirror.
- **Tasks**: only those with a non-empty `dueDate` **today or later** AND `status ∈ {open,
  snoozed}`. Undated, done, and past-due-cleared tasks produce no entry; a `done`/deleted/
  undated task has its existing entry removed.
- **Window**: today − small grace (e.g. 1 day) forward, **no far-horizon cap**. The window
  bounds the nightly reconcile scan and the orphan sweep's `getEvents` call; already-created
  entries are left in place as they age past (history not retro-deleted).

**Rationale**: Matches the clarify "today-forward, all future" answer. Household volume is
tens of items, so an unbounded forward horizon is trivially within quota; a bounded window
would only add complexity and hide far-future items (Principle IV).

**Alternatives considered**: bounded rolling window (the non-recommended clarify option) —
unnecessary for this scale.

---

## D7 — OAuth scope (FR-016, brief §5.16)

**Decision**: Add the broad `https://www.googleapis.com/auth/calendar` scope (read+write on
all accessible calendars) to `appsscript.json`, alongside the existing spreadsheets /
external_request / scriptapp scopes. Only the deploying **shared** account re-authorizes once.

**Rationale**: 007 only needs write on the Household calendar, but **feature 011** will need
read on Max's/Jaz's work calendars (shared to the shared account) and write of invites. The
manifest lists scopes explicitly (Apps Script does **not** auto-detect — see CLAUDE.md), so
requesting the broad scope now spares 011 a second manifest change + re-auth round-trip. One
deliberate broad grant, documented, is cheaper than two narrow ones.

**Alternatives considered**: `calendar.events` or a Household-calendar-only scope — narrower,
but forces a re-auth in 011. Rejected per the clarify/brief decision to front-load the scope.

---

## D8 — Trigger cadence (FR-010)

**Decision**: One **nightly** time-driven trigger at **hour 5** (`GCAL_TRIGGER_HOUR = 5`),
offset from `RECURRING_TRIGGER_HOUR = 3` and `PREP_TRIGGER_HOUR = 4` so the three nightly jobs
don't contend. `installCalendarTrigger()` is idempotent (deletes any existing
`syncCalendar` trigger first), run once from the editor — same shape as
`installRecurringTrigger`/`installPrepTrigger`.

**Rationale**: The **immediate** write-path mirror already delivers timeliness; the trigger is
the self-healing backstop and the path that picks up hand-edited Sheet rows, so nightly is
sufficient and consistent with 004/005. Fewer moving parts (Principle IV).

**Alternatives considered**: hourly / every-15-min reconcile — more responsive to a failed
immediate mirror or a hand-edit, but heavier and inconsistent with the established nightly
cadence. If, in practice, failed immediate mirrors or hand-edits need faster healing, bumping
to `everyHours(1)` is a one-line change; deferred until there's evidence it's needed.

---

## D9 — Logging shape (FR-012, Principle VI)

**Decision**: Each calendar create/update/delete appends one ActivityLog row via `appendLog_`
with action **`gcal-sync`**, actor `system`, `targetId` = the record id, and a `detail`
describing the calendar action (e.g. `created calendar event for "Vet appointment"`).
`gcal-sync` is added to `ACTION_VERBS` (e.g. → "synced to calendar") so the 003 activity feed
renders it; unknown-action fallback would render it raw regardless. No-op mirrors (nothing
changed) write nothing and log nothing.

**Rationale**: Honest per-action logging without overloading the existing `create`/`update`/
`delete` verbs (which mean *the record changed*, not *its mirror changed*). Keeps the feed
readable.

**Alternatives considered**: reuse `update` for pointer writes — semantically misleading (looks
like a user edit). Rejected.
