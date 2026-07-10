# Research: Someday List

**Feature**: 013-someday-list | **Date**: 2026-07-10 | **Phase 0**

All Technical Context items resolved; no NEEDS CLARIFICATION remain. Decisions below.

## R1 — Source of "someday" tasks

**Decision**: Someday = `buildCalendarModel(events, tasks).standaloneTasks.filter(t => t.status === 'open' && !t.dueDate)`.

**Rationale**:
- `buildCalendarModel` (`src/lib/tether.ts`) already partitions tasks into event-tethered vs `standaloneTasks` (tasks with no resolvable parent event). Using its output means "exclude event-attached tasks" (clarification 2026-07-10) is satisfied with no extra logic.
- `CalendarHome` already computes `visibleStandaloneTasks = standaloneTasks.filter(t => visibleOwners.has(t.owner) && t.dueDate)` — the *dated* ones for the calendar. Someday is the exact complement (`!t.dueDate`), so the two views are provably disjoint (FR-004): a task is on the calendar **or** in Someday, never both.
- `status === 'open'` excludes done (leaves the list on completion, FR-005) and snoozed (a snoozed task carries a future `dueDate`, so it's dated and already excluded by `!t.dueDate` — the `status` filter is belt-and-suspenders and documents intent).

**Alternatives considered**: A dedicated backend `tasks.someday` list action — rejected: no backend change is warranted when the data is already fetched by `useTasks()` and the partition already exists (constitution IV, boring/reuse).

## R2 — Where the list lives and how it lays out

**Decision**: Render `<SomedayList visibleOwners=… />` in `App.tsx` inside the `active === 'calendar'` branch, **below** `<CalendarHome/>`, sharing the same `useOwnerFilter()` state already passed to the chips and calendar.

**Rationale**:
- The spec says "below the calendar" on the home view; the calendar home is `App.tsx`'s calendar branch. Keeping `SomedayList` a sibling of `CalendarHome` (not nested inside it) keeps `CalendarHome` focused on the calendar and lets the list own its own empty/loading behavior. Both read the same cached `['tasks']` query, so there is no double-fetch.
- **Layout**: `CalendarHome`'s wrapper is `flex h-full flex-col`. To let a list flow beneath it, the calendar branch becomes a vertical scroll region: the calendar takes its natural/бounded height and the Someday list follows in normal flow, the whole column scrolling on overflow (mobile) with the bottom tab bar fixed. Exact height treatment (calendar `shrink-0` + list below, or a `max-h` on the calendar) is an implementation detail to settle during `/impeccable` iteration; the constraint is: no nested independent scrollbars fighting, no horizontal scroll at 375px.

**Alternatives considered**: Nest the list inside `CalendarHome`'s return — rejected: `CalendarHome` early-returns on loading/error and is already busy; a sibling is cleaner separation. A separate nav section for Someday — rejected: spec explicitly wants it on the calendar home, and 012 already owns the four-section nav.

## R3 — Scheduling write path

**Decision**: New hook `useScheduleTask()` calling `apiCall('tasks.update', { id, dueDate, owner }, …)`, invalidating `['tasks']` on success — a direct clone of the shipped `useUpdateEvent()` shape in `src/hooks/useMutations.ts`.

**Rationale**:
- `backend/Api.js` `updateTask_` accepts exactly `title/owner/dueDate` (it explicitly rejects `status/completedBy/completedAt`), is wrapped by `updateRecordById_` (ActivityLog append + `LockService`), and calls `mirrorTaskToCalendar_`. So setting `dueDate` + `owner` in one call fully schedules the task, logs it (FR-015), and moves/recolors its calendar mirror — no new action, no redeploy.
- On success we invalidate `['tasks']`; the refetched task now has a `dueDate`, so `SomedayList`'s filter drops it and `CalendarHome`'s dated-task path renders it. The whole "leaves Someday, appears on calendar" transition (FR-009, SC-005) is emergent — no manual list surgery.
- Optimistic update is optional. Given the task visibly *moves surfaces* (list → calendar), a plain invalidate-on-success with a brief pending state on the dialog's confirm button is the boring, correct choice; optimistic removal from the list can be added if it feels sluggish. Failure leaves the task in Someday and surfaces a toast (FR-014) — mirror the existing error handling in `useMutations.ts` (`handleAuthError`, re-throw).

**Alternatives considered**: Two calls (set owner, then dueDate) — rejected, one patch does both atomically. Reusing snooze semantics — rejected, snooze is a different verb/history; scheduling is a plain update.

## R4 — Desktop drag-to-schedule (US3) approach and risk

**Decision**: Implement US3 with **native HTML5 drag-and-drop** — Someday rows get `draggable`, carrying the task id via `dataTransfer`; the drop target resolves the calendar day and opens `ScheduleTaskDialog` **pre-filled with that date but owner still unset**. Scope US3 as a **progressive enhancement that may be deferred** if drop-date resolution proves fragile; US1 + US2 do not depend on it.

**Risk / rationale**:
- Schedule-X **month-grid** day cells (the default desktop view) render as `div.sx__month-grid-day` with **no `data-date` attribute** (verified in `@schedule-x/calendar` dist: only the week-grid `date-axis` and `date-grid-day` expose `data-date` / `data-date-grid-date`; the month grid does not). So a drop handler cannot read the date straight off the cell.
- Lowest-risk resolution path (if pursued): on `drop`, use `document.elementFromPoint` to find the enclosing `.sx__month-grid-day`, read its day-number header (`.sx__month-grid-day__header-date`) text, and reconstruct the full ISO date from the calendar's current visible month/range (already tracked in `CalendarHome` via `onRangeUpdate` → `visibleRange`). This is deterministic within a rendered month but couples to Schedule-X's internal DOM.
- Because the coupling is to third-party internal markup, US3 is explicitly deferrable per constitution IV (boring/debuggable) and the spec's P3 priority. The **committed** deliverable is US1 + US2 (tap works on every device, FR-012). If drag lands cleanly in `/impeccable` iteration, ship it; otherwise defer to a follow-up without reopening the spec.

**Alternatives considered**:
- Add a DnD library (`@dnd-kit`, `react-dnd`) — rejected: new dependency for a P3 convenience (constitution III/IV).
- Switch default desktop view to week/date grid (which *do* expose `data-date`) — rejected: month grid is the intended desktop home view (006/012); changing it to enable a P3 feature is the tail wagging the dog.
- Schedule-X's own drag-and-drop plugin — rejected: it drags *existing calendar events* between slots, not *external DOM items* onto days; wrong tool.

## R5 — Owner and date input controls (dialog)

**Decision**: Date = a native `<input type="date">` (empty default), labelled, min = today's key in household tz. Owner = a 3-option segmented control (Max / Jaz / Both) with **no option pre-selected**, reusing owner color tokens (`bg-owner-max/jaz/both`) for identity, not decoration. Confirm button `disabled` until both `date` and `owner` are truthy (FR-008), with the disabled state conveyed to assistive tech.

**Rationale**: Native date input is the boring, accessible, zero-dependency choice and matches how event forms already take dates. A segmented control with no default operationalizes "explicit, never inferred" (FR-007) visibly. Contrast/target-size/focus-trap handled per WCAG 2.1 AA (constitution/PRODUCT).

**Alternatives considered**: A custom calendar-popover date picker — rejected, unneeded weight. Defaulting owner to "Both" — rejected by clarification (no pre-selection).
