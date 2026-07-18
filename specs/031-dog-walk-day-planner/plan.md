# Implementation Plan: Dog-Walk Day Planner

**Branch**: `031-dog-walk-day-planner` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-dog-walk-day-planner/spec.md`

## Summary

Feature 011's dog-walk finder works but is opaque and, as of 2026-07-18, unreliable: a
rate-limited Open-Meteo fetch deferred every day in the horizon and booked nothing. This
feature does three things, in dependency order.

**US1 — forecast resilience.** Add a durable forecast cache in script properties, fall back
to it when a live fetch fails, and replace the flat 500ms retry (which put all three
attempts inside one second) with a schedule that distinguishes HTTP 429 and backs off
across minutes. Critically, the cache is warmed by paths *other than* the nightly finder
trigger — because the finder trigger is exactly what gets rate-limited, a cache it alone
populates would be empty precisely when needed. Ships alone as a bug fix with no UI.

**US2 — the planner view.** A per-day panel showing merged busy blocks, hourly weather with
each of the four gates marked pass/fail, and the candidate windows with the chosen one
flagged. The response is assembled server-side from the engine's own functions, so the
planner cannot drift from what the nightly run decides.

**US3 — booking from the app.** Book into any window (including one the finder rejected,
after naming the failure and taking an explicit confirmation) or remove a walk, routed
through the existing idempotent booking path. A new `decidedBy` column marks the row as
user-owned and freezes it against automatic runs, with a release affordance to hand it back.

## Technical Context

**Language/Version**: Apps Script (V8, ES2015+) backend; TypeScript 5 / React 18 frontend

**Primary Dependencies**: Backend dependency-free (Principle IV). Frontend: existing Vite +
React + Tailwind + shadcn/ui. No new packages.

**Storage**: Google Sheet (DogWalks tab, +1 column) + `PropertiesService` script properties
(forecast cache — explicitly not a Sheet tab, see research R2)

**Testing**: `backend/SelfTest.js` (`selfTestDogWalk`, extended); Vitest for frontend

**Target Platform**: Apps Script web app + GitHub Pages PWA (mobile-first)

**Project Type**: Web application — `/backend` (Apps Script) + `/frontend` (Vite)

**Performance Goals**: `dogwalks.day` responds in under ~3s warm (one calendar read for one
day plus a cached forecast); planner opens without blocking the calendar view

**Constraints**: 6-minute Apps Script execution limit (bounds the retry schedule to ~195s
of sleeping); ~9KB per script-property value (bounds the cache encoding); Open-Meteo
keyless free tier and its per-IP rate limit

**Scale/Scope**: Two users, ~14-day horizon, ~10 walk-eligible hours/day. 1 new Sheet
column, 4 new API actions, 1 new trigger, ~2 frontend components.

## Constitution Check

*GATE: evaluated before Phase 0 and re-evaluated after Phase 1 design.*

| Principle | Pre-Phase 0 | Post-Phase 1 | Notes |
|---|---|---|---|
| I — Two users forever | PASS | PASS | `decidedBy` holds `max`/`jaz` — the existing two-value vocabulary. No roles, no permissions. |
| II — The Sheet is the source of truth | PASS | PASS | Cache lives in script properties, not a Sheet tab, and is disposable. `decidedBy` is plain hand-editable text; clearing the cell is a supported way to release a day. |
| III — Free-tier only | PASS | PASS | Open-Meteo stays keyless and free. Net request volume falls (cache reuse) rather than rising. |
| IV — Boring and debuggable | PASS | PASS | One cache mechanism, one column, four endpoints on the existing dispatch pattern. The planner composes engine functions instead of growing a parallel implementation. |
| V — Idempotent generation | PASS | PASS | Booking reuses `bookOrReconcileWalk_` and inherits its idempotency and `withLock_`. The warm trigger only overwrites one key. |
| VI — Every state change is logged | PASS | PASS | `book`/`unbook`/`release` each append to ActivityLog with the acting person. Cache writes are not household state and are not logged. |
| VII — Spec-driven development | PASS | PASS | Spec, research, data model, contracts, quickstart all precede implementation. |

**Result: no violations.** Complexity Tracking is empty.

One CLAUDE.md gotcha applies directly: `warmForecastCache` is a **trigger handler**, so it
must have **no trailing underscore** or the trigger silently never fires. The self-test must
exercise the public entry point, not just its inner helper — this is the exact failure mode
recorded from feature 004.

## Project Structure

### Documentation (this feature)

```text
specs/031-dog-walk-day-planner/
├── plan.md                              # This file
├── spec.md                              # Feature specification
├── research.md                          # Phase 0 — R1 (429 root cause) … R7
├── data-model.md                        # Phase 1 — DogWalks column, forecast cache
├── contracts/
│   └── dogwalks-planner-api.md          # Phase 1 — 4 actions + engine changes
├── quickstart.md                        # Phase 1 — live validation
├── checklists/requirements.md
└── tasks.md                             # Phase 2 (/speckit.tasks — not created here)
```

### Source code

```text
backend/
├── DogWalk.js       # CHANGED — cache helpers, backoff, warmForecastCache,
│                    #   isFrozen_, buildDayPlan_, manual book/unbook/release
├── Config.js        # CHANGED — DogWalks headers +decidedBy, trigger hours,
│                    #   backoff constants, cache key
├── Api.js           # CHANGED — 4 new handlers
├── Setup.js         # unchanged — migrateHeaders_ already handles the added column
└── SelfTest.js      # CHANGED — cache, backoff, freeze, day-plan, booking tests

frontend/src/
├── components/dashboard/
│   ├── DayPeekPanel.tsx        # CHANGED — entry point into the planner
│   └── DogWalkPlanner.tsx      # NEW — the day timeline: busy blocks,
│                               #   weather strip, candidate windows, book/unbook
├── hooks/useDogWalks.ts        # CHANGED — day fetch + book/unbook/release
├── lib/dogwalks.ts             # CHANGED — types and helpers for the day payload
└── types/domain.ts             # CHANGED — DogWalk +decidedBy, day-plan types
```

**Structure Decision**: The existing two-part layout is unchanged. The planner attaches to
the calendar day surfaces (`DayPeekPanel`) rather than becoming a new top-level destination,
keeping the calendar as the organizing metaphor (PRODUCT.md, research R7).

## Phased delivery

Each phase is independently shippable and independently testable, matching the spec's
priority order.

| Phase | Story | Deliverable | Proves |
|---|---|---|---|
| 1 | US1 (P1) | Cache + backoff + warm trigger + trigger-hour move | A rate-limited nightly run still books days. No UI. |
| 2 | US2 (P2) | `dogwalks.day` + planner panel, read-only | A user can see why a day got the window it did. |
| 3 | US3 (P3) | `decidedBy` + book/unbook/release | A user can override the finder, and the override survives. |

Phase 1 is deliberately first and self-contained: it is the live bug, it needs no frontend
work, and every later phase reads forecasts far more often than once nightly.

## Risks

| Risk | Mitigation |
|---|---|
| R1's root cause is not the shared-IP hypothesis, so the fix misses | Every mitigation is correct under all candidate causes (research R1). Non-200 body logging makes the next occurrence diagnosable at zero extra cost. |
| The warm trigger is rate-limited too — it is also a trigger | Different hour, so an independent draw; plus the planner's interactive fetches (Phase 2) warm the cache from the path already observed to work. Two of three writers are non-trigger once Phase 2 lands. |
| Cache encoding exceeds the ~9KB property ceiling | Trimmed to the reliable horizon and walk-eligible hours (~3.5KB). Writer asserts size and sheds furthest-out days first, logging when it does. |
| Booking from the app diverges from automatic booking | It calls the same `bookOrReconcileWalk_` path rather than a parallel one — divergence would require deliberately bypassing it. |
| Planner reasoning drifts from the engine's | `buildDayPlan_` composes `computeAvailability_`/gate checks/`selectWindow_`; no gate or selection logic is reimplemented, and none lives in the frontend. |
| A stale cache silently books bad walks | 24-hour usability limit (FR-006), coordinates checked, and the planner labels cached weather with its age. |

## Complexity Tracking

No constitution violations. Table intentionally empty.
