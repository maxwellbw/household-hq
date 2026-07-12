# Research — Feature 019: Task & Event Details + Collaboration

Decisions resolving the plan's open points. Each is Decision / Rationale / Alternatives.

## R1 — URL linkification rule and safe rendering

**Decision**: Linkify only substrings that begin with an explicit `http://` or `https://`
scheme. A pure `linkify(text)` returns an ordered array of segments — either
`{ type: 'text', value }` or `{ type: 'link', href }` — and a `<NotesText>` component maps
them to plain text nodes and `<a href target="_blank" rel="noreferrer noopener">`. Text is
always rendered as React children (never `dangerouslySetInnerHTML`), so notes can never
execute markup (FR-021). The match is a bounded regex
(`/\bhttps?:\/\/[^\s<]+/gi`) with trailing punctuation (`.,;:!?)`]}`) trimmed off the
matched URL so "see https://ex.com." doesn't capture the period.

**Rationale**: The clarify session chose `http(s)://`-only to avoid false positives
(emails, filenames, version strings, bare domains). Users paste full URLs for buy links,
reservations, and Google Maps, which always carry a scheme. Rendering via React children is
the boring, injection-proof default.

**Alternatives considered**: (a) Also linkify bare `www.`/domain strings — rejected at
clarify (false-positive risk). (b) A markdown library — rejected: a dependency for one
regex violates Principle IV; notes are plain text, not markdown.

## R2 — Acknowledgement data model

**Decision**: Two new server-managed Task columns: `ackBy` (`max`|`jaz`|empty) and `ackAt`
(ISO `YYYY-MM-DDTHH:mm`, household tz). A task is **acknowledged** iff `ackBy === owner`
(and `owner` is a single person). "Assigned to the other person" needs no new field: by the
two-person invariant, the assigner is simply `otherPerson_(owner)`. The new action
`tasks.acknowledge` (payload `{id}`) is valid only when the verified `actor === owner` and
`owner ∈ {max, jaz}`; it sets `ackBy = actor`, `ackAt = now`, logs `acknowledge`, and is an
idempotent no-change when already acknowledged (mirrors `setTaskLifecycle_`). `ackBy`/`ackAt`
are rejected on `tasks.create`/`tasks.update` (like `completedBy`/`completedAt`).

**Reset on reassignment**: acknowledgement is per current assignee (FR-011). In
`updateTask_`, when the payload changes `owner` to a different value, the patch also clears
`ackBy`/`ackAt` — the old assignee's commitment does not carry to the new one.

**Rationale**: Storing commitment on the task row keeps the Sheet the single source of truth
(Principle II) and hand-editable. Deriving the assigner from ownership honors "two users
forever" (Principle I) with zero extra schema. Idempotency matches Principle V and the
existing lifecycle helpers exactly.

**Alternatives considered**: (a) A separate `assignedBy` column so the assigner is explicit
— rejected: unnecessary for two people and adds a column that could contradict `owner`. (b)
A boolean `acknowledged` flag instead of `ackBy`/`ackAt` — rejected: `ackBy`/`ackAt` also
answer "who/when" for the feed and the notice, and let reassignment reset cleanly by owner
comparison. (c) An `un-acknowledge` action — out of scope (spec); reassignment/snooze/delete
already cover renegotiation.

## R3 — Who is notified, and the ntfy ping

**Decision**: On a real acknowledgement transition, ping the **assigner** =
`otherPerson_(owner)` on their private ntfy topic, reusing `postToNtfy_` +
`ntfyTopicFor_` + the `ntfyEnabled` gate (009). New helper `pingAcknowledge_(task)` builds
`"<Assignee> has it: <title>"` and logs an `ntfy-ping` ActivityLog row for every outcome
(sent/skipped/failed), exactly like `pingCompletion_`. It never throws and never affects the
acknowledgement it hangs off of.

**Rationale**: 009's plumbing is the "instant ping" the spec calls for; reuse over
reinvention (Principle IV). Recipient-by-non-owner is the two-person invariant again.

**Alternatives considered**: A dedicated notification service or web-push — deferred to 010
(PWA push); ntfy is the shipped, free channel today.

## R4 — Dismissible dashboard notice: where dismissal lives

**Decision**: The assigner's "X has it" notice is **derived**, not stored: on the dashboard,
for the resolved viewer `V`, show a notice for every task where `owner` is the single person
`P ≠ V`, `ackBy === P` (acknowledged), minus a per-device dismissed set. Dismissal keys are
`"<taskId>:<ackAt>"`, stored in `localStorage` (`lib/ackDismissals.ts`), so re-acknowledging
after a reassignment (new `ackAt`) surfaces a fresh notice. The notice persists across
reloads until dismissed and does **not** auto-clear on completion (per clarify).

**Rationale**: The durable, cross-device signal is the ntfy ping (R3). The dashboard notice
is a convenience surface; its dismissal is pure per-device UI state — exactly the category
018 already keeps in `localStorage` (the auto-sign-in hint), and keeping it out of the Sheet
avoids polluting household data with ephemeral "seen" flags (Principle II keeps the Sheet
meaningful). Deriving the notice from task fields means no new tab, no new read, and it
self-heals if a row is hand-edited.

**Alternatives considered**: (a) A Sheet column/tab of dismissals for cross-device sync —
rejected: adds non-household bookkeeping to the DB for marginal benefit (a notice re-showing
on a second device is minor, and the ping already fired). (b) No dismissal (notice until the
task is done) — rejected: clarify chose explicit dismiss-and-stay-dismissed.

## R5 — Event location → Google Calendar mapping

**Decision**: Add `location` to the Events schema and set it on the mirrored calendar event
inside the existing reconciler `syncCalendarForEvent_`: on the update-in-place branch call
`existing.setLocation(event.location || '')`, and on the create branch call
`created.setLocation(event.location || '')` before storing the pointer. Passing `''` clears
it, so a location that is later removed re-syncs to an empty calendar location (FR-019). No
new scope — the broad `calendar` scope from 007 already covers `setLocation`. Task mirrors
get no location (tasks have none).

**Rationale**: The reconciler already updates title/time/color in place idempotently on
every create/update and nightly sweep; location is one more field on the same path, so it
inherits idempotency and the best-effort mirror wrapper for free (Principle V/IV).

**Alternatives considered**: Also mirroring event `notes` into the calendar event's
description — out of scope (backlog item (d) specifies location only); left app-only to keep
the change minimal.

## R6 — Schema migration for the four new columns

**Decision**: Add `notes`, `ackBy`, `ackAt` to `HEADERS.Tasks` and `location` to
`HEADERS.Events` in `Config.js`. The live Sheet gains the physical columns by running the
existing idempotent `setupDatabase()` from the Apps Script editor after `clasp push`
(`migrateHeaders_` appends any header named in `HEADERS[tab]` but missing from row 1, after
the last existing column, plain-text formatted, without touching existing columns or data).
Existing rows read the new cells as `''`. `notes`/`location` are free text (no `FIELD_TYPES`
entry); `ackBy`/`ackAt` are server-written so they need no write-validation type, though a
read warning could be added later.

**Rationale**: This is the same migration path 005 used to land `Events.prepGeneratedFor`;
it is proven, idempotent, and non-destructive (Principle II). Because `buildHeaderMap_`
fails loudly (`SCHEMA_MISMATCH`) when a `HEADERS` name is absent from the Sheet, the
migration MUST run before the new backend is exercised — called out as quickstart Scenario A
and in the deploy step.

**Alternatives considered**: An automatic migration on first request — rejected: the
existing convention is an explicit editor-run `setupDatabase()`, keeping provisioning a
deliberate, logged act rather than a hidden side effect of a user request.
