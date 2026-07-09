# Feature Specification: Google Calendar Sync (gcal-sync)

**Feature Branch**: `007-gcal-sync`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Google Calendar sync: one-way push of Household HQ's own Events and dated Tasks OUT to the shared 'Household' Google Calendar so Max and Jaz get free native phone notifications from day one. Explicitly out of scope: reading work calendars, ICS, dog-walk finder, weather, auto-invite (all feature 011)."

## Clarifications

### Session 2026-07-09

- Q: When should app changes reach the Household calendar? → A: **Immediate + scheduled reconcile** — mirror on each app create/edit/delete right away, plus a periodic scheduled reconcile as a self-healing backstop.
- Q: Should mirrored entries carry reminders so phones actually buzz? → A: **Set sensible default reminders** — timed events get a popup ~30 min before; all-day task entries get a morning-of popup (~9am on the due date).
- Q: How far out should the sync mirror events/tasks? → A: **Today forward, all future** — mirror everything dated today or later, no far-horizon cap, plus a small recent-past grace; do not back-fill deep history.
- Q: How should an entry show its owner (Max / Jaz / Both)? → A: **Title prefix + per-owner color** — an owner label prefix (`[Max]`/`[Jaz]`/`[Both]`) plus a per-owner calendar color, consistent with the app's owner color coding.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Events appear on our phones as calendar notifications (Priority: P1)

Max adds an event in Household HQ (e.g. "Vet appointment, Thu 4pm, owner: Jaz"). Without doing anything else, that event shows up on the shared "Household" Google Calendar, so both Max's and Jaz's phones — which already subscribe to that calendar — surface it in their native calendar apps and fire the usual calendar notifications/reminders. When Max later edits the time or deletes the event in the app, the Google Calendar copy updates or disappears to match. No duplicate copies ever accumulate.

**Why this priority**: This is the whole point of the feature and the brief's stated payoff ("free native phone notifications from day one"). Mirroring events alone is a complete, shippable slice of value — the household stops missing appointments — even if dated tasks are never mirrored.

**Independent Test**: Create, edit, and delete an event in the app; after each action confirm the shared Household calendar shows exactly one matching entry (or none, after delete) with the correct title, time, and owner treatment, and that re-running the sync does not create a second copy.

**Acceptance Scenarios**:

1. **Given** an event exists in the app with no calendar copy yet, **When** the sync runs, **Then** a single Google Calendar event is created on the Household calendar with matching title, start, end, and owner treatment, and the app records the created calendar event's identity against that event so it is not re-created.
2. **Given** an event that already has a calendar copy, **When** its title/start/end/owner is changed in the app and sync runs, **Then** the same Google Calendar event is updated in place (not duplicated).
3. **Given** an event that already has a calendar copy, **When** the event is deleted in the app and sync runs, **Then** the corresponding Google Calendar event is removed.
4. **Given** the sync has already run once, **When** it runs again with no app-side changes, **Then** no calendar events are created, changed, or deleted (no-op) and no duplicates appear.
5. **Given** an all-day / timed event, **When** it is mirrored, **Then** its times reflect the single household timezone from Settings.

---

### User Story 2 - Dated tasks show up on the calendar too (Priority: P2)

Jaz adds a task with a due date ("Renew dog license, due Jul 20, owner: Both"). Because it has a due date, it also appears on the shared Household calendar as an all-day entry on that date, so it gets the same native reminders. When the task is completed, deleted, or its due date changes (including via snooze/reschedule), its calendar entry is removed or moved to match. Tasks with no due date never appear on the calendar.

**Why this priority**: Extends the notification benefit to the task side of the app, but it is additive — Story 1 already delivers the core value. Depends on the same mirroring machinery, so it ships second.

**Independent Test**: Create a dated task, a task with no due date, and confirm only the dated one appears as an all-day calendar entry; complete it and confirm the entry disappears; change another dated task's due date and confirm its entry moves, with no duplicates after re-sync.

**Acceptance Scenarios**:

1. **Given** an open task with a due date and no calendar copy, **When** sync runs, **Then** a single all-day Google Calendar entry is created on the due date with matching title and owner treatment, and the app records the calendar entry's identity against that task.
2. **Given** a task with no due date, **When** sync runs, **Then** no calendar entry is created for it.
3. **Given** a dated task with a calendar copy, **When** the task is completed and sync runs, **Then** its calendar entry is removed.
4. **Given** a dated task with a calendar copy, **When** the task's due date changes and sync runs, **Then** the same calendar entry moves to the new date (not duplicated).
5. **Given** a dated task with a calendar copy, **When** the task is deleted and sync runs, **Then** its calendar entry is removed.

---

### User Story 3 - Sync heals itself on a schedule (Priority: P3)

Neither user has to trigger anything. A scheduled job periodically reconciles the app's data (the Sheet) against the Household calendar: anything that should exist but doesn't gets created, anything stale gets updated, anything the app deleted gets removed. If a single sync run fails partway (network hiccup, execution-time limit), the next run picks up cleanly with no duplicates and no lost updates. Every create/update/delete the sync performs is written to the activity log.

**Why this priority**: Makes the feature trustworthy and hands-off, but Stories 1 and 2 already work when triggered on each change; the scheduled reconcile is the reliability backstop rather than the core capability.

**Independent Test**: Delete a calendar copy by hand in Google Calendar, then run the reconcile; confirm the missing entry is re-created. Manually corrupt one mirrored entry's title in Google Calendar, run reconcile, confirm it is corrected. Inspect the activity log and confirm each sync action is recorded.

**Acceptance Scenarios**:

1. **Given** an app event whose calendar copy was deleted or edited directly in Google Calendar, **When** the scheduled reconcile runs, **Then** the calendar is brought back into agreement with the app (re-created or corrected), because the app is the authoritative source for the entries it manages.
2. **Given** a sync run that fails partway through, **When** the next run executes, **Then** it completes the remaining work without creating duplicates or dropping updates (the operation is safe to re-run).
3. **Given** any create/update/delete the sync performs, **When** it completes that action, **Then** a corresponding entry is appended to the activity log (timestamp, actor, action, target).
4. **Given** two writes could touch the same data at once (e.g. a user edit while the reconcile runs), **When** they overlap, **Then** they are serialized so neither corrupts the calendar mapping.

### Edge Cases

- **Household calendar not configured**: If the Settings `householdCalendarId` is blank, sync does nothing and reports/logs that it is unconfigured rather than erroring or picking a random calendar.
- **Manually-created Household calendar events**: Entries on the Household calendar that Household HQ did not create (e.g. someone adds a birthday directly) are left untouched — the sync only manages entries it owns.
- **Stale mapping / already-deleted calendar event**: If the app thinks an event has a calendar copy but that copy no longer exists in Google Calendar, the sync treats it as "needs re-create" (or "already gone" on a delete) without crashing.
- **Snoozed dated task**: A snoozed task keeps its calendar entry at its (possibly new) due date; a snooze that clears the due date removes the entry. (See Assumptions.)
- **Task loses its due date** (edited to undated): its existing calendar entry is removed.
- **Owner changed** (e.g. `max` → `both`): the existing calendar entry is updated in place to the new owner treatment, not duplicated.
- **Timezone**: All start/end/due values are interpreted and written in the single household timezone from Settings, matching the rest of the app.
- **Execution-time limit**: A run that cannot finish within the platform's per-run execution budget makes forward progress and leaves remaining work for the next run, never leaving duplicates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST mirror each app Event to a single corresponding entry on the shared Household Google Calendar identified by the Settings `householdCalendarId`, matching title, start, end, and owner treatment.
- **FR-002**: The system MUST persist the identity of each created Google Calendar entry back onto its source app record (Events already carries a `gcalEventId` column; dated Tasks require an equivalent stored mapping) so that subsequent updates and deletes target the same calendar entry and never create a second copy.
- **FR-003**: When an app Event is updated, the system MUST update the same existing Google Calendar entry in place rather than creating a new one.
- **FR-004**: When an app Event is deleted, the system MUST remove its corresponding Google Calendar entry.
- **FR-005**: The system MUST mirror each Task that has a due date as an all-day entry on the Household calendar on that due date; Tasks with no due date MUST NOT produce a calendar entry.
- **FR-006**: When a dated Task is completed or deleted, the system MUST remove its corresponding calendar entry; when its due date changes, the system MUST move the same entry to the new date without duplicating it.
- **FR-007**: The system MUST reflect the owner (`max` / `jaz` / `both`) on each mirrored calendar entry using **both** an owner label prefix in the title (`[Max]` / `[Jaz]` / `[Both]`) **and** a per-owner calendar color, consistent with the app's owner color coding.
- **FR-007a**: Mirrored entries MUST carry default reminders so both phones notify: a timed event gets a popup reminder a set interval before start (default ~30 minutes); an all-day task entry gets a morning-of popup on the due date (default ~9am household time). The exact intervals are configurable defaults, not hard-coded magic.
- **FR-008**: The system MUST interpret and write all dates/times using the single household timezone from Settings.
- **FR-009**: The sync MUST be idempotent — re-running it with no app-side changes creates, updates, and deletes nothing, and never produces duplicate calendar entries.
- **FR-010**: The system MUST mirror an app change to the Household calendar **immediately at write time** (on each Event/Task create, update, complete, and delete) **and** MUST additionally run a **scheduled reconcile** that brings the Household calendar into agreement with the app data (creating missing entries, correcting drifted ones, removing entries for records the app deleted) as a self-healing backstop, treating the app as the authoritative source for the entries it manages. An immediate-mirror failure MUST NOT block the originating app write — the reconcile will catch it up.
- **FR-010a**: The mirror MUST cover every Event whose end is today or later and every dated Task whose due date is today or later (all future, no far-horizon cap), plus a small recent-past grace; it MUST NOT back-fill deep historical records. Entries already created are left in place as they age into the past.
- **FR-011**: The sync MUST serialize writes that could otherwise overlap (e.g. a scheduled reconcile concurrent with a user edit) so the calendar mapping cannot be corrupted.
- **FR-012**: The system MUST append an activity-log entry (timestamp, actor, action, target) for every calendar entry it creates, updates, or deletes.
- **FR-013**: The system MUST leave Household-calendar entries it did not create untouched.
- **FR-014**: When `householdCalendarId` is unset, the system MUST safely no-op (perform no calendar writes) and make the unconfigured state observable (logged/reported) rather than erroring.
- **FR-015**: The system MUST tolerate a missing or already-changed Google Calendar entry (stale mapping) by treating it as needing re-creation, or as already-removed on delete, without failing the whole run.
- **FR-016**: The sync MUST run under the shared household account (which owns the Household calendar) and MUST NOT require either personal account to re-authorize for this feature's calendar access. *(Planning note: request the broad calendar authorization scope so feature 011 needs no further re-authorization — see Assumptions.)*

### Out of Scope (this feature)

The following are explicitly **not** part of 007 and belong to **feature 011 (weather-aware dog-walk finder)**:

- Reading free/busy or event details **from** Max's or Jaz's **work** calendars.
- ICS-URL ingestion of any external calendar.
- The mutual-free-window / dog-walk finder and any weather (Open-Meteo) logic.
- Auto-creating invites on work calendars or relying on work-calendar auto-accept.

Sync in this feature is strictly **one-way, outbound**: Household HQ → the shared Household Google Calendar. Inbound sync (reading changes made directly in Google Calendar back into the app) is **not** a goal; the app is authoritative and overwrites drift on its own managed entries.

### Key Entities *(include if feature involves data)*

- **Event (existing)**: An app calendar item (`id`, `title`, `start`, `end`, `owner`, `type`, `notes`, `gcalEventId`, …). `gcalEventId` stores the identity of its mirrored Household-calendar entry. Source of truth for its mirror.
- **Task (existing)**: An app to-do (`id`, `title`, `dueDate`, `owner`, `status` = open/done/snoozed, …). Only tasks with a `dueDate` are mirrored, as all-day entries. Requires a stored mapping to its mirrored calendar entry (Tasks currently has no `gcalEventId` column — the plan will decide how the mapping is persisted while keeping the Sheet hand-editable).
- **Household Calendar (external)**: The shared Google Calendar identified by Settings `householdCalendarId`, subscribed to by both users' phones. Holds the mirrored entries; owned/managed by the shared household account.
- **Settings (existing)**: Supplies `householdCalendarId` and `timezone`. No new user-facing config is strictly required beyond what already exists.
- **ActivityLog (existing)**: Receives one append per sync create/update/delete.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An event created in the app appears on both users' phone calendars (via the shared Household calendar) with no manual steps, well within the app's normal sync cadence.
- **SC-002**: Across repeated syncs and repeated edits, the number of Google Calendar entries for a given app record is always exactly one (or zero after deletion) — duplicates never accumulate (0 duplicates in a create→edit→edit→delete→re-sync cycle).
- **SC-003**: Every dated task with an open due date has exactly one matching all-day calendar entry; undated tasks have none (100% correspondence in a spot check).
- **SC-004**: Deleting or completing an app record removes its calendar entry within one sync cycle (100% of the time in test).
- **SC-005**: A partway-failed sync run, when retried, converges to a correct state with zero duplicates and zero lost updates.
- **SC-006**: Every calendar create/update/delete performed by the sync has a corresponding activity-log entry (100% coverage).
- **SC-007**: Enabling this feature requires re-authorization by only the shared household account, and 0 additional re-authorizations by either personal account for feature 011's calendar needs.

## Assumptions

- **Mirror window is present-and-future-focused.** (Confirmed in Clarifications.) The sync mirrors events whose end is today or later and dated tasks whose due date is today or later — all future, no far-horizon cap — plus a small recent-past grace; it does not back-fill deep historical events/tasks. Once an entry has been created it is left in place as it ages into the past (history is not retroactively deleted). Given a two-person household's low volume, an unbounded forward horizon stays well within platform quotas.
- **Task mirror lifecycle.** Open and snoozed dated tasks are mirrored; a task that is `done`, deleted, or edited to have no due date has its mirror removed. A snooze that changes the due date moves the mirror; a snooze that clears the due date removes it.
- **Owner treatment.** (Confirmed in Clarifications.) Owner is conveyed by **both** a `[Max]` / `[Jaz]` / `[Both]` prefix in the entry title **and** a per-owner event color, consistent with the app's existing owner color coding in `PRODUCT.md`/`DESIGN.md`. The exact color-value mapping (which calendar color represents which owner) is a planning detail.
- **Reminders / notification cadence.** (Confirmed in Clarifications.) Mirrored entries carry default reminders — timed events a popup ~30 min before start, all-day task entries a morning-of popup (~9am). Exact intervals are configurable defaults. Note: on a shared/subscribed calendar, whether a creator-set reminder fires for the other subscriber can depend on each phone's calendar settings; the plan should verify reminders actually surface on both devices during quickstart validation.
- **Sync cadence.** (Confirmed in Clarifications.) Changes mirror immediately at write time, with a scheduled reconcile as backstop. The reconcile frequency is a planning detail chosen to keep the calendar correct without exceeding platform quotas.
- **One-way authority.** The app is the source of truth for the entries it manages; manual edits made directly to those entries in Google Calendar are overwritten on the next reconcile. Inbound sync is out of scope.
- **All-day tasks.** Because tasks carry a date (not a time), their mirrors are all-day entries on the due date.
- **Task↔calendar mapping storage.** The Tasks tab currently has no `gcalEventId` column; the plan will add a hand-editable way to store each dated task's mirror identity (e.g. a new column) without breaking the "Sheet stays human-readable/editable" constitution rule.
- **Broad calendar scope now.** To spare feature 011 a second re-authorization, this feature requests the broad Google `calendar` authorization scope (read+write across accessible calendars) rather than a Household-calendar-only scope. Only the deploying shared account re-authorizes.
- **Runs as the shared account.** The web app already executes as the shared household account, which owns the Household calendar, so no cross-account credentials are needed.
