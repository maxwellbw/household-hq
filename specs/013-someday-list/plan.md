# Implementation Plan: Someday List

**Branch**: `013-someday-list` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-someday-list/spec.md`

## Summary

Feature 013 surfaces a category of data the backend already stores but the UI has never shown: **open tasks with no due date**. Today `CalendarHome` filters standalone tasks down to those with a `dueDate` (`t.dueDate` truthy) before placing them on the calendar — undated ones silently fall on the floor. This feature (1) adds a **Someday** list below the calendar on the home view showing exactly those dropped tasks (open, standalone, undated), honoring the existing owner-filter chips, with the same check-off/reopen control used elsewhere; (2) adds a **tap-to-schedule** flow — tapping a someday task opens a small dialog that asks for a date and an owner *explicitly* (date starts empty, owner has no pre-selection, confirm disabled until both are set) and on confirm calls the existing `tasks.update` action to set `dueDate` + `owner`, after which the task leaves Someday and appears on the calendar; and (3) as a desktop-only progressive enhancement, lets a task be **dragged onto a calendar day** to open that same dialog pre-filled with the drop date (still asking owner + confirmation).

**Technical approach**: Pure frontend, zero backend change — `tasks.update` already accepts `{id, owner, dueDate}`, is `LockService`-wrapped, appends to ActivityLog, and mirrors to the calendar (backend/Api.js `updateTask_`). The Someday source is a one-line derivation from the existing `buildCalendarModel` output (`model.standaloneTasks.filter(t => !t.dueDate && t.status === 'open')`) — `standaloneTasks` already excludes event-attached tasks (satisfying the "exclude event-attached" clarification for free). New surface: a `SomedayList` component and a `ScheduleTaskDialog`, one write hook `useScheduleTask` mirroring the shipped `useUpdateEvent` pattern (invalidate `['tasks']` on success), reusing `TaskRow` for rows and `ownerStyle`/owner tokens for identity color. Scheduling → task gains a `dueDate` → it drops out of the Someday filter and the existing calendar code renders it on its day; no bespoke calendar wiring for the tap path. US3 drag-and-drop is layered on top and can be deferred without harming US1/US2 (see Constitution Check note and research.md R4). Everything follows DESIGN.md/PRODUCT.md and passes an `/impeccable audit` before PR.

## Technical Context

**Language/Version**: TypeScript 5.x + React 18 (frontend only). No backend change.

**Primary Dependencies**: Existing only — Vite, React, Tailwind, shadcn/ui (Radix primitives), TanStack Query, Schedule-X v4 (calendar, unchanged). **No new dependencies** (constitution IV). For US3, native HTML5 drag-and-drop (browser built-in) — no drag library added.

**Storage**: None client-side of record — the Google Sheet remains the source of truth (constitution II). Scheduling writes through the existing `tasks.update`. Owner-filter and dialog state are ephemeral UI state.

**Testing**: `npm run build` (tsc + Vite) with zero type errors (DoD). Vitest + React Testing Library for the pure logic: the someday selector (open + standalone + undated), the "confirm enabled only when date AND owner set" gate, and the schedule payload builder. Manual quickstart validation against the live deployed backend + `/impeccable audit`. No backend/SelfTest change (no backend code touched).

**Target Platform**: Static PWA-capable SPA on GitHub Pages. Primary: mobile browsers (375px) — tap-to-schedule is the universal path. Secondary: desktop (~1100px content column) — adds optional drag-to-schedule. Backend: existing Apps Script web app, unchanged, no redeploy required.

**Project Type**: Web application — `/frontend` only for this feature. `/backend` untouched.

**Performance Goals**: Someday list renders instantly from already-cached `['tasks']` query data (no new fetch). Scheduling feels immediate (optimistic flip or fast invalidate). Readable and horizontal-scroll-free at 375px; 60fps.

**Constraints**: Free-tier only (constitution III) — no new libs/services. WCAG 2.1 AA — the dialog is keyboard-operable and focus-trapped, date + owner fields are labelled, confirm's disabled state is programmatically conveyed, owner options meet contrast, targets ≥44px, respects `prefers-reduced-motion`. Two users forever (constitution I): owner is `max`/`jaz`/`both`, never inferred from the signed-in user. All dates in the household timezone from Settings; `dueDate` stored as an ISO `YYYY-MM-DD` string (constitution II). Writes stay idempotent + logged via the reused action (constitutions V/VI).

**Scale/Scope**: Two users; tens–low-hundreds of tasks. New/changed surface ≈: `SomedayList` (list + empty state), `ScheduleTaskDialog` (date + owner + validation), one `useScheduleTask` hook, a tiny selector added to `tether.ts` (or derived in the component), `App.tsx`/`CalendarHome` layout to slot the list below the calendar, and (optional US3) drag handlers. Roughly 4–7 new/changed frontend files; 0 backend files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Two Users Forever | ✅ Pass | Owner stays `max`/`jaz`/`both`; the dialog asks for it explicitly and never derives it from the signed-in user or the dragger (FR-007). No roles/tenancy. Someday is a view, not a new concept. |
| II. The Sheet Is the Source of Truth | ✅ Pass | Frontend consumes cached task data; the only write is the existing `tasks.update` that owns the Sheet. `dueDate` is a plain ISO `YYYY-MM-DD` string; no new column, field, or status. |
| III. Free-Tier Only | ✅ Pass | No new dependencies or services. US3 uses the browser's native drag-and-drop. |
| IV. Boring and Debuggable | ✅ Pass | Stays in the decided stack. Reuses `buildCalendarModel`, `TaskRow`, owner tokens, and the `useUpdateEvent` hook shape. The tap path needs no bespoke calendar integration — a scheduled task simply re-enters the existing dated-task render path. |
| V. Idempotent Generation | ✅ Pass | No generation/trigger code. `tasks.update` is already safe to re-send; a repeated schedule with the same values is a no-op patch. |
| VI. Every State Change Is Logged | ✅ Pass | Scheduling reuses `tasks.update`, which appends an `update` ActivityLog row (actor, action, targetId) — no new logging path needed (FR-015). |
| VII. Spec-Driven Development | ✅ Pass | Follows the clarified spec on branch `013-someday-list`; the one planning finding (US3 drag onto the Schedule-X **month grid** has no `data-date` hook, so it is scoped as deferrable progressive enhancement) is recorded here and in research.md, not silently shipped. |

**Gate result: PASS.** No Complexity Tracking entries required. One finding to confirm at the plan-review pause: **US3 (desktop drag-to-schedule) is a progressive enhancement that may be deferred.** Schedule-X's month-grid day cells expose no per-day `data-date` attribute (only its week/date grids do), so resolving the drop date is the single fragile part of the feature. US1 + US2 (see + tap-to-schedule) are the committed deliverable and are fully independent of US3; drag ships only if the low-risk approach in research.md R4 proves clean, else it is deferred without reopening the spec.

## Project Structure

### Documentation (this feature)

```text
specs/013-someday-list/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (someday source, list placement/layout, schedule write path, drag approach & risk)
├── data-model.md        # Phase 1 — view models: SomedayTask selector, ScheduleDraft, validation rules
├── quickstart.md        # Phase 1 — end-to-end validation scenarios (against live backend)
├── contracts/
│   └── api-tasks-schedule.md   # Phase 1 — the reused tasks.update contract as consumed for scheduling (no new action)
├── checklists/
│   └── requirements.md  # spec quality checklist (from /speckit.specify)
└── tasks.md             # Phase 2 — /speckit.tasks output (NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── App.tsx                                 # CHANGED: render SomedayList below CalendarHome in the calendar branch (shares visibleOwners)
│   ├── components/
│   │   ├── calendar/
│   │   │   └── CalendarHome.tsx                # CHANGED (US3 only): expose day-cell drop targets / drop-date resolution for drag; unchanged for US1/US2
│   │   ├── task/
│   │   │   ├── SomedayList.tsx                 # NEW: open+standalone+undated tasks, owner-filtered, empty state, rows draggable (US3)
│   │   │   ├── ScheduleTaskDialog.tsx          # NEW: date (empty) + owner (no preselect) + confirm(disabled until both) + cancel
│   │   │   └── TaskRow.tsx                      # REUSED (maybe minor: optional draggable wrapper); check-off/reopen already present
│   ├── hooks/
│   │   └── useMutations.ts                     # CHANGED: add useScheduleTask (tasks.update {id,dueDate,owner}; invalidate ['tasks'])
│   └── lib/
│       ├── tether.ts                           # CHANGED (opt): export a somedayTasks(model) selector helper
│       └── schedule.ts                         # NEW (opt): pure buildSchedulePayload + canConfirm(date,owner) helpers (unit-tested)
└── (backend/ untouched)
```

**Structure Decision**: Web application; this feature lives entirely under `/frontend`. The Someday list is rendered in the **Calendar home view** below the calendar (App.tsx's `active === 'calendar'` branch, alongside the existing `OwnerFilterChips` + `CalendarHome`), so it shares the owner filter and the cached `['tasks']` query. `tasks.update` is reused verbatim for scheduling; no `/backend` files change and no clasp redeploy is needed. Layout detail (giving the calendar a bounded height so the Someday list can flow/scroll beneath it) is captured in research.md R2.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.
