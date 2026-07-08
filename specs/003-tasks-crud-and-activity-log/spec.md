# Feature Specification: Tasks CRUD and Activity Log

**Feature Branch**: `003-tasks-crud-and-activity-log`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Feature 003 tasks-crud-and-activity-log — the complete task-management experience and the household activity feed, from brief §5 items 2 and 7. Create, edit, complete, reopen, and delete tasks; assign owner max/jaz/both; set/clear due dates; filter by mine / theirs / ours / all. Completing records who and when; one completion closes a `both` task. Completion awareness: one person's completion surfaces in the other's activity feed — adds reading the ActivityLog through the API with a human-meaningful feed. Builds on 001's API and 002's verified identity; raw CRUD endpoints exist from 001 — this feature specifies full behavioral semantics and the feed. UI ships with feature 006."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run my task list end to end (Priority: P1)

Max or Jaz can capture anything the household needs done — with a title, an owner
(max/jaz/both), and optionally a due date — then change any of it, mark it done, change
their mind and reopen it, or delete it outright. Done is never ambiguous: the task
remembers who completed it and when.

**Why this priority**: This is the product's atomic unit of value. Reducing the mental
load of remembering only works if capturing and closing a task is effortless and
trustworthy.

**Independent Test**: Through the service interface, walk one task through its whole
life — create with owner `both` and a due date, retitle it, move the due date, clear
the due date, complete it, reopen it, complete it again, delete it — verifying state,
attribution, and log entries at each step.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they create a task with title and owner,
   **Then** the task exists as `open`, with due date optional (an undated task is
   valid).
2. **Given** an open task, **When** any user completes it, **Then** its status becomes
   `done` and it permanently records who completed it and when — for a `both` task,
   one person's completion closes it for the household (001 clarification).
3. **Given** a done task, **When** a user reopens it, **Then** it returns to `open`
   and the previous completion attribution is cleared from the task (the activity log
   still remembers the full history).
4. **Given** a done task, **When** a user tries to complete it again, **Then** the
   operation succeeds as a no-change: the original completer and time are preserved,
   and no duplicate feed entry appears.
5. **Given** any task, **When** a user edits title, owner, or due date (set, move, or
   clear), **Then** only those fields change and the edit is attributed to the editor.
6. **Given** any task, **When** a user deletes it, **Then** it is gone from every
   view, and the feed entry preserves its title so the household can still see what
   was deleted.

---

### User Story 2 - See mine, theirs, ours, or everything (Priority: P1)

Each user can slice the task list four ways — **mine** (assigned to me alone),
**theirs** (assigned to my partner alone), **ours** (assigned to both), and **all** —
and the app's default working view is "my stuff + our stuff" (mine ∪ ours).

**Why this priority**: "Whose job is this?" is the question the product exists to
answer. The filters are how the owner model becomes a daily tool instead of a data
field.

**Independent Test**: Seed tasks owned `max`, `jaz`, and `both`; request each filter as
each user and verify exact membership of every slice, including that `both` tasks
appear in "ours" (and in the default view) but never in "mine" or "theirs."

**Acceptance Scenarios**:

1. **Given** tasks owned `max`, `jaz`, and `both`, **When** Jaz requests **mine**,
   **Then** she receives exactly the `jaz`-owned tasks.
2. **Given** the same tasks, **When** Jaz requests **theirs**, **Then** she receives
   exactly the `max`-owned tasks.
3. **Given** the same tasks, **When** either user requests **ours**, **Then** they
   receive exactly the `both`-owned tasks.
4. **Given** the same tasks, **When** either user requests **all**, **Then** every
   task is returned, and the three named slices are disjoint and together equal
   **all**.
5. **Given** the filters are identity-relative, **When** Max and Jaz each request
   **mine**, **Then** they receive different sets — the slice follows the verified
   caller, not a parameter the client could fake.

---

### User Story 3 - Know what my partner did without asking (Priority: P2)

Either user can open a household activity feed — newest first, in plain language
("Jaz completed 'Buy flea meds' · today 2:14pm") — and immediately see what has
happened since they last looked, most importantly the things their partner completed,
added, changed, or deleted.

**Why this priority**: Completion awareness is the emotional core of the product (the
end of "did you ever…?" check-ins), but it needs Stories 1–2 to exist before there is
anything to feed.

**Independent Test**: As Max, complete one task, edit another, delete a third; as Jaz,
fetch the feed and verify the three entries appear newest-first with readable
summaries naming Max, the action, and each task's title — including the deleted one.

**Acceptance Scenarios**:

1. **Given** recent household changes, **When** a user requests the feed, **Then**
   entries arrive newest-first, each with who, what happened, which item (by title),
   and when.
2. **Given** a task that was deleted, **When** its feed entries are viewed, **Then**
   they still read meaningfully (the title was captured at log time) even though the
   task no longer exists.
3. **Given** months of history, **When** a user requests the feed, **Then** they
   receive a bounded most-recent slice (not the entire history), sufficient to cover
   "since I last looked" for a household checking at least weekly.
4. **Given** system-generated entries exist (provisioning, future scheduled
   generation), **When** the feed is viewed, **Then** they are present and clearly
   attributed to the system rather than to a person.

---

### Edge Cases

- A task's status was hand-edited in the Sheet to `snoozed` (the value exists in the
  schema; snooze *behavior* is a later Phase 2 feature, brief §5 item 11): it appears
  in its owner's slices with its
  status shown honestly; completing it works normally; nothing in 003 creates or
  interprets snoozes further.
- Both users complete the same task near-simultaneously: exactly one completion wins
  (writes are serialized per 001); the second returns the already-done no-change
  result; the feed shows one completion.
- A task is edited and completed in quick succession by different people: both changes
  land (serialized), both appear in the feed, attribution correct on each.
- The feed is requested when the log is empty (fresh household): an empty feed, not an
  error.
- A feed entry's actor is an email/identity no longer meaningful (shouldn't happen
  with two users forever, but hand-edits exist): rendered as-is, never crashes the
  feed.
- Reopen of a task completed by the *other* person: allowed — either user may reopen
  anything; the feed makes the reversal visible to both.
- A due date in the past at creation time: valid (capturing an overdue reality is
  normal); no validation rejects it.

## Requirements *(mandatory)*

### Functional Requirements

**Task lifecycle semantics** (tightening 001's raw operations)

- **FR-001**: Task creation MUST require a non-empty title and a valid owner
  (`max`/`jaz`/`both`); due date is optional and, when present, must be a valid date
  (past dates allowed). New tasks always start `open`; there is no way to create a
  task in any other status.
- **FR-002**: Completing a task MUST set status `done` and stamp the completer's
  verified identity and the completion time; for `both`-owned tasks a single
  completion closes the task.
- **FR-003**: Completing an already-`done` task MUST succeed as a no-change: original
  completedBy/completedAt preserved, no new activity entry.
- **FR-004**: Reopening a `done` task MUST set status `open` and clear
  completedBy/completedAt on the task; the prior completion remains visible in the
  activity history. Either user may reopen any task regardless of who completed it.
- **FR-005**: Edits MUST be partial (only supplied fields change) and support setting,
  moving, and *clearing* the due date; owner reassignment among the three values is a
  normal edit.
- **FR-006**: Deletion MUST remove the task from all views permanently (hard delete
  per 001), with the activity entry preserving the task's title.
- **FR-007**: Tasks whose status is `snoozed` (hand-edited or set by later features)
  MUST be listed and completable like open tasks; no operation in this feature sets
  status to `snoozed`.

**Filters**

- **FR-008**: The service MUST provide the four named task slices relative to the
  verified caller: **mine** = owner is exactly the caller; **theirs** = owner is
  exactly the other user; **ours** = owner is `both`; **all** = every task. Mine,
  theirs, and ours are disjoint and their union is all.
- **FR-009**: Slice membership MUST derive from the caller's verified identity, never
  from a client-supplied "who am I" parameter.
- **FR-010**: The documented default view for the future UI is **mine ∪ ours** ("my
  stuff + our stuff", brief §2); this feature MUST make that combination retrievable
  without the client stitching two requests.

**Activity feed**

- **FR-011**: The service MUST expose the activity history for reading: newest-first
  entries each carrying when, who (person or system), what action, which record, and a
  human-readable summary including the affected item's title as captured at log time.
- **FR-012**: Feed reads MUST return a bounded most-recent slice with a way to state
  the bound (a count and/or a since-time); requesting more than exists returns what
  exists; an empty log returns an empty feed.
- **FR-013**: Feed entries MUST remain renderable when their target record has been
  deleted or hand-edited; the feed never depends on the target still existing.
- **FR-014**: The feed is read-only through the service — no operation may edit or
  delete history (constitution Principle VI; ActivityLog is append-only).
- **FR-015**: Every lifecycle operation in this feature (create, edit, complete,
  reopen, delete) MUST produce exactly one activity entry attributed to the verified
  actor, with distinguishable action names for complete and reopen (they are not
  generic "update"s in the feed).

### Key Entities

- **Task** (existing, from 001): gains no new fields; this feature pins down its
  lifecycle — `open ⇄ done` via complete/reopen, `snoozed` tolerated passively —
  and its attribution rules.
- **Activity feed entry**: the read-side projection of an ActivityLog row — when, who,
  action, target, readable summary. History is immutable; the feed is a windowed,
  newest-first view of it.
- **Task slice**: a named, identity-relative view (mine/theirs/ours/all, plus the
  default mine ∪ ours) — a query concept, not stored data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can capture a new task (title + owner) in a single request and
  under 5 seconds end to end.
- **SC-002**: For any set of tasks, mine/theirs/ours are pairwise disjoint and union
  to all, verified per user — zero misfiled tasks across 100% of slice requests.
- **SC-003**: 100% of completions record the correct verified completer and a
  timestamp; zero completions attributed to the wrong person in testing, including
  the simultaneous-completion race.
- **SC-004**: After one user performs N changes, the other user's next feed request
  reflects all N — nothing missing, nothing duplicated, newest first — with each entry
  readable without opening the underlying task (who + action + title + when).
- **SC-005**: Feed entries for deleted tasks remain fully readable in 100% of cases.
- **SC-006**: Every lifecycle operation appears in the feed exactly once; re-completing
  a done task adds zero entries.

## Assumptions

- Features 001 (schema/API/envelope) and 002 (verified identity, canonical `max`/`jaz`
  actors, who-am-I) are implemented first; this feature adds no new authentication or
  schema columns.
- The four slices and the feed are service capabilities consumed by the feature 006
  UI; no screens ship in this feature. "Default view" is delivered as a documented,
  directly retrievable slice, not a UI behavior.
- Snooze/defer behavior (visible history, guilt-free rescheduling) is a later Phase 2
  feature (brief §5 item 11); 003 only tolerates the `snoozed` status value passively.
- Feed summaries are composed at read time from the log's stored fields (001 already
  stores titles in the detail column at write time); no new write-side data is
  required beyond distinguishable action names for complete/reopen (FR-015).
- The feed's default bound can be generous (the household generates tens of entries a
  week); precise default size is a plan-level choice.
- Filtering by status or due-date range (Today/Overdue smart views) is a later Phase 2
  feature (brief §5 item 13); slices in this feature filter by owner only.
