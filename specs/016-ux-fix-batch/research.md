# Phase 0 Research: UX Fix Batch

## R1 — Blank-date quick-add must stay undated (US1 / FR-001..003)

**Decision**: In `frontend/src/lib/quickAdd.ts`, `buildOneTimeTaskPayload` must omit `dueDate` when the input has none, instead of `input.dueDate || todayKey(timezone)`.

**Rationale**: The backend requires only `title` + `owner` on task create (`REQUIRED_ON_CREATE.Tasks = ['title','owner']`, `backend/Config.js`), so a create payload without `dueDate` yields an undated task — exactly what the Someday list (feature 013) surfaces. `QuickAddSheet` already passes `dueDate: date || undefined`; the defaulting bug is isolated to this one builder. The `timezone` parameter becomes unused for the omit path but is retained on the signature to avoid churn in `useCreateOneTimeTask` (or removed if trivial — decided at implementation).

**Alternatives considered**: Sending `dueDate: ''` — rejected: create-path validation treats a required-field convention differently from update; omission is the clean, backend-sanctioned way to create an undated task. Fixing at the call site in `QuickAddSheet` — rejected: the call site is already correct; the builder is the defect.

## R2 — Task edit interaction model (US2 / FR-004..010) — clarified

**Decision**: Reuse the existing Event pattern. `TaskDetailSheet` opens **read-only** (as today) and gains an **Edit** button that opens a new `TaskEditSheet` (mirroring `EventDetailSheet` → `EventEditSheet`). Editable fields: **title, owner (max/jaz/both), due date (clearable)**. A single **Save** commits via `tasks.update`; **Cancel/close** discards.

**Rationale**: Matches the clarified answer (explicit Edit button, no always-editable inline fields) and the codebase already ships this precise pattern for events (`EventDetailSheet` holds `showEdit` state and renders `EventEditSheet`; `EventEditSheet` validates title, offers the same 3-owner selector). Copying it keeps the UI consistent (Constitution IV — boring/debuggable) and reuses the owner-selector, dialog-a11y hook (`useDialogA11y`), and `ApiError` field-error handling verbatim.

**`tasks.update` clear-date semantics**: Confirmed in `backend/Api.js` `updateTask_` — "dueDate may be cleared (empty string) (FR-005)". So clearing the date is `tasks.update({ id, dueDate: '' })`, which also moves/removes the calendar mirror. Owner and title changes are plain field patches. Lifecycle fields (status/completedBy/completedAt) are rejected by `tasks.update` — the edit sheet must not touch them (completion keeps its own path).

**New mutation**: Add `useUpdateTask` to `useMutations.ts` — generic `{ id, title?, owner?, dueDate? }` → `tasks.update`, `onSuccess` invalidates `['tasks']` (same shape as `useUpdateEvent`/`useScheduleTask`). Distinct from `useScheduleTask` (which is date+owner-only for the Someday→scheduled flow); reuse is possible but a general updater is clearer for title/owner edits.

**Alternatives considered**: Fold edit fields inline into `TaskDetailSheet` — rejected by clarification (accidental-edit risk, fuzzy commit). Extend `useScheduleTask` — rejected: its `buildSchedulePayload` requires both date and owner and can't express a title-only or clear-date edit.

## R3 — "Edit due" opens the detail sheet in edit mode (US3 / FR-011..012) — clarified

**Decision**: `TaskRow`'s existing `onEditDue` prop, currently never wired by `TasksView`, is wired to open the **same `TaskDetailSheet`** already used for `onDetail`, but entered directly in edit mode. Implement via an `initialEdit?: boolean` prop on `TaskDetailSheet` (opens with `showEdit` true) and a `detailEdit` boolean alongside `detailTask` state in `TasksView`.

**Rationale**: Clarified answer chose "full detail/edit sheet" over a separate lightweight date picker — one editor, one code path. No new dialog component; the overflow "Edit due" and the title-tap both land in `TaskDetailSheet`, differing only in whether it opens editing.

**Alternatives considered**: A dedicated date-only dialog like `SnoozeDialog` — rejected by clarification.

## R4 — Calendar taps must open details (US4 / FR-013..014)

### R4a — Task taps (deterministic)

**Decision**: In `CalendarHome`, stop ignoring `task-` ids in `onEventClick`. For a `task-<id>` event, strip the prefix, find the standalone task in `visibleStandaloneTasks`, set a new `selectedTaskId`, and render `TaskDetailSheet` (the same component from the list, so editing works from the calendar per FR-014/US4 scenario 4).

**Rationale**: The ignore is explicit (`if (!id.startsWith('task-')) setSelectedEventId(id)`); the fix is to add the task branch and a sheet. Purely additive.

### R4b — Event taps not firing (investigation) — CONFIRMED

**Status**: Confirmed during implementation. Real OAuth sign-in blocked headless browser (preview-tool) testing, so the investigation was done by rendering the actual `CalendarHome` tree (real `@schedule-x/react`/`@schedule-x/calendar`, real custom components) through Vitest + React Testing Library and dispatching real click events at the rendered chips — i.e. driving the same library code a browser would, just via jsdom instead of a live tab. This also included reading `node_modules/@schedule-x/calendar/dist/core.js` directly.

**Root cause**: `useCalendarApp`'s config never set `isResponsive` (Schedule-X default: `true`). With `isResponsive: true`, Schedule-X installs its **own** `resize` listener (`CalendarWrapper`'s `onResize` → `handleWindowResize`) that runs on mount and on every `window resize` event. It measures `calendarRoot.clientWidth` against a ~700px breakpoint (derived from computed root font-size) and, independently of our `useIsMobile()`/`defaultView` choice, calls `setScreenSizeCompatibleView`, which can force-switch the active view — `currentView.destroy()` followed by `newView.render(...)`, i.e. the **entire event DOM subtree is torn down and rebuilt**. This can fire at any time a resize-like layout event happens (mobile address-bar show/hide on scroll, on-screen-keyboard toggle, orientation change, or even a scrollbar appearing/disappearing on desktop) — including while a user's finger/mouse is mid-tap. If the swap lands between pointerdown and pointerup, the tap's second half never reaches a live, click-bound element and the tap silently does nothing. This explains why the bug was reported as "unreliable" (intermittent, timing-dependent) rather than "always broken," and why it hit **both** mobile and desktop (Schedule-X's breakpoint is about the *calendar container's* rendered width, not our device-class media query, so it can also mis-trigger on desktop windows/layouts near ~700px).

Verified directly: with `isResponsive: true` (previous code), the calendar's view flips away from whatever `defaultView` was requested as soon as its resize-driven `onResize()` runs on mount — reproducible even in jsdom (a broken root-font-size read there makes `isSmall` evaluate the *opposite* way than production, but it proves the auto-switch fires unconditionally on every mount/resize regardless of our own view choice).

**Fix applied**: Set `isResponsive: false` in `CalendarHome`'s `useCalendarApp` config (`frontend/src/components/calendar/CalendarHome.tsx`). We already own the mobile/desktop split via `useIsMobile()` + `defaultView`; Schedule-X's separate, conflicting breakpoint logic is redundant and is the piece that periodically destroys/rebuilds the event nodes underneath a tap. No behavior we rely on depended on the library's own switching.

**Secondary finding (fixed alongside)**: `customComponents` only registered `monthGridEvent: EventContent`, not `monthAgendaEvent`. Schedule-X's agenda-view event (`MonthAgendaEvent`, `core.js` ~line 6655) looks up a *different* custom-component key than the grid view; without it registered, mobile's agenda view silently fell back to Schedule-X's plain default event look (no owner color, no "Task" label) — a DESIGN.md violation (owner color = identity) independent of the click bug. Fixed by registering `monthAgendaEvent: EventContent` too.

**Note for future manual/live QA**: Schedule-X's `month-agenda` view is a mini month-grid *plus* an agenda list scoped to the currently-selected day (defaults to today) — tapping a day in the mini-grid is what populates the agenda list below it. This is expected library behavior, not a bug; the click handling on an agenda-list event chip, once visible, was confirmed to invoke `onEventClick` exactly like the grid view (both wire straight to `$app.config.callbacks.onEventClick`).

**Alternatives considered**: Replacing Schedule-X's click with a manual `onClick` inside `EventContent` — not needed; the built-in `onEventClick` wiring is correct and fires reliably once the destroy/rebuild race from `isResponsive` is removed.

## Cross-cutting

- **Accessibility**: New `TaskEditSheet` inherits `useDialogA11y`, 44px targets, `aria-invalid`/`role="alert"` field errors, and the owner selector's `aria-pressed` — copied from `EventEditSheet`. Verify with an `/impeccable audit` before PR (DESIGN.md).
- **No backend / schema / auth change** (FR-016). All writes are existing `tasks.update`, already logged to ActivityLog (Constitution VI).
- **Data freshness**: All edits `invalidateQueries(['tasks'])`; the calendar and dashboard re-derive from the same query, so changes reflect without manual refresh (FR-007).
