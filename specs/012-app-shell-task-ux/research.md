# Research: App Shell & Task UX (Phase 0)

All spec ambiguities were resolved in the 2026-07-09 clarification session (see spec.md
§Clarifications). This file records the *technical* decisions those answers imply, plus
two realities discovered while reading the existing code.

## R1 — Client-side navigation model (no router)

**Decision**: Hold the active section (`'calendar' | 'tasks' | 'feed' | 'more'`) as React
state in `App.tsx`, default `'calendar'`, and render the matching section. Pass the
active key + a setter into `AppShell`, which renders the bottom tab bar (mobile) and a
left sidebar rail (desktop) from one shared nav definition. No `react-router` or hash
routing.

**Rationale**: There are exactly four fixed sections and no deep-linking requirement
(spec: reload always lands on Calendar). A router is a new dependency and new concepts for
zero benefit here — constitution IV (boring/debuggable) favors plain view state. The
`AppShell` already enumerates the four tabs; this only lifts state and enables them.

**Alternatives considered**: `react-router` (rejected: unnecessary dependency, adds
history/param concepts we don't use); hash routing (rejected: no requirement to restore
last section, and it complicates the "always land on Calendar" rule).

**Accessibility**: exactly one nav item carries `aria-current="page"`; both bar and rail
share the same labels/icons; targets ≥44px; rail is `<nav>` with a labelled list.

## R2 — Desktop navigation form: left sidebar rail

**Decision**: On `sm+` widths, render a persistent left vertical rail (icon + label per
section) beside the ~1100px content column; the existing fixed bottom tab bar shows only
below `sm` (`sm:hidden`, already the case). The floating "+" quick-add stays.

**Rationale**: Clarified choice. DESIGN.md already frames desktop as a content column with
context to the side and "everything else is secondary navigation"; a calm left rail is the
conventional desktop pattern and keeps the header uncluttered. One nav definition feeds
both presentations so they can never drift.

**Alternatives considered**: top nav bar in the header (viable, rejected in clarify);
reusing the bottom bar at desktop widths (rejected: unconventional, wastes the wide
layout).

## R3 — Snooze write path: minimal idempotent backend action (the one backend change)

**Decision**: Add `tasks.snooze` and `tasks.unsnooze` handlers backed by a new
`setTaskSnooze_(id, newDueDate, actor)` / `unsnooze` path in `Sheets.js`, modeled directly
on `setTaskLifecycle_`:
- Inside `withLock_`: read the task; if already in the target state it's an idempotent
  no-change (`changed:false`, no log row).
- **snooze**: set `status='snoozed'`, set `dueDate=newDueDate`, **append** one entry to
  `snoozeHistory` (see R5), append an ActivityLog `snooze` row.
- **unsnooze**: set `status='open'` (leave the current dueDate as-is), append an
  ActivityLog `unsnooze` row. (`snoozeHistory` is a permanent trail — never cleared.)

**Rationale**: The `snoozed` status and `snoozeHistory` column already exist, but no action
sets them (`tasks.update` explicitly rejects `status`; `setTaskLifecycle_` only handles
done/open). Clarify chose full snooze semantics with a visible trail, which needs a server
write. Reusing the shipped lifecycle shape keeps it boring, idempotent (V), locked, and
logged (VI).

**Alternatives considered**: reframe defer as a plain `dueDate` edit via `tasks.update`
(rejected in clarify — loses the `snoozed` status and the history trail); defer the whole
US to a later feature (rejected in clarify).

## R4 — Shared-account attribution for lifecycle verbs

**Decision**: Extend `isWriteAction_` in `Config.js` so it also returns true for the
lifecycle verbs — `complete`, `reopen`, `snooze`, `unsnooze` — not just
`create`/`update`/`delete`. This makes `resolveWriteActor_` require `payload.actingPerson`
for shared-account callers on these actions, so the logged actor is a real person, never
`null`.

**Rationale**: `resolveWriteActor_` currently only forces acting-person resolution for
actions matching `/\.(create|update|delete)$/`. A shared-account snooze (or the already
shipped complete/reopen) would otherwise resolve to `actor = null`, violating constitution
VI ("every state change … actor"). The frontend already sends `actingPerson` on
complete/reopen and gates the whole app behind `ActingPersonPrompt`, so this is safe and
also hardens the pre-existing path. Recorded as a deliberate, in-spirit hardening (not a
silent change) and covered by a new SelfTest case.

**Alternatives considered**: handle actingPerson only inside the new snooze handler
(rejected: leaves complete/reopen’s shared-account gap unfixed and duplicates logic);
change nothing (rejected: null actor breaks the log/feed and the audit trail).

## R5 — `snoozeHistory` encoding (hand-readable, constitution II)

**Decision**: Store `snoozeHistory` as a plain, human-readable, append-only string of
entries separated by ` | `, each entry `YYYY-MM-DD→YYYY-MM-DD @ ISO8601` (from-due →
new-due, at timestamp). Example:
`2026-07-09→2026-07-14 @ 2026-07-09T08:12 | 2026-07-14→2026-07-20 @ 2026-07-14T07:03`.
The frontend parses this into rows for the task-detail history; a malformed/empty value
renders as "no history yet" and never crashes (mirrors the feed's tolerant summary).

**Rationale**: Constitution II requires no opaque blobs — a delimited, legible string an
owner can read/edit in the Sheet. Append-only matches the ActivityLog ethos. Arrow +
`@ time` is skimmable both in the Sheet and in the UI.

**Alternatives considered**: JSON array in the cell (rejected: opaque-ish, quoting noise,
violates the hand-editable spirit); store only the latest snooze (rejected: spec requires
the *full* trail across repeated snoozes).

## R6 — Feed reuses `activity.list`; management screens reuse existing CRUD

**Decision**: `FeedView` reads `activity.list` (already returns newest-first entries with a
composed human-readable `summary` and actor); no new backend. `RecurringManager` and
`TemplatesManager` use the existing `recurring.*` and `templates.*` create/update/delete
actions; the clarified create+edit+delete depth is fully covered by actions that already
exist (`REQUIRED_ON_CREATE` lists their required fields).

**Rationale**: Constitution IV/VII — don't build what exists. The only genuinely missing
backend capability in this whole feature is snooze (R3).

**Alternatives considered**: none needed.

## R7 — Event end-date + the missing event-edit UI

**Decision**: (a) In `QuickAddSheet`'s event path, add an optional **end date/time**
(defaults preserved: end = start + 1h when omitted, per existing `buildEventPayload`), with
a client-side guard rejecting end < start. (b) Add a new minimal **`EventEditSheet`**
(title, start, **end**, owner) that calls the existing `events.update`, opened from
`EventDetailSheet`. Multi-day (date-only) ends are allowed; end == start is allowed; only
end < start is rejected.

**Rationale**: The Sheet and Schedule-X already handle ends; only the forms are missing.
Reading the code confirmed there is **no event-edit UI at all today** (`events.update` is
unused; `EventDetailSheet` is read-only), so US4's "create *and* edit" necessarily
introduces the edit sheet — a real but small addition, flagged in the plan for the review
pause. Validation lives in a pure helper for unit testing.

**Alternatives considered**: scope US4 to create-only (rejected: spec US4 scenario 3
explicitly edits an existing event's end); full event-editing parity with all fields
(deferred: keep the edit sheet minimal — the fields that exist on create plus end).

## R8 — Task list grouping, sorting, and owner-filter reuse

**Decision**: `lib/tasks.ts` provides pure functions: partition tasks into Open
(`status !== 'done'`, i.e. open + snoozed) and Done (`status === 'done'`); within Open,
sort by `dueDate` ascending with overdue first and undated last; Done is collapsed by
default. `TasksView` filters by the shared owner-filter chips (reuse `useOwnerFilter` +
`OwnerFilterChips`) exactly like the calendar. Snoozed tasks show a "snoozed until <date>"
affordance and remain in the Open group but visually de-emphasized until due.

**Rationale**: Clarified organization (all tasks, Open→collapsed Done, owner-filter aware).
Pure functions are unit-testable (DoD) and keep the component thin. Reusing
`useOwnerFilter` keeps calendar and tasks consistent and avoids a second source of truth.

**Alternatives considered**: my-tasks-only default and flat-list (both rejected in clarify);
a separate filter for tasks (rejected: inconsistent with the calendar's chips).
