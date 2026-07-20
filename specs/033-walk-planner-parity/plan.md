# Implementation Plan: Dog-Walk Planner Rework, Dashboard↔Calendar Parity & Household Notifications

**Branch**: `033-walk-planner-parity` | **Date**: 2026-07-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/033-walk-planner-parity/spec.md`

## Summary

Three strands, one feature:

1. **Dashboard task completion (US1)** — `TaskDetailSheet` gains a mark-done/reopen
   action and `DayPeekPanel` task rows gain the same complete toggle `TaskRow` already
   has. (Overdue/Weekend sections already render `TaskRow` and therefore already
   complete correctly — the broken surfaces are exactly the day card's bespoke rows
   and the detail sheet.)
2. **Household notifications (US2, US3)** — a new backend `Notify.js` mirroring
   `Digests.js`'s trigger + ActivityLog-dedupe pattern: a morning overdue-summary push
   and an evening next-day-walk push, both to BOTH people over the existing 010 web-push
   channel, times in two new Settings keys, deep links carried in the push URL.
3. **Walk parity & planner rework (US4–US7) + Lists polish (US8, US9)** — walks appear
   in all four calendar views and open the planner; deep links survive lazy mount
   (consume-on-mount callback, the `MoreView` pattern); planner gets visible selection,
   pinned confirm, 15-min starts, duration + backup-slot booking, compressed timeline,
   human status copy; walk notices get date-aware calm copy; calendar gets title-first
   pills, owner-colored month dots, collapsed done tasks, labeled map link, single view
   switcher; list pills get needed counts; the remaining iOS focus-zoom offenders
   (Tailwind text-size utilities out-specifying the 16px coarse-pointer rule) are fixed
   app-wide.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend, Vite + React 18); Apps Script V8 ES2015+ (backend, dependency-free)

**Primary Dependencies**: React 18, TanStack Query, Tailwind + shadcn/ui, Schedule-X (calendar), Temporal polyfill; backend: none (Apps Script services only)

**Storage**: one Google Sheet (tabs as tables). No new tabs. Notification dedupe rides ActivityLog (the Digests `alreadySent_` pattern); two new Settings keys (`morningOverduePushHour`, `eveningWalkPushHour`)

**Testing**: Vitest + Testing Library (frontend, 499 baseline); `SelfTest.js` chunked live suites via `clasp run` (backend)

**Target Platform**: GitHub Pages PWA (mobile-first, installed on both iPhones) + Apps Script web app / time-driven triggers

**Project Type**: web (frontend + backend split per repo layout)

**Performance Goals**: no regressions to 030's one-bootstrap cold load; planner interactions perceived-instant (optimistic patterns already in place)

**Constraints**: Apps Script 6-min execution cap; push fan-out must never throw (`sendPushToPerson_` guarantee); no URL routing (sheet-level history only, audit F-26 resolved); planner hour band ends 17:00 (resolved); WCAG 2.1 AA; pinch-zoom must stay enabled (F-39)

**Scale/Scope**: 2 users, ~15 findings + 5 asks; est. ~20 frontend files touched, 1 new backend file, 2 Settings keys, 2 new triggers

## Constitution Check

*GATE: evaluated pre-research and re-checked post-design — PASS (no violations).*

| Principle | Check |
|---|---|
| I. Two users forever | Pushes fan out to exactly `max` + `jaz`; no new roles/tenancy. PASS |
| II. Sheet is source of truth | No new tabs; new Settings keys are plain hand-editable values; dedupe rows are ordinary ActivityLog rows. PASS |
| III. Free-tier only | Web push (existing, free), Apps Script triggers (existing quota: 2 new daily triggers, well under limits). PASS |
| IV. Boring & debuggable | `Notify.js` copies `Digests.js`'s proven trigger/dedupe/gate shape; frontend reuses existing hooks/patterns (consume-on-mount, `useUndoableMutation`, `TaskRow` toggle). PASS |
| V. Idempotent generation | Both sends gated by ActivityLog natural key under `LockService` (same as digest `sendOne_`); trigger installers delete-then-create. PASS |
| VI. Every state change logged | Each push send appends a log row (doubles as the dedupe key); completions/bookings already log. PASS |
| VII. Spec-driven | This folder. PASS |

**Post-design re-check (Phase 1)**: no new violations introduced by the design
artifacts; the notification ledger deliberately reuses ActivityLog rather than a new
tab (II, IV), and the planner API needs no backend change beyond none-at-all for
booking (bookWalkManually_ already accepts arbitrary windows — F-07 is frontend-only).

## Project Structure

### Documentation (this feature)

```text
specs/033-walk-planner-parity/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── notify-triggers.md   # Trigger contract: morning/evening push runs
│   └── deeplink-urls.md     # Push/deep-link URL param contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by plan)
```

### Source Code (repository root)

```text
backend/
├── Notify.js                    # NEW — morning overdue + evening walk pushes, installers
├── Config.js                    # + morningOverduePushHour / eveningWalkPushHour defaults,
│                                #   EDITABLE_SETTINGS additions
├── Api.js                       # settings.update reinstall hook for the two new hour keys
├── Push.js                      # (reuse sendPushToPerson_ as-is; no change expected)
├── DogWalk.js                   # (no change expected — booking API already sufficient)
└── SelfTest.js                  # + notify gate/content suites (no real sends)

frontend/src/
├── App.tsx                      # deep-link params (walk/overdue), app-level planner host,
│                                #   focusDate consume-on-mount handoff
├── lib/
│   ├── deeplink.ts              # parse ?walk=<ymd> / ?overdue=1 alongside ?task=
│   ├── dogwalks.ts              # notice grouping/urgency selectors (F-10)
│   ├── lists.ts                 # neededCountByList selector (US8)
│   └── dashboard.ts             # (overdue def reused by backend spec — no change)
├── components/
│   ├── task/TaskDetailSheet.tsx     # + Mark done / Reopen action (US1)
│   ├── dashboard/DayPeekPanel.tsx   # + complete toggle on task rows (US1)
│   ├── dashboard/DogWalkNotice.tsx  # date-aware copy, collapse, urgency tiers (F-10)
│   ├── dashboard/DogWalkPlanner.tsx # selection, pinned confirm, 15-min/duration/backup,
│   │                                #   compressed timeline, status copy, sheet history
│   ├── dashboard/DashboardHome.tsx  # planner state lifted to App; today walk line stays
│   ├── calendar/CalendarHome.tsx    # focusDate consume-on-mount; walk tap→planner;
│   │                                #   single view switcher (F-11)
│   ├── calendar/DayListView.tsx     # + walk items in buckets (F-03); done-collapse (F-16)
│   ├── calendar/DayColumn.tsx       # + walk items, tappable (F-03)
│   ├── calendar/EventContent.tsx    # title-priority layout (F-05); walk chips clickable (F-02)
│   ├── calendar/calendar-theme.css  # month-dot owner colors (F-12), header control cleanup
│   ├── event/EventDetailSheet.tsx   # "Open map ↗" label; Delete separated (F-16)
│   └── lists/ListsView.tsx          # pill needed-counts (US8)
├── index.css                    # coarse-pointer 16px rule made specificity-proof (US9)
└── public/sw.js                 # (no change — passes URL through; params handled in-app)
```

**Structure Decision**: existing two-project layout (`/frontend`, `/backend`); one new
backend file (`Notify.js`), no new frontend top-level directories.

## Complexity Tracking

No constitution violations to justify.
