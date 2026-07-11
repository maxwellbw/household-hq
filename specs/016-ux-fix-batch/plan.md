# Implementation Plan: UX Fix Batch — Task Editing & Dead Controls

**Branch**: `016-ux-fix-batch` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-ux-fix-batch/spec.md`

## Summary

Four confirmed frontend defects, no backend work. (1) A one-line fix so blank-date quick-adds stay undated and reach the Someday list. (2) A new read-only-then-Edit task detail sheet that edits title/owner/dueDate via the existing `tasks.update` action — mirroring the event `EventDetailSheet` → `EventEditSheet` pattern already in the codebase. (3) Wire the dead "Edit due" overflow action to open that same detail sheet in edit mode. (4) Make calendar taps open details — investigate why event taps don't fire, and stop ignoring task taps by routing them to the new task detail sheet.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18 (Vite). Backend untouched (Google Apps Script, V8).

**Primary Dependencies**: React, @tanstack/react-query, Schedule-X calendar (`@schedule-x/react`, `@schedule-x/calendar`), temporal-polyfill, Tailwind + shadcn/ui. No new dependencies.

**Storage**: Google Sheet Tasks tab (unchanged schema). Writes go through the existing `tasks.update` API action (accepts `title`/`owner`/`dueDate`; `dueDate` may be cleared with `''`).

**Testing**: Vitest + React Testing Library (`frontend`). Existing suite must stay green.

**Target Platform**: PWA — mobile Safari/Chrome + desktop browsers. Both must be validated (calendar tap bug reported on both).

**Project Type**: Web app (frontend-only change for this feature).

**Performance Goals**: No perceptible latency change; edits reflect after the existing `['tasks']` query invalidation (same as scheduling in 013).

**Constraints**: WCAG 2.1 AA (DESIGN.md), 44px touch targets, owner color = identity. No new backend action, Sheet column, or auth concept (FR-016).

**Scale/Scope**: Two users. ~5 frontend files touched + 1 new component + 1 new mutation + tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Two Users Forever | ✅ Pass | No roles/tenancy/scale introduced; owner remains max/jaz/both. |
| II. The Sheet Is Source of Truth | ✅ Pass | No schema change; edits write through existing `tasks.update`, Sheet stays hand-editable. |
| III. Free-Tier Only | ✅ Pass | No new services. |
| IV. Boring and Debuggable | ✅ Pass | Reuses the proven Event detail/edit pattern and existing mutation plumbing. |
| V. Idempotent Generation | ✅ Pass | No triggers/generation added; `tasks.update` is already idempotent. |
| VI. Every State Change Is Logged | ✅ Pass | `tasks.update` already appends to ActivityLog on the backend — no new state-change path bypasses logging. |
| VII. Spec-Driven Development | ✅ Pass | spec → clarify → plan → tasks chain followed on branch `016-ux-fix-batch`. |

No violations. Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/016-ux-fix-batch/
├── plan.md              # This file
├── research.md          # Phase 0 — calendar-tap investigation, edit-model decision record
├── data-model.md        # Phase 1 — Task (no schema change) + editable-fields contract
├── quickstart.md        # Phase 1 — manual validation script (mobile + desktop)
├── contracts/
│   └── ui-contract.md   # Phase 1 — frontend behavior contract (no new API surface)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/src/
├── lib/
│   ├── quickAdd.ts            # FIX: buildOneTimeTaskPayload — stop defaulting blank dueDate to today
│   └── quickAdd.test.ts       # update expectation for blank date
├── hooks/
│   └── useMutations.ts        # ADD: useUpdateTask (generic title/owner/dueDate; invalidates ['tasks'])
├── components/
│   ├── task/
│   │   ├── TaskDetailSheet.tsx    # EDIT: read-only default + Edit button; accept initialEdit prop
│   │   ├── TaskEditSheet.tsx      # NEW: title / owner / dueDate(clearable) form (mirrors EventEditSheet)
│   │   ├── TaskEditSheet.test.tsx # NEW: title validation, owner change, clear-date
│   │   ├── TasksView.tsx          # EDIT: wire onEditDue → open detail sheet in edit mode
│   │   └── TaskDetailSheet.test.tsx # NEW/EDIT: read-only→edit→save flow
│   └── calendar/
│       ├── CalendarHome.tsx       # EDIT: open TaskDetailSheet on task tap; fix event tap
│       ├── CalendarHome.test.tsx  # EDIT: task tap opens sheet; event tap opens sheet
│       └── EventContent.tsx       # POSSIBLE EDIT: ensure taps reach onEventClick (per research)
```

**Structure Decision**: Existing `frontend/` React structure. New work reuses the Event detail/edit component pair as the template for the Task detail/edit pair; no backend directory touched.

## Phase 0 — Research

See [research.md](research.md). Two items:

1. **Calendar event-tap not firing (FR-013)** — determine root cause across Schedule-X `month-grid` (desktop) and `month-agenda` (mobile) with the custom `monthGridEvent: EventContent` component, and choose the minimal fix that makes both views open `EventDetailSheet` on tap.
2. **Edit interaction model (clarified)** — record the chosen read-only-then-Edit-button pattern and its reuse of `EventDetailSheet`/`EventEditSheet` as the template; confirm `tasks.update` clear-date semantics (`dueDate: ''`).

## Phase 1 — Design & Contracts

- [data-model.md](data-model.md): Task entity (unchanged schema) + the editable-field set and validation rules exposed by the edit sheet.
- [contracts/ui-contract.md](contracts/ui-contract.md): frontend behavior contract per FR (no new API endpoints; documents the `tasks.update` payloads used and the tap/edit interactions).
- [quickstart.md](quickstart.md): step-by-step manual validation on desktop + mobile covering all four stories.
