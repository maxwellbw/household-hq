# Implementation Plan: Bug-fix batch 4

**Branch**: `029-bug-fix-batch-4` | **Date**: 2026-07-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/029-bug-fix-batch-4/spec.md`

## Summary

Seven independent, bounded fixes surfaced by real-device use, implemented within the existing stack (no new architecture, no Sheet schema change, no new OAuth scope, no new external service). Six are frontend-only; one (walk-trigger reliability) is a backend forecast-fetch robustness fix. Root causes for all seven are pinned in [research.md](research.md); the only item needing live in-browser reproduction to finalize its exact patch is the calendar flash (US7), which the dev-session token now makes possible in the sandbox.

## Technical Context

**Language/Version**: TypeScript 5 (Vite + React 18 frontend); Google Apps Script V8 (ES2015+) backend.
**Primary Dependencies**: React, @tanstack/react-query v5, @schedule-x/react + @schedule-x/calendar, Tailwind, temporal-polyfill (frontend); no backend deps (Apps Script built-ins only).
**Storage**: One Google Sheet (Events, Tasks, TaskTemplates, DogWalks, Settings, ActivityLog). No schema change this feature.
**Testing**: Vitest (frontend, `npm test`); Apps Script `selfTest*` chunk runners via `clasp run` (backend).
**Target Platform**: Installable PWA (iOS Safari / Chrome), GitHub Pages; Apps Script web app deployment.
**Project Type**: Web application (frontend + Apps Script backend).
**Performance Goals**: No visible full-calendar flash on background refetch; forecast fetch resilient to transient failure within the 6-min Apps Script cap.
**Constraints**: Free-tier only; idempotent triggers; every state change logged to ActivityLog; single household timezone from Settings; two users forever.
**Scale/Scope**: 2 users; ~7 small diffs across ~10 files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Two Users Forever** — ✅ No tenancy/roles/scale introduced. Notice dismissals stay per-device.
- **II. The Sheet Is the Source of Truth** — ✅ No schema change. Prep-template picker writes only the existing `Event.templateId`; walks/notices read existing tabs.
- **III. Free-Tier Only** — ✅ No new services. Forecast retry stays within Open-Meteo keyless free use and the Apps Script execution budget.
- **IV. Boring and Debuggable** — ✅ Each fix is a small, local, well-understood change; the forecast fix adds clearer logging (aids debugging).
- **V. Idempotent Generation** — ✅ Prep-template attachment reuses the already-idempotent `syncPrepForEvent_` (keyed `prepTaskId_`); the finder's idempotency is preserved (a deferred day fills with no dup on a later run).
- **VI. Every State Change Is Logged** — ✅ The one write path (attaching template tasks on event create/edit) already appends ActivityLog via existing `createEvent_`/`updateEvent_`/prep sync. Read-only surfacing (walks in day peek, strikethrough, dismissals, calendar flash) makes no writes.
- **VII. Spec-Driven Development** — ✅ spec → clarify → plan → tasks chain followed on branch `029-bug-fix-batch-4`.

**Result: PASS** (no violations, no Complexity Tracking entries needed). Re-checked post-design below.

## Project Structure

### Documentation (this feature)

```text
specs/029-bug-fix-batch-4/
├── plan.md              # This file
├── research.md          # Phase 0: root cause + fix approach per bug
├── quickstart.md        # Phase 1: per-story live validation steps
├── data-model.md        # Phase 1: no schema change (documents affected entities only)
├── contracts/           # Phase 1: no new/changed API contract (see contracts/README.md)
└── checklists/requirements.md   # from /speckit-specify
```

### Source Code (repository root)

```text
frontend/src/
├── components/
│   ├── dashboard/
│   │   ├── DayPeekPanel.tsx        # US1: add dog-walk rows w/ time window
│   │   ├── DogWalkNotice.tsx       # US3: read persisted isDismissed()
│   │   └── AckNotices.tsx          # US3: read persisted isDismissed() (belt-and-suspenders)
│   ├── task/
│   │   └── TaskDetailSheet.tsx     # US2: strike done title
│   ├── calendar/
│   │   ├── EventContent.tsx        # US2: strike done task chips
│   │   └── CalendarHome.tsx        # US7: stop full re-render/flash on refetch
│   ├── quickadd/QuickAddSheet.tsx  # US5: prep-template picker (event branch)
│   ├── event/EventEditSheet.tsx    # US5: prep-template picker (edit)
│   └── ... (all sheets/dialogs)    # US4: adopt scroll-lock via useDialogA11y
├── hooks/
│   ├── useDialogA11y.ts            # US4: add ref-counted scroll lock + guaranteed restore
│   └── useTemplates.ts             # US5: reuse existing hook for the picker
├── lib/
│   ├── dashboard.ts / dogwalks.ts  # US1: selector to pick a day's walks
│   └── dogWalkDismissals.ts        # US3: already exports isDismissed (wire it in)
backend/
└── DogWalk.js                      # US6: fetchForecast_ retry + diagnostic logging
```

**Structure decision**: Existing web-app layout; changes are surgical edits to the files above, no new modules beyond possibly one small day-peek walk selector in `lib/`.

## Phase 0: Research

See [research.md](research.md). Every item's root cause is resolved (no open NEEDS CLARIFICATION). Summary of decisions:

1. **Walks in day peek (US1, P1)** — Pass `useDogWalks()` data into `DayPeekPanel`; add a `walksForDay(dateKey)` selector; render a walk row (owner-`both` styling, ⚠️ for needs-decision) with its `windowStart–windowEnd` time. Read-only.
2. **Done strikethrough (US2, P1)** — `TaskRow` and `DayPeekPanel` already strike done; add the same `line-through text-ink-faint` treatment to `TaskDetailSheet` title and to `EventContent` when `_kind==='task'` and the raw task is done.
3. **Dismissals (US3, P2)** — `DogWalkNotice` never reads persisted `isDismissed()` (only in-memory session state, lost on remount/refetch). Fix: filter against `isDismissed(key) || sessionSet` in both notice components (and/or a `dogWalkNotices` selector mirroring `ackNotices`), so dismissal survives refetch and reload; keys stay stable per unchanged item.
4. **Scroll lock (US4, P2)** — No body/main scroll lock exists today; sheets are bare `fixed inset-0` overlays (background scrolls behind them, and an intermittent stuck-scroll is unrecoverable without reload). Fix: add a **ref-counted** scroll lock to `useDialogA11y` (shared by all sheets/dialogs) that locks the `<main>` scroll container on open and **always** restores on cleanup, correct under nested sheets and rapid open/close.
5. **Prep-template picker (US5, P2)** — Backend already complete (`templates.list`, `Event.templateId`, idempotent `syncPrepForEvent_` on create+update). Frontend-only: add a template `<select>` (distinct `eventType` from `useTemplates()`) to the event create (`QuickAddSheet`) and edit (`EventEditSheet`) forms, sending `templateId`.
6. **Walk-trigger reliability (US6, P3)** — `fetchForecast_` collapses every failure into bare `null` with no retry and no diagnostics; a transient hiccup under the nightly trigger defers the whole run while a manual retry succeeds. Fix: retry the fetch (small bounded backoff) and log the distinct failure mode (unset coords vs. non-200 vs. exception). Finder stays idempotent; installer unchanged.
7. **Calendar flash (US7, P3)** — `CalendarHome` re-renders on every background refetch (`dataUpdatedAt` bump + query arrays) and re-seeds the whole Schedule-X event collection. Fix: stabilize the calendar app / gate `events.set()` behind an actual content-change signature so unchanged refetches don't re-render all chips; confirm React Query structural sharing keeps unchanged data referentially stable. **Exact patch confirmed by live reproduction in the browser preview** (dev-session token).

## Phase 1: Design & Contracts

- **data-model.md** — No schema change. Documents the (existing) entities touched read-only or via existing writes: DogWalk, Task, TaskTemplate/prep, and the per-device dismissal store. See [data-model.md](data-model.md).
- **contracts/** — No new or changed API action. US5 reuses existing `templates.list`, `events.create`, `events.update`. See [contracts/README.md](contracts/README.md).
- **quickstart.md** — Per-story live validation (browser via dev token for FE; `clasp run` self-test for the forecast fix). See [quickstart.md](quickstart.md).

### Post-Design Constitution Re-check

Re-evaluated after the design above: still **PASS**. No new abstractions, no schema/scope/service changes, idempotency and ActivityLog obligations satisfied by reusing existing write paths. No Complexity Tracking required.

## Complexity Tracking

*No entries — no constitution deviations.*
