# Implementation Plan: App Shell & Task UX

**Branch**: `012-app-shell-task-ux` | **Date**: 2026-07-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-app-shell-task-ux/spec.md`

## Summary

Feature 012 finishes the app shell that 006 stubbed and makes the household's already-built backend fully reachable from the UI. It (1) turns the disabled **Tasks / Feed / More** nav buttons into real sections — a bottom tab bar on mobile and a **left sidebar rail** on desktop — with Calendar staying the home view; (2) adds a **Tasks** section that lists *all* tasks (grouped Open→collapsed Done, honoring the owner filter chips) with check-off/reopen for standalone tasks, not just event-tethered ones; (3) adds **snooze/defer with visible history**, which requires the feature's single backend addition — an idempotent `tasks.snooze` / `tasks.unsnooze` action that flips status, moves the due date, and appends to `snoozeHistory` + ActivityLog; (4) adds an **event end date/time** to the create form and a new minimal **event-edit** sheet (no edit UI exists today); (5) adds a **Feed** view over the existing `activity.list`; and (6) adds **More** management screens with full create/edit/delete for Recurring rules and TaskTemplates over their existing CRUD actions.

**Technical approach**: All frontend work stays inside the decided stack (Vite + React + TS + Tailwind + shadcn/ui, TanStack Query for server state, the typed `apiCall` client). Section navigation is client-side view state lifted into `App.tsx` (no router dependency), defaulting to Calendar on every load. New read hooks (`useActivity`, `useRecurring`, `useTemplates`) and write hooks (`useSnoozeTask`/`useUnsnoozeTask`, `useUpdateEvent`, and create/update/delete for recurring + templates) follow the exact pattern already established in `useMutations.ts` (optimistic where it helps, invalidate-on-write). The one backend change adds two handlers plus a `setTaskSnooze_` helper mirroring the existing `setTaskLifecycle_` (lock, idempotent no-change, ActivityLog append), and extends `isWriteAction_`/`ACTION_VERBS` so shared-account snooze attribution and the feed verb are correct. Everything follows DESIGN.md/PRODUCT.md and passes an `/impeccable audit` before PR.

## Technical Context

**Language/Version**: TypeScript 5.x + React 18 (frontend); Google Apps Script V8 / ES2015+ (backend, one small change).

**Primary Dependencies**: Existing only — Vite, React, Tailwind, shadcn/ui (Radix primitives), TanStack Query, Google Identity Services, Schedule-X (calendar, unchanged). **No new dependencies** (constitution IV). Client-side navigation is hand-rolled view state, not a router.

**Storage**: None client-side of record — the Google Sheet remains the source of truth (constitution II). New backend writes go through the existing lock/append machinery. UI-only state (active section, owner-filter chips) is ephemeral/localStorage, never authoritative.

**Testing**: `npm run build` (tsc + Vite) with zero type errors (DoD). Vitest + React Testing Library for pure logic (task grouping/sorting by status+due, snooze-history parsing/formatting, end-before-start validation, snooze payload builder). Backend: extend `SelfTest.js` to exercise `tasks.snooze`/`tasks.unsnooze` (idempotence, snoozeHistory append, ActivityLog row, shared-account actor). Manual quickstart validation against the live deployed backend + `/impeccable audit`.

**Target Platform**: Static PWA-capable SPA on GitHub Pages. Primary: mobile browsers (375px). Secondary: desktop (~1100px content column with left rail). Backend: existing Apps Script web app (one action added, redeployed via clasp).

**Project Type**: Web application — `/frontend` (the bulk of this feature) + `/backend` (one new action + supporting helper/tests).

**Performance Goals**: Section switches feel instant (view-state swap, no full reload; queries are cached/prefetched). Check-off and snooze feel instant (optimistic). Tasks/Feed lists render smoothly for tens–low-hundreds of rows. 60fps; readable and horizontal-scroll-free at 375px.

**Constraints**: Free-tier only (constitution III) — no new paid libs/services. WCAG 2.1 AA (≥4.5:1 contrast on real backgrounds incl. owner-soft tints, 44px targets, focus rings, `prefers-reduced-motion`, focus-trapped dialogs/sheets, `aria-current` on the active nav item). Two users forever (constitution I). All dates in the household timezone from Settings; ISO 8601 in the Sheet. Backend write stays idempotent + `LockService`-wrapped + ActivityLog-logged (constitutions V/VI).

**Scale/Scope**: Two users; tens–low-hundreds of tasks/events/rules/templates. New/changed surface ≈: nav shell refactor (bottom bar + desktop rail + active-section state), Tasks view (+ grouping, task detail w/ snooze history, snooze dialog, row overflow menu), Feed view, More hub + Recurring manager + Templates manager (list/create/edit/delete each), event end-date field + new event-edit sheet, ~6 new hooks, 2 backend handlers + 1 helper + tests. Roughly 15–22 new/changed frontend files, ~1 backend file changed (+ Config/SelfTest).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Two Users Forever | ✅ Pass | No roles/tenancy/registration. Owner stays `max`/`jaz`/`both`; shared account resolves to a person on every write (including the new snooze). Nav is four fixed sections, not a configurable menu. |
| II. The Sheet Is the Source of Truth | ✅ Pass | Frontend consumes; all writes hit backend actions that own the Sheet. `snoozeHistory` is stored as a plain, hand-readable delimited string (no opaque blob) — see data-model.md. Owner-filter + active-section are disposable UI state. |
| III. Free-Tier Only | ✅ Pass | No new dependencies or services; all existing infra is free/permissive. |
| IV. Boring and Debuggable | ✅ Pass | Stays in the decided stack; navigation is plain React view state (no router lib) — the boring choice. Snooze mirrors the shipped `setTaskLifecycle_` shape rather than inventing a new pattern. Straight-line management screens reuse existing CRUD actions. |
| V. Idempotent Generation | ✅ Pass | The new `tasks.snooze`/`tasks.unsnooze` are idempotent no-change when already in the target state (mirroring complete/reopen), `LockService`-wrapped, and safe to re-send (optimistic retries tolerated). No trigger/generation code. |
| VI. Every State Change Is Logged | ✅ Pass | Snooze/un-snooze append a `snooze`/`unsnooze` ActivityLog row (timestamp, actor, action, targetId). All other writes reuse actions that already log. `ACTION_VERBS` gains `snooze`/`unsnooze` so the Feed renders them; `isWriteAction_` is extended so the shared-account actor is a real person, not null, on lifecycle writes. |
| VII. Spec-Driven Development | ✅ Pass | Follows the clarified spec on branch `012-app-shell-task-ux`; the two scope realities found during planning (no event-edit UI exists; `isWriteAction_` doesn't cover lifecycle verbs) are recorded here and in research.md, not silently shipped. |

**Gate result: PASS.** No Complexity Tracking entries required. Two planning findings to confirm at the plan-review pause: (a) US4 necessarily introduces a **new minimal event-edit sheet** because no edit UI exists yet; (b) the snooze action extends `isWriteAction_` to cover lifecycle verbs (`complete`/`reopen`/`snooze`/`unsnooze`), which also hardens the pre-existing shared-account attribution for complete/reopen (constitution VI). Both are in-spirit and small; flagged for visibility.

## Project Structure

### Documentation (this feature)

```text
specs/012-app-shell-task-ux/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (nav model, snooze write path, event-edit, snoozeHistory format, feed reuse)
├── data-model.md        # Phase 1 — frontend view models + snoozeHistory encoding + task grouping rules
├── quickstart.md        # Phase 1 — end-to-end validation scenarios (against live backend)
├── contracts/
│   └── api-tasks-snooze.md   # Phase 1 — the one new backend contract (tasks.snooze / tasks.unsnooze) + reused actions map
├── checklists/
│   └── requirements.md  # spec quality checklist (from /speckit.specify)
└── tasks.md             # Phase 2 — /speckit.tasks output (NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── App.tsx                         # CHANGED: hold active-section state; render section by key; land on Calendar
│   ├── components/
│   │   ├── shell/
│   │   │   ├── AppShell.tsx             # CHANGED: bottom tab bar (mobile) + left sidebar rail (desktop); active-section props; aria-current
│   │   │   └── NavItems.ts              # NEW (opt): shared nav definition used by both bar + rail
│   │   ├── task/
│   │   │   ├── TaskRow.tsx              # CHANGED: add overflow menu (snooze / edit-due); reuse existing check-off
│   │   │   ├── TasksView.tsx           # NEW: all tasks, grouped Open(by due, overdue first)→collapsed Done, owner-filter aware
│   │   │   ├── TaskDetailSheet.tsx     # NEW: task detail incl. readable snooze history
│   │   │   └── SnoozeDialog.tsx        # NEW: pick a later date (presets + date picker) → snooze
│   │   ├── feed/
│   │   │   └── FeedView.tsx            # NEW: reverse-chron activity list (empty state)
│   │   ├── more/
│   │   │   ├── MoreView.tsx            # NEW: hub linking to Recurring + Templates managers (+ sign-out/info)
│   │   │   ├── RecurringManager.tsx    # NEW: list/create/edit/delete recurring rules
│   │   │   └── TemplatesManager.tsx    # NEW: list/create/edit/delete prep templates
│   │   └── event/
│   │       ├── QuickAddSheet.tsx        # CHANGED: add optional end date/time to the event path; end-before-start guard
│   │       ├── EventEditSheet.tsx      # NEW: minimal edit form (title/start/END/owner) via events.update
│   │       └── EventDetailSheet.tsx    # CHANGED: add an "Edit" affordance opening EventEditSheet
│   ├── hooks/
│   │   ├── useActivity.ts              # NEW: activity.list
│   │   ├── useRecurring.ts             # NEW: recurring.list
│   │   ├── useTemplates.ts             # NEW: templates.list
│   │   └── useMutations.ts             # CHANGED: add useSnoozeTask/useUnsnoozeTask, useUpdateEvent, recurring & template create/update/delete
│   └── lib/
│       ├── tasks.ts                    # NEW: pure grouping/sort + snoozeHistory parse/format helpers (+ tests)
│       └── quickAdd.ts                 # CHANGED (maybe): end handling already supports end; extend edit payload builder
└── (existing config unchanged)

backend/
├── Api.js        # CHANGED: register 'tasks.snooze' / 'tasks.unsnooze' handlers
├── Sheets.js     # CHANGED: add setTaskSnooze_ helper (lock, idempotent, snoozeHistory + ActivityLog append)
├── Config.js     # CHANGED: ACTION_VERBS += snooze/unsnooze; isWriteAction_ covers lifecycle verbs
└── SelfTest.js   # CHANGED: cover snooze/unsnooze (idempotence, history append, log row, shared-account actor)
```

**Structure Decision**: Web application. The overwhelming majority is frontend under `/frontend/src` (new `feed/` and `more/` component groups; expanded `task/` and `event/` groups; a small `lib/tasks.ts` for pure, unit-tested logic). The single backend touch adds one idempotent action following the existing `setTaskLifecycle_` template. No new top-level directories; no router library.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
