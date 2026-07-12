# Implementation Plan: Someday Force-Rank + Tasks-Tab Someday Section

**Branch**: `021-someday-force-rank` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-someday-force-rank/spec.md`

## Summary

Two connected deliverables over the existing Someday concept (feature 013):

1. **Tasks-tab Someday section** — Pull standalone open undated tasks out of the bottom of the **Open** list (where the `9999-99-99` sentinel currently hides them) into a dedicated, labelled, collapsible **Someday** section at the bottom of the Tasks tab, expanded by default, respecting the owner filter, with a calm empty state.
2. **Force-rank session** — A "this or that?" pairwise flow that orders someday tasks with a binary-insertion strategy (~n·log n comparisons), producing **one shared household ranking** persisted as a per-task `somedayRank` column on the Tasks tab. The section (everywhere someday tasks render) sorts by `somedayRank` ascending, with never-ranked tasks appended below by title. The in-progress session is held in `localStorage` (same-device resume); only the final order is written to the Sheet, via one batched, idempotent `tasks.rank` endpoint that appends a single ActivityLog entry.

Primarily a frontend feature; the only backend work is a new `somedayRank` column and the batch-rank endpoint.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 (frontend, Vite); Google Apps Script V8 / ES2015+ (backend)

**Primary Dependencies**: Frontend — React, TanStack Query, Tailwind, shadcn/ui, lucide-react. Backend — none (Apps Script stays dependency-free).

**Storage**: The single Google Sheet. New `somedayRank` column on the **Tasks** tab (numeric string; blank = unranked). No new tab, no secondary datastore. In-progress session state lives in browser `localStorage` (transient, non-authoritative).

**Testing**: Frontend — Vitest + Testing Library (`*.test.ts[x]`). Backend — `SelfTest.js` (`selfTest()` run from the editor / exercised in review).

**Target Platform**: Installable PWA (mobile + desktop web); Apps Script web app backend.

**Project Type**: Web application (`/frontend` + `/backend`).

**Performance Goals**: Ranking N tasks in ≤ ~N·log₂N "this or that?" comparisons (SC-002); Someday section renders from already-loaded task data with no extra fetch.

**Constraints**: Sheet stays human-readable/hand-editable (`somedayRank` is a plain small integer beside the title); rank write is idempotent and `LockService`-guarded; every rank persist appends to ActivityLog; two-user model preserved (one shared order, never per-owner).

**Scale/Scope**: A household someday list — tens of tasks, not thousands. Binary insertion is comfortably within Apps Script's 6-min limit even if the whole list is re-written in one batch.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Two Users Forever** — ✅ One **shared** ranking, explicitly not per-owner (FR-010). No roles/tenancy introduced. Owner filter reuses the existing Max/Jaz/Both chips.
- **II. The Sheet Is the Source of Truth** — ✅ Ranking stored as a plain numeric `somedayRank` cell per task, hand-editable beside the task title (FR-023). No opaque blobs; row position is never the identifier (rank is an explicit value). Blank rank tolerated. In-progress session state is browser-local and non-authoritative — the Sheet always reflects the last saved order.
- **III / idempotency & LockService** — ✅ `tasks.rank` re-writes ranks deterministically from the submitted order (safe to re-run) and takes the write lock (concurrent writes possible). One ActivityLog entry per persisted re-rank (FR-022).
- **IV. Boring / debuggable** — ✅ Binary-insertion sort is a standard, testable algorithm; resume state is a small explicit JSON object in `localStorage`, not a persisted server session. Rejected the more complex "persist session to backend" path per the clarify decision.
- **V. Timezone / ISO dates** — N/A (ranking carries no dates; someday tasks are by definition undated).
- **VI. ActivityLog on every state change** — ✅ `tasks.rank` logs actor/action/target.
- **VII. Frontend build clean + impeccable audit** — ✅ Section is new UI → `/impeccable` pass before PR; `npm run build` must stay type-clean.

**Result**: PASS (no violations; Complexity Tracking not required).

## Project Structure

### Documentation (this feature)

```text
specs/021-someday-force-rank/
├── plan.md              # This file
├── research.md          # Phase 0 — algorithm & storage decisions
├── data-model.md        # Phase 1 — somedayRank column + render-order rules
├── quickstart.md        # Phase 1 — end-to-end validation scenarios
├── contracts/
│   └── api-021.md        # Phase 1 — tasks.rank endpoint + somedayRank on tasks.update
└── checklists/
    └── requirements.md   # spec quality checklist (from /speckit-specify)
```

### Source Code (repository root)

```text
backend/
├── Config.js            # + 'somedayRank' in HEADERS.Tasks; optional FIELD_TYPES entry
├── Api.js               # + rankTasks_ handler; register 'tasks.rank' in the dispatch map
├── Validation.js        # (optional) numeric validator for somedayRank
└── SelfTest.js          # + coverage for rankTasks_ (batch write, idempotency, blank clears)

frontend/src/
├── types/domain.ts              # + somedayRank?: string on Task
├── lib/
│   ├── tasks.ts                 # groupTasks: pull undated out of Open; add somedaySort
│   ├── forceRank.ts             # NEW — binary-insertion session engine (pure, resumable)
│   └── tether.ts                # somedayTasks(): sort by somedayRank then title
├── hooks/
│   ├── useMutations.ts          # + useRankTasks() → 'tasks.rank'
│   └── useForceRankSession.ts   # NEW — localStorage-backed session state + resume
└── components/task/
    ├── TasksView.tsx            # + collapsible Someday section (expanded default)
    ├── SomedayList.tsx          # render in ranked order; entry point to force-rank
    └── ForceRankDialog.tsx      # NEW — "this or that?" pairwise UI
```

**Structure Decision**: Existing web-app split (`/frontend` + `/backend`). This feature adds one backend column + one endpoint and a set of frontend modules; it introduces no new top-level structure. The Someday section and its ranked order reuse the existing `TaskRow`, owner-filter, and `tasks.update`/schedule paths from features 003/013.

## Complexity Tracking

> No Constitution Check violations — section intentionally empty.
