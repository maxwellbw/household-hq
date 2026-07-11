# Implementation Plan: Calendar views & 7-day surfaces

**Branch**: `017-calendar-views` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/017-calendar-views/spec.md`

## Summary

A presentation-only, **frontend-only** feature over data that already exists. It adds two focused calendar horizons (a fixed Sun–Sat week and a rolling next-7-days), both rendered as **all-day day-list columns** (not hourly time-grids); makes the week start Sunday everywhere; fixes mobile month navigation; de-clutters the desktop month grid via Schedule-X's built-in per-day event cap with a "+N more" that jumps to that day; shows event prep-task progress as "M/N tasks" on chips; surfaces overdue open tasks on **today** (display-only, no stored-date rewrite); and adds a rolling 7-day strip to the dashboard that deep-links into the calendar. No backend, Sheet, trigger, or stored-field changes.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19

**Primary Dependencies**: Vite 8, Tailwind 3.4, `@schedule-x/calendar` + `@schedule-x/react` ^4.6, `temporal-polyfill` ^1.0. No new dependencies.

**Storage**: None added. Reads existing Events + Tasks via the current JSON API (`useEvents`, `useTasks`, `useSettings`). No writes.

**Testing**: Vitest 4 + @testing-library/react (unit + component). 150 tests green at baseline (post-016).

**Target Platform**: PWA (GitHub Pages) — desktop + mobile browsers. Household timezone from Settings.

**Project Type**: Web frontend (`/frontend`); backend untouched.

**Performance Goals**: Interaction-time view switching (no network round-trip; all derivations are in-memory over already-fetched data). 60fps scroll on the month grid.

**Constraints**: WCAG 2.1 AA; owner color coding is identity; reuse existing chip styling (`EventContent`) and owner tokens; no new calendar library.

**Scale/Scope**: Two users; a household's worth of events/tasks (tens per month). ~6 UI slices (US1–US7), all client-side.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Two Users Forever** — ✅ No roles/tenancy touched; owner stays `max`/`jaz`/`both`.
- **II. The Sheet Is the Source of Truth** — ✅ Read-only feature; no new fields, no shadow state. Overdue is a **derived** display classification, never persisted (FR-013).
- **III. Free-Tier Only** — ✅ No new services; pure client rendering.
- **IV. Boring and Debuggable** — ✅ Bespoke week/next-7 views are straight-line React day-list columns reusing `EventContent`; month grid uses Schedule-X's documented `firstDayOfWeek` / `monthGridOptions` config. No new abstraction layer. (Rationale for building our own day-list rather than bending Schedule-X's hourly week view is in research R1 — the boring choice given all-day household data and 013's Schedule-X-internals fragility.)
- **V. Idempotent Generation** — ✅ N/A (no generation/writes).
- **VI. Every State Change Is Logged** — ✅ N/A (no state changes; completing an overdue task uses the existing logged mutation path unchanged).
- **VII. Spec-Driven Development** — ✅ On branch `017-calendar-views`; spec + clarify complete.

**Result: PASS — no violations, Complexity Tracking not required.**

Post-Design re-check (after Phase 1): **PASS** — design introduces only React components and pure helpers; no constitutional surface changed.

## Project Structure

### Documentation (this feature)

```text
specs/017-calendar-views/
├── plan.md              # This file
├── spec.md              # Feature spec (+ Clarifications)
├── research.md          # Phase 0 — decisions R1–R7
├── data-model.md        # Phase 1 — derived view-models (no stored entities)
├── quickstart.md        # Phase 1 — manual validation scenarios
├── contracts/
│   └── ui-contract.md    # Phase 1 — component props / interaction contracts
└── checklists/
    └── requirements.md   # Spec quality checklist (from /speckit-specify)
```

### Source Code (repository root)

```text
frontend/src/
├── components/
│   ├── calendar/
│   │   ├── CalendarHome.tsx          # MODIFY: firstDayOfWeek=7, monthGridOptions cap +
│   │   │                             #   onClickPlusEvents, view-mode state, focusDate prop,
│   │   │                             #   overdue injection into scheduleXEvents
│   │   ├── CalendarViewSwitcher.tsx  # NEW: month / week / next-7 toggle (mobile + desktop)
│   │   ├── DayListView.tsx           # NEW: renders N day-columns of chips (week / next-7 / single-day)
│   │   ├── DayColumn.tsx             # NEW: one day's header + owner-colored chips (reuses EventContent styling)
│   │   ├── EventContent.tsx          # MODIFY: "M/N tasks" prep progress; overdue badge on task chips
│   │   └── calendar-theme.css        # MODIFY: mobile month prev/next visibility + month scroll
│   └── dashboard/
│       ├── DashboardHome.tsx         # MODIFY: render SevenDayStrip; lift day-tap to open calendar
│       └── SevenDayStrip.tsx         # NEW: 7 day-tiles, owner dots/counts, tap → calendar date
├── lib/
│   ├── datetime.ts                   # MODIFY/ADD: nextNDaysRange, isOverdue, dayList helpers (Sunday-based)
│   ├── tether.ts                     # MODIFY: expose doneTaskCount/totalTaskCount on EventWithTasks
│   └── calendarModel.ts (or inline)  # ADD: overdue-onto-today mapping helper (pure, unit-tested)
└── App.tsx                           # MODIFY: calendarFocusDate state; Dashboard→Calendar deep-link
```

**Structure Decision**: Single existing `/frontend` Vite app. Month + month-agenda stay on Schedule-X (configured for Sunday-start and per-day capping); the two new week horizons and the "+N more" day-focus are bespoke React `DayListView`/`DayColumn` components fed by the same in-memory model, toggled by a new `CalendarViewSwitcher` that works on both breakpoints.

## Complexity Tracking

> No constitutional violations — table intentionally empty.
