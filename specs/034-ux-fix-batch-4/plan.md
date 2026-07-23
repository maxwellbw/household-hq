# Implementation Plan: UX Fix Batch 4

**Branch**: `034-ux-fix-batch-4` | **Date**: 2026-07-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/034-ux-fix-batch-4/spec.md`

## Summary

Five small, independent user-facing fixes. Four are frontend-only; one (US3, last-stocked date) adds a single plain-text column to the ListItems tab and sets it on the existing stock-toggle write path.

- **US1 (P1, frontend)** — The dog-walk planner already has a full backend override path (`bookWalkManually_` returns `OVERRIDE_REQUIRED` with named gates/conflicts unless `confirmOverride: true`), but the frontend hard-disables Book/Book-backup whenever the pending window conflicts or fails a gate, making that path unreachable. Fix: only disable Book for a *structurally* invalid window (outside the walk-eligible hours / already-started); for conflict/gate failures let the tap submit, surfacing the existing "Book anyway" confirmation.
- **US2 (P2, frontend)** — The Someday task row wires the title tap straight to the schedule dialog and leaves the overflow menu's Snooze/Edit-due as dead no-ops. Make the someday row consistent with every other task row (title opens the detail sheet) and route scheduling through a real, labeled affordance; seed the schedule dialog's owner from the task's existing owner.
- **US3 (P3, backend + frontend)** — Add `stockedAt` to `HEADERS.ListItems`; set it (household-local ISO) when `setListItemStatus_` transitions an item to `stocked`; show "stocked <date>" on the item row in the All view.
- **US4 (P3, frontend)** — Add two independent All-view toggles (alphabetical sort, group-by-section) and split the list into two global blocks: stocked on top, needed below, each block section-grouped when grouping is on.
- **US5 (P3, frontend)** — Add the staple-needed count to the dashboard nudge text.

## Technical Context

**Language/Version**: TypeScript (frontend, Vite + React 18), Apps Script V8 (backend, ES2015+, no npm)

**Primary Dependencies**: Frontend — React, TanStack Query, Tailwind, lucide-react (all already present). Backend — none (dependency-free per constitution).

**Storage**: One Google Sheet. This feature adds one column (`stockedAt`) to the `ListItems` tab; migration is automatic via the existing idempotent `setupDatabase()` header-append (Setup.js).

**Testing**: Frontend — Vitest + Testing Library (`*.test.tsx`/`*.test.ts`). Backend — `SelfTest.js` run via `clasp run selfTest*`.

**Target Platform**: Installable PWA (mobile-first), GitHub Pages; backend is the deployed Apps Script web app.

**Project Type**: Web application (separate `/frontend` and `/backend`).

**Performance Goals**: No change to existing interaction budgets; all list/view logic operates in memory on already-fetched data.

**Constraints**: All dates in the single household timezone; Sheet stays human-readable/hand-editable; backend writes idempotent and logged; two-user model only.

**Scale/Scope**: Two users; list sizes in the tens–low-hundreds of items. Five discrete UI/behavior changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Two Users Forever | PASS — no roles, tenancy, or scale concepts. Owners stay `max`/`jaz`/`both`. |
| II. The Sheet Is the Source of Truth | PASS — `stockedAt` is a plain ISO-8601 text cell, hand-editable; no blobs, no shadow state. Column added by name via header migration, never by position. |
| III. Free-Tier Only | PASS — no new services or dependencies. |
| IV. Boring and Debuggable | PASS — straight-line changes to existing components/functions; no new abstractions; backend stays dependency-free. |
| V. Idempotent Generation | PASS — `setListItemStatus_` already no-ops when status is unchanged; `stockedAt` is set only on the actual transition to `stocked`, inside the existing `LockService` wrapper. |
| VI. Every State Change Is Logged | PASS — the `list-item-stocked` ActivityLog append already exists; `stockedAt` rides the same write. No new silent mutations. |
| VII. Spec-Driven Development | PASS — this is the spec→plan flow on its own branch. |

**Result**: PASS (initial and post-design). No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/034-ux-fix-batch-4/
├── plan.md              # This file
├── research.md          # Phase 0 output — per-story decisions + the someday-flow walkthrough
├── data-model.md        # Phase 1 output — ListItem.stockedAt
├── quickstart.md        # Phase 1 output — validation scenarios
├── contracts/
│   └── ui-behavior.md   # Phase 1 output — UI/behavior contracts per story (+ backend field)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── Config.js            # HEADERS.ListItems += 'stockedAt' (US3)
├── Lists.js             # setListItemStatus_ sets stockedAt on → stocked (US3)
└── SelfTest.js          # cover stockedAt set/preserve (US3)

frontend/
├── src/
│   ├── types/domain.ts                              # ListItem.stockedAt?: string (US3)
│   ├── lib/
│   │   ├── lists.ts                                 # All-view arrangement helper (US4)
│   │   └── dogwalks.ts / DogWalkPlanner-local       # override-reachability helper (US1)
│   └── components/
│       ├── dashboard/
│       │   ├── DogWalkPlanner.tsx                   # US1 — Book enabled on conflict/gate
│       │   └── GroceryNudge.tsx                     # US5 — count in nudge text
│       ├── lists/
│       │   ├── ListsView.tsx                        # US4 — toggles + two-block arrangement
│       │   └── ListItemRow.tsx                      # US3 — show stocked date in All view
│       └── task/
│           ├── TasksView.tsx                        # US2 — someday row wiring
│           ├── TaskRow.tsx                          # US2 — schedule affordance / menu
│           └── ScheduleTaskDialog.tsx               # US2 — seed owner from task
└── (matching *.test.tsx / *.test.ts alongside each)
```

**Structure Decision**: Existing web-app layout (`/frontend` + `/backend`). No new top-level directories. Each story touches a small, disjoint set of files, keeping the five fixes independently shippable and reviewable.

## Complexity Tracking

No constitution violations — table omitted.
