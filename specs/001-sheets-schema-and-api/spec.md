# Feature Specification: Sheets Schema and API

**Feature Branch**: `001-sheets-schema-and-api`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Feature 001 sheets-schema-and-api — the foundational data layer and JSON API for Household HQ, from brief §4–5. Establish the Google Sheet database schema (tabs as tables: Events, Tasks, TaskTemplates, Recurring, ActivityLog, Settings) and the Apps Script web-app API surface that the frontend and later features will consume. The Sheet must stay human-readable and hand-editable; IDs are UUIDs, never row positions; the UI only ever renders Events and Tasks (triggers do all generation). Includes the request/response envelope, error handling, and the CORS-safe transport decision. Auth allowlist enforcement is feature 002, but the API shape should leave room for the ID-token check."

## Clarifications

### Session 2026-07-07

- Q: Should v1's Recurring schema support seasonal recurrence windows (e.g., "mow lawn:
  weekly, April–October only")? → A: Full support in v1 — the schema includes an
  optional season window and this spec documents its semantics; feature 004 implements
  the generation behavior.
- Q: Does one person completing a `both` task close it? → A: Yes — one completion
  closes it; the schema keeps a single completedBy/completedAt pair and the activity
  log shows who.
- Q: What happens to a hand-added row with a blank ID? → A: The service auto-assigns a
  unique ID the next time it touches that table and logs the assignment.
- Q: What does deleting an event or task do? → A: Hard delete — the row is removed;
  the ActivityLog entry is the permanent record of the deletion.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Transparent household database exists (Priority: P1)

Max and Jaz have a single shared database holding all household data — events, tasks,
prep-checklist templates, recurrence rules, an activity feed, and configuration — that
either of them can open directly, read without documentation, and fix by hand if
something ever looks wrong.

**Why this priority**: Every later feature reads and writes this structure. It is also
the household's disaster-recovery story: if the app is down, the data is still a legible
spreadsheet.

**Independent Test**: Open the database with no app running; confirm each table exists
with labeled columns, and that a person unfamiliar with the code can correctly interpret
any row in under a minute.

**Acceptance Scenarios**:

1. **Given** a freshly provisioned database, **When** either user opens it, **Then** they
   see six tables — Events, Tasks, TaskTemplates, Recurring, ActivityLog, Settings — each
   with a single header row of human-readable column names.
2. **Given** any populated row, **When** a user reads it, **Then** every value is plain
   text, a human-readable date, or a simple delimited list — no opaque encoded blobs.
3. **Given** the Settings table, **When** a user opens it, **Then** they can see and edit
   the household configuration (allowed emails, timezone, and placeholders for later
   features) as labeled key–value entries.

---

### User Story 2 - The app can read and write Events and Tasks (Priority: P1)

The Household HQ app (and every later feature) can list, create, update, and delete
events and tasks through one stable service interface, with predictable responses and
predictable errors.

**Why this priority**: This is the contract the frontend and all future features build
against; without it nothing else can be developed or tested.

**Independent Test**: Using only the service interface (no direct spreadsheet access),
create an event and a task, list them back, update them, delete them, and observe every
response following the same envelope.

**Acceptance Scenarios**:

1. **Given** an empty Events table, **When** a client creates an event with title, start,
   end, and owner, **Then** the service returns the created event including its
   newly assigned unique ID, and the row appears in the database.
2. **Given** existing events and tasks, **When** a client requests a listing, **Then**
   it receives all rows as structured records whose field names match the documented
   schema.
3. **Given** a client sends an update for an existing task's ID, **When** the service
   processes it, **Then** only that record changes, identified by its ID regardless of
   its row position.
4. **Given** a client references a nonexistent ID, **When** it attempts update or
   delete, **Then** the service responds with a structured error naming the problem
   (not a crash, not silence).
5. **Given** any request, malformed or valid, **When** the service responds, **Then**
   the response uses one consistent envelope distinguishing success from failure.

---

### User Story 3 - Hand edits don't break the app (Priority: P2)

Either user can edit the database directly — fix a typo, delete a stale row, add a row by
hand, sort a table — and the app keeps working correctly afterwards.

**Why this priority**: Hand-editability is a constitutional guarantee (Principle II).
It's what makes the transparent database a real safety net rather than a look-don't-touch
artifact.

**Independent Test**: Manually reorder rows, edit a title in place, and append a
hand-written row; then confirm the service still reads, updates, and deletes the right
records by ID.

**Acceptance Scenarios**:

1. **Given** a table sorted by hand into a new row order, **When** the service updates a
   record by ID, **Then** the correct record changes.
2. **Given** a row appended by hand with a blank ID, **When** the service next touches
   that table, **Then** it assigns the row a proper unique ID and logs the assignment —
   never silently corrupted, skipped, or duplicated.
3. **Given** a cell edited to an invalid value (e.g., unparseable date), **When** the
   service reads the table, **Then** it degrades gracefully: the bad row is flagged or
   skipped with a logged explanation, and all other rows still work.

---

### User Story 4 - Every change is visible in the activity feed (Priority: P2)

Whenever anything is created, changed, completed, or deleted through the service, a
record of who did what, and when, is appended to the activity log.

**Why this priority**: Completion awareness ("Jaz already did that") is a core product
promise and a constitutional requirement (Principle VI), and it must hold from the very
first write.

**Independent Test**: Perform one create, one update, and one delete through the
service; confirm the activity log gained exactly three rows with timestamp, actor,
action, and target ID.

**Acceptance Scenarios**:

1. **Given** any successful state-changing request, **When** it completes, **Then**
   exactly one activity row is appended recording timestamp, actor, action, and the
   affected record's ID.
2. **Given** a failed request, **When** it is rejected, **Then** no state changes and no
   activity row is written (the log records what happened, not what was attempted).

---

### Edge Cases

- Two requests write to the same table at nearly the same moment (Max and Jaz both on
  their phones): both writes must land; neither is lost or interleaved into a corrupt
  row.
- A request or scheduled job is re-run after a timeout or retry: re-processing must not
  create duplicate rows (idempotency, Principle V).
- A table is empty (only a header row): listings return an empty collection, not an
  error.
- A hand-deleted header column or renamed header: the service must fail loudly and
  descriptively, not misread columns positionally.
- Very large text in a notes field: stored and returned intact.
- The database is temporarily unreachable or the service exceeds its execution window:
  the client receives a structured error it can distinguish from "empty result."
- A record's `owner` value is hand-edited to something other than the three allowed
  values: the service surfaces it as-is on read but rejects it on write.
- A recurring rule's season window is nonsensical (seasonStart after seasonEnd is valid
  — it wraps the year end, e.g., November–February; a month outside 1–12 is not):
  invalid months are rejected on write and flagged on read.

## Requirements *(mandatory)*

### Functional Requirements

**Schema**

- **FR-001**: The database MUST contain exactly six tables: Events, Tasks,
  TaskTemplates, Recurring, ActivityLog, Settings — each a tab with one header row of
  stable, human-readable column names.
- **FR-002**: Events MUST carry: id, title, start, end, owner (`max`/`jaz`/`both`),
  type, optional template reference, notes, and an optional external-calendar reference
  (reserved for feature 007).
- **FR-003**: Tasks MUST carry: id, title, dueDate, owner, status
  (`open`/`done`/`snoozed`), optional event reference, optional recurrence reference,
  completedBy, completedAt, snooze history, and optional list items (reserved for
  later phases: brief §5 items 11 and 18).
- **FR-004**: TaskTemplates MUST carry: id, eventType, taskTitle, offsetDays (may be
  negative, e.g., −2 = two days before), defaultOwner.
- **FR-005**: Recurring MUST carry: id, title, cadence
  (`weekly`/`biweekly`/`monthly`/`quarterly`/`annually`), anchorDate, defaultOwner,
  lastGenerated, and an optional season window (seasonStart month, seasonEnd month).
  When a season window is set, instances fall only within that window each year (e.g.,
  seasonStart=4, seasonEnd=10 → April through October, inclusive); a blank window means
  year-round. Generation behavior is implemented by feature 004; this feature delivers
  the fields and their meaning.
- **FR-006**: ActivityLog MUST carry: timestamp, actor, action, targetId, detail; it is
  append-only — application code never edits or deletes its rows.
- **FR-007**: Settings MUST hold labeled key–value configuration including the two
  allowlisted emails and the household timezone, with room for later features' keys
  (calendar id, digest schedule, notification topics, location, weather thresholds).
- **FR-008**: Every record ID MUST be a generated universally unique identifier; row
  position MUST never be used as an identifier or reference.
- **FR-009**: All date and time values MUST be stored as ISO 8601 strings interpreted in
  the single household timezone configured in Settings (default America/Los_Angeles).
- **FR-010**: All stored values MUST remain human-readable and hand-editable: plain
  text, ISO dates, or simple delimited lists — no serialized blobs (constitutional
  Principle II).

**Service interface**

- **FR-011**: The service MUST expose list, create, update, and delete operations for
  Events and Tasks, and list operations for TaskTemplates, Recurring, and Settings.
  (Write operations for the supporting tables may be hand-edits in the Sheet for now;
  later features add their own operations.) Deletes are hard deletes — the row is
  removed from the table; the ActivityLog entry (which captures the deleted record's
  ID and title) is the permanent record.
- **FR-012**: Every response MUST use a single consistent envelope that distinguishes
  success (with data) from failure (with a machine-readable error code and a
  human-readable message).
- **FR-013**: Error responses MUST cover at minimum: unknown operation, malformed
  request, validation failure (with the offending field), and record-not-found.
- **FR-014**: Writes MUST validate owner values (`max`/`jaz`/`both`), status values,
  cadence values, and date parseability before touching the database; invalid writes
  are rejected whole.
- **FR-015**: The transport mechanism MUST work from the app's web origin without
  browser preflight failures, and the decision MUST be recorded in this feature's plan
  as the one transport used by all future features (decide once, per CLAUDE.md).
- **FR-016**: Every request envelope MUST reserve a slot for a caller identity token,
  and every state-changing operation MUST record an actor; full token verification and
  allowlist rejection are delivered by feature 002 without changing the envelope shape.

**Integrity**

- **FR-017**: All state-changing operations MUST be idempotent from the caller's
  perspective where retries are possible: clients may supply their own new-record IDs so
  a retried create does not duplicate (constitutional Principle V).
- **FR-018**: Concurrent writes MUST be serialized so simultaneous requests from both
  users never lose or corrupt data.
- **FR-019**: Every successful state change MUST append exactly one ActivityLog row
  (timestamp, actor, action, targetId); failed operations append none.
- **FR-020**: Reads of a table MUST tolerate hand-edits: reordered rows, extra
  whitespace, and rows with invalid cells degrade gracefully (bad rows reported, good
  rows served); a missing or renamed header column MUST produce a loud, descriptive
  failure rather than positional misreads.
- **FR-021**: A one-time provisioning routine MUST create all six tables with headers
  (and re-running it MUST be harmless — it never wipes or duplicates existing data).
- **FR-022**: When the service encounters a hand-added row whose ID cell is blank, it
  MUST assign the row a generated unique ID and append an ActivityLog entry recording
  the assignment; the row is then a first-class record.

### Key Entities

- **Event**: A calendar item (trip, visit, concert, appointment) with a time span and an
  owner; may reference the template that spawns its prep tasks and, later, its mirrored
  external-calendar entry.
- **Task**: Any actionable item with a due date, an owner, and a lifecycle
  (open → done/snoozed); may tether to an Event (prep task) or a Recurring rule (chore
  instance); records who completed it and when.
- **TaskTemplate**: A reusable prep-checklist line for an event type ("guests visiting" →
  "clean house" at offset −2), used by generation, never rendered directly.
- **Recurring**: A recurrence rule for a chore (cadence + anchor date + default owner,
  optionally bounded to a yearly season window like April–October) plus a high-water
  mark of how far ahead instances have been generated.
- **ActivityLog entry**: An immutable record of one state change: when, who, what
  action, which record.
- **Settings**: The household's labeled configuration values; the only place identity
  (allowlisted emails) and timezone live.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person who has never seen the codebase can open the database and
  correctly explain any row of any table in under one minute, using only the header
  names.
- **SC-002**: 100% of service responses — success and failure, across every operation —
  follow the single documented envelope.
- **SC-003**: A full create → list → update → delete round-trip through the service
  completes in under 5 seconds per operation under normal conditions.
- **SC-004**: After hand-sorting any table and hand-editing one cell to garbage, every
  service operation on the untouched rows still succeeds (zero collateral failures).
- **SC-005**: Replaying any state-changing request produces zero duplicate rows.
- **SC-006**: 100% of successful state changes appear in the activity log with actor,
  action, target, and timestamp; failed requests appear zero times.
- **SC-007**: Two simultaneous writes from different users both land correctly in 100%
  of attempts (no lost updates, no corrupt rows).

## Assumptions

- The two-email allowlist and household timezone are seeded by hand into Settings during
  provisioning; no admin UI is in scope.
- Caller identity is taken on trust in this feature (the envelope carries it, the
  service records it); enforcement is feature 002. The database is private to the two
  users' accounts in the meantime, so trust-on-declaration is an acceptable interim
  posture.
- Write operations for TaskTemplates, Recurring, and Settings are out of scope; those
  tables are hand-maintained until the features that own them (004, 005) add
  operations.
- "Snooze history" and "list items" fields exist in the schema now (so later features
  need no migration) but no behavior around them ships in this feature.
- One completion closes a `both` task (clarified 2026-07-07); the schema records a
  single completedBy/completedAt pair. Behavior details land in feature 003.
- The service targets exactly two known clients (Max's and Jaz's devices); expected load
  is tens of requests per day, so generous per-request latency is acceptable and no
  pagination is needed.
