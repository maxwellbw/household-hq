# Research: Tasks CRUD and Activity Log (003)

Phase 0 decisions. The spec left two items explicitly to plan-level (the feed's default
bound size, and the shape by which mine ∪ ours is retrievable). The rest are design choices
about how to tighten 001's raw operations without breaking its frozen envelope.

## D1 — Completion is its own action, not a `status` field write

**Decision**: Add `tasks.complete` and `tasks.reopen`. Remove completion from
`tasks.update`: supplying `status`, `completedBy`, or `completedAt` to `tasks.update` is a
`BAD_REQUEST` that names the dedicated action. `tasks.update` handles title/owner/dueDate
only (set, move, clear).

**Rationale**:
- FR-015 requires the feed to show `complete`/`reopen` as **distinguishable** actions, not
  generic `update`s. A dedicated handler logs a dedicated action name; a status-in-update
  path would log `update`.
- FR-003's no-change semantics (re-completing a `done` task preserves the original
  completer/time and writes **no** new log row) need the handler to inspect current status
  *before* stamping. 001's `updateTask_` unconditionally re-stamps `completedBy = actor`
  and always logs — wrong for 003.
- One completion path is more debuggable (Principle IV) and makes the ActivityLog
  unambiguous (Principle VI).

**Alternatives considered**:
- *Keep status-in-update, special-case done→done*: keeps one action but still logs
  `update` (fails FR-015) and tangles edit validation with lifecycle stamping.
- *A single `tasks.setStatus`*: would also need to fabricate distinguishable log actions
  from the target value — same complexity, less obvious call site.

**Consequence for 001**: this supersedes 001's api.md line "Setting `status:"done"` via
update stamps completion." Recorded in [contracts/api-003.md](contracts/api-003.md); 001's
`SelfTest.js` block that drove completion through `updateTask_` is rewritten to use the new
functions.

## D2 — No-change (idempotent) lifecycle semantics

**Decision**:
- `tasks.complete` on an **open** or **snoozed** task → set `status = done`, stamp
  `completedBy = actor`, `completedAt = now`, append one `complete` log row.
- `tasks.complete` on an already-**done** task → return the task **unchanged**; append
  **no** log row (FR-003, SC-006). The original `completedBy`/`completedAt` are preserved.
- `tasks.reopen` on a **done** task → set `status = open`, clear
  `completedBy`/`completedAt`, append one `reopen` log row. The prior completion stays in
  the log (FR-004).
- `tasks.reopen` on an already-**open** (or `snoozed`) task → return unchanged, no log row.

**Rationale**: mirrors 001's idempotent-create pattern (replay = success, not error), and is
the concurrency answer for the simultaneous-completion race (spec Edge Cases): writes
serialize under `withLock_` (Principle V), so the second completer reads `done` and takes
the no-change branch — one completion, one feed entry. The decision to write-or-not is made
**inside** the lock after reading current status, so the check and the write are atomic.

**Note on `both`**: no special casing — a single `complete` closes a `both` task exactly
like any other (FR-002). "Both" governs *ownership/visibility*, not how many completions are
required.

## D3 — Where the lifecycle write lives

**Decision**: Put `completeTask_`/`reopenTask_` as thin functions in `Api.js` next to
`createTask_`/`updateTask_`, delegating the actual row write + log to a new
`Sheets.js` helper `setTaskLifecycle_(id, patch, actor, logAction)` that runs inside
`withLock_`, reads current status, and either writes+logs or returns the unchanged record
with a `changed:false` flag. The handlers translate that into the response.

**Rationale**: keeps `Sheets.js` the sole owner of the lock + append (as today), keeps
`Api.js` handlers declarative. `updateRecordById_` can't be reused directly because it
always logs `update`; rather than parameterize it heavily, a small purpose-built helper is
the boring choice (Principle IV). Reusing `readTableForWrite_`/`findRecord_`/`writeRowAsText_`
means no new Sheet-access code.

**Alternative**: parameterize `updateRecordById_` with a log-action + a "skip write if
predicate" callback — rejected as cleverness that obscures the two very different call
sites (a field edit vs. a state transition).

## D4 — Identity-relative slices and the `default` view

**Decision**: `tasks.list` accepts an optional `filter`:

| `filter`  | Membership | Identity-relative? |
|-----------|------------|--------------------|
| omitted / `all` | every task | no |
| `mine`    | `owner === <caller>` | yes |
| `theirs`  | `owner === <the other person>` | yes |
| `ours`    | `owner === 'both'` | no |
| `default` | `owner ∈ { <caller>, 'both' }` (mine ∪ ours) | yes |

The person the slice is relative to is resolved **server-side** from the verified identity,
never from the payload (FR-009). For a personal account that is `identity.actor`
(`max`/`jaz`). For the **shared** account (no person; `actor === null`) an identity-relative
filter requires `payload.actingPerson ∈ {max, jaz}`, reusing 002's disambiguation shape;
absent it, respond `ACTING_PERSON_REQUIRED`. `all` and `ours` are not identity-relative and
work for any allowlisted caller with no acting-person.

Filtering is in-memory over the single `listRecords_(TABS.TASKS)` read (CLAUDE.md Sheets
rule). Slices return tasks in **all** statuses (open/done/snoozed) — 003 filters by owner
only; status/date smart-views are Phase 2 (spec Assumptions).

**Rationale**: keeps the wire simple (one param), satisfies FR-008/FR-009/FR-010, and makes
`both`-in-`ours`-only concrete (Clarifications 2026-07-08) so `mine`/`theirs`/`ours` are
provably disjoint and union to `all` (SC-002). Omitted-filter = `all` preserves 001's
`tasks.list` behavior, so nothing already built breaks.

**Alternatives**: a boolean `mineOnly` / multiple params (rejected — less legible, doesn't
name `default`); doing the union client-side (rejected — FR-010 requires server retrieval).

## D5 — Activity feed: bound, order, and composed summary

**Decision**: `activity.list` with optional `{ limit, since }`:
- **Order**: newest-first by **append order** (reverse the row order from `readTable_`), not
  by sorting on `timestamp`. Timestamps are minute-resolution (`nowIso_` →
  `yyyy-MM-dd'T'HH:mm`), so multiple entries share a minute; append order is the true,
  stable sequence and reversing it is O(n) with no tie ambiguity.
- **Bound**: `limit` caps the number returned (**default 200**, hard max 500); `since` (an
  ISO datetime) keeps only entries with `timestamp >= since`. Applied as: filter by `since`,
  take the most-recent `limit`. Requesting more than exists returns what exists; an empty
  log returns `[]` (FR-012, Edge Cases).
- **Shape per entry**: the raw columns (`timestamp, actor, action, targetId, detail`) **plus**
  a composed `summary` string. Summary = `<DisplayName> <verb> '<title>'` where DisplayName
  maps `max→Max`, `jaz→Jaz`, `system→System` (unknown/hand-edited actor rendered as-is,
  never crashes — Edge Cases); verb maps `create→added`, `update→edited`,
  `complete→completed`, `reopen→reopened`, `delete→deleted`, `adopt-id→assigned an id to`,
  `provision→set up`; the quoted title comes from `detail` (omitted if `detail` is empty).
  The client (feature 006) renders the "· today 2:14pm" relative time from `timestamp`.

**Default 200 rationale**: the household generates tens of entries/week (spec), so 200
comfortably covers several weeks — enough for "since I last looked" on at least weekly
checking (FR-012/SC-004) without an unbounded payload. `since` lets a frequent checker fetch
only new entries. 500 hard cap keeps any single response small.

**Read-only guarantee**: `activity.list` only reads; no action edits/deletes log rows
(FR-014, Principle VI). Composition happens at read time from stored fields — the target
record needn't still exist (FR-013).

**Rationale**: reversing append order + a lookup-table summary is the most boring thing that
satisfies FR-011/012/013; no new write-side data is needed (001 already stores the title in
`detail` at write time; complete/reopen from D1 supply the distinguishable action names).

**Alternatives**: sort by parsed timestamp (rejected — minute ties lose true order); return
raw rows and compose in the frontend (rejected — FR-011 says the *service* exposes the
readable summary); cursor pagination (rejected — over-engineered for a two-person log,
`limit`+`since` suffices, Principle I/IV).

## D6 — `activity.list` naming and response

**Decision**: action `activity.list`, returning `{ activity: [entry…] }`, matching 001's
`<namespace>.list` → `{ <namespace>: [...] }` convention (`events.list` → `{ events }`). It
is a read, so it needs a verified allowlisted caller (002) but no `actingPerson` and no
write lock.

**Rationale**: consistency with the existing action vocabulary; least surprise for the
feature-006 client.
