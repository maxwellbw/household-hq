# Feature Specification: Bug-fix batch 4

**Feature Branch**: `029-bug-fix-batch-4`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Feature 029 — Bug-fix batch 4. A batch of seven bug fixes from Max & Jaz's real-device feedback (calendar glitch, scroll lock, dismissals, done strikethrough, walks in day peek + times, walk-trigger reliability, prep-template picker)."

## Overview

The seventh household release cycle surfaced seven small but real defects and gaps during everyday use on Max's and Jaz's phones. None require new architecture; each is a bounded fix or polish item in the existing app, in the tradition of fix batches 016, 022, and 028. They are grouped as independent user stories so any subset can ship on its own.

## Clarifications

### Session 2026-07-17

- Q: What is the actual calendar glitch? → A: The whole calendar flashes / fully re-renders (reflows) on refresh or when data refetches — not chip mis-positioning or duplication.
- Q: When does the page scroll get stuck/locked? → A: Intermittent across different sheets/dialogs — harden scroll-restore everywhere rather than fixing one specific sheet.
- Q: Which dismissed notice reappears, and when? → A: It stays gone on a full reload but pops back when data refetches during the same session (affects the dismissal check, not initial load) — treat both the acknowledge and dog-walk notices this way.
- Q: For the dog-walk finder, what was observed? → A: Manual `runDogWalkFinder()` works, but the installed time-driven trigger logs "forecast unavailable this run (fetch failed or coordinates unset); deferring all days." So the trigger IS installed and firing; the forecast fetch fails under the trigger's execution context, causing every day to be deferred. This is a code-robustness fix (make the forecast fetch succeed/retry under the trigger), not a trigger-installation fix.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scheduled dog walks appear in the day peek with their time window (Priority: P1)

When a household member taps a day in the dashboard's 7-day strip, the Day Peek panel that opens should show the dog walk(s) scheduled for that day alongside the day's events and tasks, each with its time window — not just events and tasks. Today the panel omits walks entirely, so the household's most weather- and time-sensitive daily commitment is invisible from the dashboard's quickest surface.

**Why this priority**: The dog-walk finder (feature 011) is the app's flagship differentiator, but its output is currently only visible on the 7-day strip badges and the month calendar. The Day Peek is the one place a user looks to answer "what's on today?", and a booked walk is exactly the kind of thing they need to see there. Highest user value of the batch.

**Independent Test**: Open the dashboard on a day that has a booked/suggested walk, tap that day, and confirm a walk row appears in the Day Peek showing the walk's time window; confirm event and task rows still appear and show their times where applicable.

**Acceptance Scenarios**:

1. **Given** a day with one booked dog walk, **When** the user taps that day in the 7-day strip, **Then** the Day Peek panel lists the walk with its start–end time window, visually distinguishable from events and tasks.
2. **Given** a day with a `needs-decision` walk, **When** the user opens the Day Peek, **Then** the walk row conveys its needs-decision state.
3. **Given** a day with events that have specific start times, **When** the Day Peek opens, **Then** each timed event shows its time (existing behavior preserved).
4. **Given** a day with no walk, **When** the Day Peek opens, **Then** no walk row is shown and the panel behaves exactly as before.

---

### User Story 2 - Completed tasks read as done everywhere (Priority: P1)

A task marked done should render with a strikethrough (and a de-emphasized treatment) consistently across every surface where tasks appear — the Tasks tab, the Day Peek panel, calendar chips, and the task detail sheet — so a finished task is unmistakable at a glance and doesn't look identical to an open one.

**Why this priority**: Inconsistent done styling makes the app feel untrustworthy about what's actually finished — a core coordination signal for two people. Low effort, high everyday clarity.

**Independent Test**: Mark a task done and verify the strikethrough/de-emphasized treatment appears on it in the Tasks tab, the Day Peek, its calendar chip, and its detail sheet.

**Acceptance Scenarios**:

1. **Given** a task with status done, **When** it is shown in any task-bearing surface, **Then** its title renders with a strikethrough and de-emphasized color.
2. **Given** a task that is open or snoozed, **When** it is shown anywhere, **Then** it does not render with a strikethrough.
3. **Given** a task toggled from done back to open, **When** the surface re-renders, **Then** the strikethrough is removed.

---

### User Story 3 - Dismissed dashboard notices stay dismissed (Priority: P2)

When a user dismisses a dashboard notice — the acknowledge / "not yet committed" notice and the dog-walk needs-decision notice — it should stay dismissed and not reappear, until the underlying item genuinely changes (a new item to acknowledge, or a new/changed needs-decision walk). Dismissal already survives a full page reload; the defect is that a **data refetch during the same session** (the periodic/refocus refetch that keeps the dashboard fresh) makes a dismissed notice pop back even though nothing about the underlying item changed.

**Why this priority**: A notice that keeps coming back after being dismissed trains users to ignore all notices, defeating the purpose of the acknowledge and needs-decision signals. Reliability of an existing feature.

**Independent Test**: Dismiss each notice, trigger an in-session refetch (refocus the tab / wait for the background refetch) without changing the underlying item, and confirm the notice does not reappear; then cause a genuinely new underlying item and confirm the notice does reappear for that new item.

**Acceptance Scenarios**:

1. **Given** a dismissed acknowledge notice, **When** the dashboard refetches during the same session with no change to the underlying task, **Then** the notice stays hidden.
2. **Given** a dismissed dog-walk needs-decision notice, **When** data refetches in-session with no change to the walk, **Then** it stays hidden.
3. **Given** a dismissed notice, **When** a genuinely new underlying item appears (a new task to acknowledge, or a new needs-decision walk), **Then** a notice reappears for the new item only.
4. **Given** a dismissed notice, **When** the app is fully reloaded with no underlying change, **Then** it stays hidden (existing behavior preserved).

---

### User Story 4 - Scroll is always restored after a sheet or dialog closes (Priority: P2)

After opening and closing any modal sheet or dialog (task detail, quick-add, day peek actions, confirm dialogs, etc.), the user can always scroll the underlying page again. Today scroll can get stuck/locked after certain open-close sequences, leaving the page unscrollable until a full reload.

**Why this priority**: A locked scroll makes the app feel broken and forces a reload — a jarring failure on the primary mobile surface. Reliability fix.

**Independent Test**: On a phone-width viewport, open and close each sheet/dialog (including rapid open/close and opening one sheet from another), and confirm the page scrolls normally after every close.

**Acceptance Scenarios**:

1. **Given** any sheet or dialog is open, **When** the user closes it, **Then** the underlying page is scrollable again.
2. **Given** a sheet opened from within another sheet, **When** both are closed, **Then** scroll is restored (not left locked by a lingering lock).
3. **Given** a sheet is opened and closed rapidly in succession, **When** it settles closed, **Then** scroll is restored.

---

### User Story 5 - Attach a prep-checklist template when creating or editing an event (Priority: P2)

When creating or editing an event, the user can pick a prep-checklist template (from the existing TaskTemplates) to attach its prep tasks to the event, from a picker in the event create/edit UI — instead of having no in-app way to apply a template to a one-off event.

**Why this priority**: Prep templates already exist as data and drive recurring-event prep, but a user creating a one-off event (e.g. "Dinner party") has no way to pull in a saved prep checklist. This closes a known gap in the event workflow.

**Independent Test**: Create an event, pick a prep template from the picker, save, and confirm the template's prep tasks are attached to the event; edit an event and confirm a template can be applied there too.

**Acceptance Scenarios**:

1. **Given** the event create form, **When** the user opens the prep-template picker, **Then** the available TaskTemplates are listed for selection.
2. **Given** a template is selected on create, **When** the event is saved, **Then** the template's tasks are created as prep tasks attached to that event.
3. **Given** an existing event being edited, **When** the user applies a template, **Then** its tasks are attached without duplicating tasks already present from a prior application.

---

### User Story 6 - The daily dog-walk finder runs dependably every day (Priority: P3)

The daily dog-walk finder produces walks when it runs on the installed time-driven trigger, not only when run manually. Today the installed trigger fires but logs "forecast unavailable this run (fetch failed or coordinates unset); deferring all days" and books nothing, while a manual run of the same function succeeds — so the forecast fetch is failing specifically under the trigger's execution context. The finder must obtain the forecast dependably (retry/robustness) so trigger-driven runs book/suggest walks like manual runs do.

**Why this priority**: A finder that produces nothing on its automated schedule defeats the whole point of the feature — the household never sees a walk unless someone remembers to run it by hand. Degrades gracefully day-to-day, but it's a real code-robustness bug, not just an ops step.

**Independent Test**: Let the installed trigger fire (or simulate the trigger execution context), and confirm the forecast is obtained and eligible weekdays get a walk row — matching the outcome of a manual `runDogWalkFinder()` run. Confirm a transient forecast-fetch failure is retried rather than silently deferring the whole run.

**Acceptance Scenarios**:

1. **Given** the finder runs on its installed trigger, **When** the forecast provider responds, **Then** eligible weekdays get a walk row (booked or suggested) — the same result as a manual run.
2. **Given** a transient forecast-fetch failure, **When** the finder runs, **Then** it retries before giving up, and only defers if the forecast is genuinely unavailable after retries (with a clear log distinguishing "unset coordinates" from "fetch failed").
3. **Given** the finder trigger is installed, **When** the installer runs again, **Then** it does not create a duplicate trigger (exactly one remains — existing behavior preserved).
4. **Given** a run that does defer (forecast truly unavailable), **When** a later run succeeds, **Then** it fills the affected weekdays with no gaps or duplicates (idempotency preserved).

---

### User Story 7 - The calendar renders cleanly without visual glitches (Priority: P3)

The calendar view stays visually stable when data refetches: today the whole calendar flashes / fully re-renders (reflows) on refresh or when a background refetch lands, which reads as a jarring flicker on the primary organizing surface. After the fix, a refetch that returns unchanged (or incrementally changed) data updates in place without a full-calendar flash.

**Why this priority**: A cosmetic flash is annoying but not blocking; grouped low with the other polish items. Now well-characterized (full re-render on refetch), so it's a targeted fix rather than investigative.

**Independent Test**: Trigger a dashboard/calendar data refetch (tab refocus or background refetch) and confirm the calendar does not visibly flash / fully re-render when the data is unchanged; confirm real data changes still update correctly.

**Acceptance Scenarios**:

1. **Given** the calendar view, **When** a background refetch returns unchanged data, **Then** the calendar does not visibly flash or fully re-render.
2. **Given** the calendar view, **When** a refetch returns genuinely changed data, **Then** only the affected chips update and existing correct rendering/interactions are unchanged.

---

### Edge Cases

- **Walks in day peek**: A day with multiple walks (e.g. a second early-day walk) shows all of them; a moved walk shows its updated window.
- **Done strikethrough**: A very long done task title still truncates/wraps as before with the strikethrough applied; owner color coding remains legible.
- **Dismissals**: Dismissal state is per-device (mirrors existing local-storage dismissal patterns); clearing app storage may reset dismissals — acceptable.
- **Scroll lock**: Two locking sources active at once (nested sheets) must both release before scroll is restored; the fix must not disable scroll-locking entirely (background must not scroll while a sheet is open).
- **Prep-template picker**: Applying a template with zero tasks is a no-op; applying the same template twice does not duplicate its tasks.
- **Walk-trigger reliability**: A forecast fetch that fails after all retries still defers gracefully (logs the reason, books nothing that run) and a later successful run fills the gap; the finder stays idempotent and under the execution limit even as calendars grow.
- **Calendar flash**: A refetch that changes only one item must not force a full-calendar remount; the fix must not break legitimate re-renders when the view or date range actually changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Day Peek panel MUST display the dog walk(s) scheduled for the peeked day, each showing its time window, alongside events and tasks.
- **FR-002**: Walk rows in the Day Peek MUST be visually distinguishable from events and tasks and MUST convey a `needs-decision` walk's state.
- **FR-003**: Timed events (and walks) in the Day Peek MUST show their time; all-day items MUST NOT show a spurious time (existing event behavior preserved).
- **FR-004**: A task with status done MUST render with a strikethrough and de-emphasized treatment on every surface where tasks appear (Tasks tab, Day Peek, calendar chips, detail sheet); non-done tasks MUST NOT.
- **FR-005**: A dismissed dashboard notice (acknowledge notice, dog-walk needs-decision notice) MUST remain dismissed across both full reloads AND in-session data refetches, and MUST reappear only when the underlying item genuinely changes (the dismissal MUST be evaluated against persisted dismissal state on every render, keyed stably so an unchanged item keeps the same key across refetches).
- **FR-006**: Closing any modal sheet or dialog MUST restore page scroll in all cases (any sheet/dialog, nested sheets, rapid open/close); the fix MUST harden scroll-restore globally rather than per-sheet, and the background MUST NOT scroll while a sheet is open.
- **FR-007**: The event create and edit UI MUST provide a picker to select a prep-checklist template from the existing TaskTemplates.
- **FR-008**: Selecting a prep-checklist template on an event MUST attach that template's tasks as prep tasks to the event on save, without duplicating tasks already present from a prior application of the same template.
- **FR-009**: The dog-walk finder MUST obtain the forecast dependably under the time-driven trigger's execution context — retrying a transient fetch failure before deferring, and distinguishing "coordinates unset" from "fetch failed" in logs — so trigger-driven runs book/suggest walks like manual runs. The installer MUST remain idempotent (exactly one trigger) and the finder MUST remain idempotent so a deferred day is filled with no gaps or duplicates on a later successful run.
- **FR-010**: The calendar view MUST NOT visibly flash or fully re-render when a background data refetch returns unchanged data; genuinely changed data MUST still update the affected chips.
- **FR-011**: Every state-changing fix (e.g. attaching template tasks) MUST continue to append to ActivityLog per the project's definition of done, and backend writes MUST remain idempotent.

### Key Entities *(include if feature involves data)*

- **Dog walk (DogWalks ledger row)**: An existing per-(date, slot) walk record with a time window and a status (booked / suggested / needs-decision / moved). Newly surfaced in the Day Peek; not modified by this feature.
- **Task**: Existing entity; its `status` (open / done / snoozed) drives the strikethrough treatment. No schema change.
- **Notice dismissal state**: Existing per-device record of which notices a user has dismissed, keyed to the underlying item so a genuinely new item re-shows a notice.
- **TaskTemplate / prep task**: Existing prep-checklist template whose tasks are attached to an event when a template is applied via the new picker.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a day with a scheduled walk, the walk appears in the Day Peek with its time window in 100% of cases; on a day with none, no walk row appears.
- **SC-002**: 100% of done tasks show the strikethrough treatment across the Tasks tab, Day Peek, calendar chips, and detail sheet; 0% of open/snoozed tasks do.
- **SC-003**: A dismissed notice does not reappear across at least 5 consecutive in-session refetches (and full reloads) with no underlying change; it reappears only when a genuinely new underlying item exists.
- **SC-004**: After exercising every sheet/dialog open-close path (including nested and rapid) on a phone-width viewport, the page remains scrollable in 100% of cases (zero reload-to-recover incidents).
- **SC-005**: A prep template applied to an event attaches exactly its task set once (no duplicates on re-apply), verified on both create and edit.
- **SC-006**: A trigger-context finder run (real or simulated) obtains the forecast and produces walk rows for eligible weekdays matching a manual run; a transient fetch failure is retried, not silently deferred; the installer still yields exactly one trigger.
- **SC-007**: A background refetch of unchanged data produces no visible full-calendar flash/re-render, with no regression to legitimate updates or interactions.
- **SC-008**: Frontend passes `npm run build` with no type errors; backend self-tests remain green; new UI passes an `/impeccable audit` before merge.

## Assumptions

- The seven items are independent; any subset can be implemented and shipped, ordered by the priorities above.
- Notice dismissal state is stored per-device in local storage, consistent with existing dismissal patterns (018/019/011); cross-device dismissal sync is out of scope.
- The prep-template picker reuses the existing TaskTemplates and the existing event→prep-task attachment mechanism used by recurring events; no new template authoring UI is in scope for this feature.
- The dog-walk finder's scheduling model (one run per day, weekday gating) is unchanged; this feature only hardens the forecast fetch under the trigger context and preserves the finder's existing idempotency — it does not redesign the finder.
- Surfacing walks in the Day Peek is read-only; booking/moving walks from the Day Peek is out of scope (that is feature 031, the dog-walk day planner).
- The forecast fetch failing under the trigger is assumed transient/context-related (Open-Meteo `UrlFetchApp` call under a time-driven trigger); the fix adds retry/robustness and clearer logging. If diagnosis reveals coordinates are genuinely unset in the trigger context, that root cause is fixed instead — the acceptance is trigger-driven runs producing walks.
- Both the calendar-flash and scroll-lock fixes are verified live on a phone-width viewport during implementation; both are now characterized well enough to be targeted fixes rather than investigative.
- No new OAuth scopes, no new external services, and no Sheet schema changes are required.

## Implementation deviations (2026-07-17)

- **US2 done-strikethrough color**: `tasks.md` specified `text-ink-faint` for the done
  treatment (matching the pre-existing `TaskRow`/`DayPeekPanel` styling). Implementation
  measured `text-ink-faint` at 3.06:1 against `--surface` (white) and 2.84:1 against `--bg`
  — both fail the constitution's/DESIGN.md's 4.5:1 body-text bar. Shipped `text-ink-muted`
  instead (5.68:1 / 5.27:1) on all four in-scope surfaces (`TaskRow`, `DayPeekPanel`,
  `EventContent`, `TaskDetailSheet`) — same de-emphasized intent, WCAG AA-compliant.
  `ListItemRow.tsx` (Lists feature, not touched by this batch) still uses `text-ink-faint`
  for its own stocked-item strikethrough; flagged as a follow-up, not fixed here (out of
  this batch's scope).
- **US7 root cause, precisely pinned**: research.md's R7 correctly identified the *symptom*
  (full re-render on refetch) but speculated the mechanism was `calendarApp.events.set()`
  replacing the collection, or lost structural sharing. Live reproduction (tagging every
  chip DOM node, forcing a refetch via the React Query client, instrumenting both
  `events.set` and `calendarApp.destroy`) showed neither: React Query's structural sharing
  held (`events`/`tasks` query data kept the same object reference across the refetch),
  `events.set()` was never called, yet every chip was replaced because
  `calendarApp.destroy()` fired. The actual cause: `@schedule-x/react`'s `ScheduleXCalendar`
  runs a setup/cleanup effect keyed on `[calendarApp, customComponents, randomId]`, and
  `CalendarHome` passed a fresh `customComponents={{...}}` object literal every render —
  any re-render (including a harmless refetch settle) gave that effect a new dependency,
  so its cleanup destroyed the whole calendar and its body rebuilt it from scratch. The fix
  is simpler than research anticipated: hoist `customComponents` to a module-level constant
  (no signature-based gating of `events.set()` was needed since that path was never the
  problem).
