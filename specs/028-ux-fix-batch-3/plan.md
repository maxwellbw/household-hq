# Implementation Plan: UX Fix Batch 3

**Branch**: `028-ux-fix-batch-3` | **Date**: 2026-07-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/028-ux-fix-batch-3/spec.md`

## Summary

Eight pre-clarified fixes from the first real-device use after the 027 seed. Backend:
per-cadence generation windows so annual recurring events (`annually`,
`thanksgiving-sat`) materialize 366 days ahead while everything else keeps 60
(RecurringEvents.js + one new Settings key), and the over-limit `selfTest()` monolith
regrouped into four public chunked runners. Frontend: optimistic create/edit for tasks
and events using client-minted UUIDs (the backend's existing id-replay makes this
duplicate-proof — no temp-id reconciliation), viewport zoom lock + safe-area bottom nav,
an inline day-peek panel under the dashboard's 7-day strip, snoozed tasks included on
that strip, and a redesign of the acknowledge presentation. Full detail: [research.md](research.md) R1–R8.

## Technical Context

**Language/Version**: Backend — Google Apps Script (V8, ES2015+, dependency-free).
Frontend — TypeScript 5 / React 18 / Vite.

**Primary Dependencies**: Frontend: Tailwind, shadcn/ui-style components, TanStack
React Query (optimistic-mutation pattern already in `useMutations.ts`), Temporal
polyfill (`lib/datetime`). Backend: none (constitution IV).

**Storage**: One Google Sheet, tabs as tables. **This feature adds no tabs/columns** —
one new Settings key (`recurringEventsYearlyLookaheadDays`, default 366) seeded by
`setupDatabase()`. See [data-model.md](data-model.md).

**Testing**: Frontend vitest (+ Testing Library) — currently 322 green; backend
`SelfTest.js` run from the Apps Script editor (this feature splits it into 4 chunks).

**Target Platform**: GitHub Pages PWA-to-be (iPhone Safari is the device that filed this
batch) + Apps Script web app.

**Project Type**: Web app — `/frontend` + `/backend` (established).

**Performance Goals**: Create/edit returns control <0.3 s perceived (SC-002); each
self-test chunk <~4 min (SC-007).

**Constraints**: Apps Script 6-minute execution limit (the direct cause of item 8);
whole-tab batch reads; idempotent generators (constitution V); WCAG 2.1 AA + 44px touch
floor for all UI work; no new OAuth scopes.

**Scale/Scope**: Two users forever. ~13 extra mirrored all-day events/year from the wide
window; six frontend surfaces touched; zero new API actions.

## Constitution Check

*GATE: evaluated pre-research and re-evaluated post-design — PASS (no violations).*

- **I. Two Users Forever** — no roles/tenancy; owner model untouched. PASS.
- **II. Sheet Is Source of Truth** — no schema change; one hand-editable Settings key;
  client-minted ids are `crypto.randomUUID()` UUIDs (ids stay position-independent);
  optimistic cache is display-only, reconciled to the Sheet on settle (no shadow truth —
  server state wins at `onSettled` invalidation). PASS.
- **III. Free-Tier Only** — nothing new. PASS.
- **IV. Boring and Debuggable** — no new dependencies; self-test split is a flat
  regrouping (resumable-runner cleverness explicitly rejected, research R8); optimistic
  writes reuse the exact existing `onMutate/onError/onSettled` house pattern. PASS.
- **V. Idempotent Generation** — wider window rides on deterministic occurrence ids +
  watermark (research R1); client-id creates are idempotent by replay. PASS.
- **VI. Every State Change Logged** — no write paths added or bypassed; id-replay
  correctly logs nothing (nothing changed). PASS.
- **VII. Spec-Driven** — this folder; deviations write back here. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/028-ux-fix-batch-3/
├── plan.md              # This file
├── research.md          # R1–R8 (all decisions + rationale)
├── data-model.md        # One Settings key; no schema changes
├── quickstart.md        # Live validation §A–§H
├── contracts/api.md     # No new actions; client-id contract + generator behavior
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks output
```

### Source Code (repository root)

```text
backend/
├── Config.js                    # RECURRING_EVENTS_YEARLY_LOOKAHEAD_DEFAULT_DAYS + Settings seed row
├── RecurringEvents.js           # per-cadence windowEnd in generateRecurringEvents()
├── Setup.js                     # (only if Settings seeding lives here — follow existing pattern)
└── SelfTest.js                  # selfTest() → guard; selfTest1Core()…selfTest4CalendarAndComms()

frontend/
├── index.html                   # viewport meta: maximum-scale, user-scalable=no, viewport-fit=cover
└── src/
    ├── index.css                # touch-action; 16px coarse-pointer form controls; safe-area utilities
    ├── lib/
    │   ├── dashboard.ts         # sevenDayTiles snoozed inclusion; new itemsForDay() selector
    │   └── quickAdd.ts          # payload builders accept/carry client-minted id
    ├── hooks/useMutations.ts    # optimistic create/edit (tasks + events)
    └── components/
        ├── shell/AppShell.tsx   # nav + main + FAB safe-area offsets
        ├── quickadd/QuickAddSheet.tsx      # close-on-mutate save flow
        ├── task/{TaskRow,TaskDetailSheet,TaskEditSheet}.tsx  # ack redesign; edit save flow
        ├── event/…EditSheet     # event edit save flow
        └── dashboard/
            ├── DashboardHome.tsx    # peekDateKey state, panel wiring
            ├── SevenDayStrip.tsx    # tap = toggle peek; aria-expanded
            ├── DayPeekPanel.tsx     # NEW — inline day panel + open-in-calendar link
            └── AckNotices.tsx       # ack redesign surface
```

**Structure Decision**: Existing two-package layout; one new frontend component
(`DayPeekPanel.tsx`), zero new backend files.

## Implementation notes (how, per user story)

- **US1 (yearly window)** — research R1. `generateRecurringEvents()` computes
  `windowEnd` per rule from cadence class; `generateForEventRule_` unchanged apart from
  receiving it. New Config fallback + `setupDatabase()` Settings seed. Self-test: extend
  the recurring-event generation suite with an annual rule >60d out (chunk 2).
  Post-deploy backfill = one editor run (quickstart §B).
- **US2 (instant saves)** — research R2. `buildOneTimeTaskPayload`/`buildEventPayload`
  gain a client-minted `id`; `useCreateOneTimeTask`/`useCreateEvent`/`useUpdateEvent`/
  task-edit mutation get `onMutate` insert/patch + `onError` revert + toast + `onSettled`
  invalidate (pattern at useMutations.ts:97). Sheets switch from `await mutateAsync` to
  fire-and-close `mutate`. Recurring-rule creates stay awaited (R2 scope).
- **US3 (zoom + safe area)** — research R3/R4. Meta + `touch-action: manipulation` +
  16px coarse-pointer form rule; `env(safe-area-inset-bottom)` on nav, main padding, FAB.
- **US4 (day peek)** — research R5. `itemsForDay()` pure selector (shared with tile
  counts so SC-006 holds by construction); `DayPeekPanel`; `DashboardHome` owns
  `peekDateKey`; `onOpenDate` becomes the panel's calendar link.
- **US5 (snoozed on strip)** — research R6. Status filter widens in `sevenDayTiles` +
  `itemsForDay`; flip the two test expectations; other dashboard selectors untouched.
- **US6 (ack redesign)** — research R7. Presentation-only across TaskRow /
  TaskDetailSheet / AckNotices; `/impeccable critique` iterations; AA + 44px gates.
- **US7 (self-test split)** — research R8. Four chunked runners (membership fixed in
  R8), `selfTest()` fail-loud guard, header coverage comment.

## Complexity Tracking

No constitution violations — table not needed.
