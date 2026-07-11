# Implementation Plan: UX Fix Batch 2

**Branch**: `022-ux-fix-batch-2` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/022-ux-fix-batch-2/spec.md`

## Summary

Three frontend-only UX gap fixes that surface capabilities the backend already has. (1) Add a **Snooze** action to `TaskDetailSheet` (the sheet calendar task chips open since 016), reusing the existing `SnoozeDialog`. (2) Add a **Delete** action to `TaskDetailSheet` and `EventDetailSheet`, guarded by a confirmation dialog, wired to the existing `tasks.delete` / `events.delete` actions (both already do Google Calendar mirror cleanup and ActivityLog writes server-side). (3) Make the **Open** section on the Tasks tab collapsible, mirroring the Done section's existing pattern. No backend, data-model, scope, or `clasp` changes.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18 (Vite)

**Primary Dependencies**: `@tanstack/react-query` (mutations + cache invalidation), `lucide-react` (chevron icons), Tailwind + shadcn-style primitives. No new dependencies.

**Storage**: N/A — the Google Sheet is untouched; every write goes through existing backend actions.

**Testing**: Vitest + React Testing Library. Existing suites: `TaskDetailSheet.test.tsx`, `TaskEditSheet.test.tsx`, `TasksView.test.tsx`, `CalendarHome.test.tsx`.

**Target Platform**: Installable PWA (mobile-first) + desktop, GitHub Pages build. Bottom-sheet-on-mobile / centered-dialog-on-desktop pattern already established.

**Project Type**: Web app — `frontend/` only for this feature.

**Performance Goals**: No perceptible regression; optimistic-where-appropriate mutations with react-query invalidation (matches existing snooze/complete patterns).

**Constraints**: WCAG 2.1 AA (44px touch targets, focus rings, `aria-expanded` on collapse, `role="dialog"`/`aria-modal` + focus trap via `useDialogA11y` on the new confirm dialog). Destructive action MUST be confirmed. Reuse existing components — no divergent snooze/dialog behavior.

**Scale/Scope**: Two users, ~3 components edited + 1 new confirm dialog + 2 new mutation hooks. No new screens.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Two Users Forever | ✅ Pass | No roles/permissions; either person can snooze or delete any item. |
| II. The Sheet Is Source of Truth | ✅ Pass | No schema change; deletes are hard-deletes via the existing `deleteRecordById_` path, which the Sheet already supports (rows can be hand-deleted too). |
| III. Free-Tier Only | ✅ Pass | No new services or quotas. |
| IV. Boring and Debuggable | ✅ Pass | Reuses existing dialog/mutation patterns; one small new confirm dialog modeled on `SnoozeDialog`. |
| V. Idempotent Generation | ✅ Pass | Deleting a recurring-generated task removes only the instance; the rule keeps generating (existing `deleteTask_` behavior). A re-run of a delete on an already-gone row fails gracefully (FR-012). |
| VI. Every State Change Is Logged | ✅ Pass | `deleteEvent_` / `deleteTask_` already append to ActivityLog; the UI adds no un-logged writes. |
| VII. Spec-Driven Development | ✅ Pass | Spec + clarify complete before this plan. |

**Result: PASS — no violations, Complexity Tracking not required.**

## Project Structure

### Documentation (this feature)

```text
specs/022-ux-fix-batch-2/
├── plan.md              # This file
├── spec.md              # Feature spec (+ Clarifications session 2026-07-11)
├── research.md          # Phase 0 — decisions below
├── data-model.md        # Phase 1 — no model changes (documents why)
├── quickstart.md        # Phase 1 — manual validation script
├── contracts/           # Phase 1 — no new contracts (reuses existing actions; documents which)
└── checklists/
    └── requirements.md  # Spec quality checklist (passing)
```

### Source Code (repository root)

```text
frontend/src/
├── components/
│   ├── task/
│   │   ├── TaskDetailSheet.tsx      # EDIT — add Snooze + Delete actions (US1, US2)
│   │   ├── TaskDetailSheet.test.tsx # EDIT — cover snooze-open, delete-confirm, recurring copy
│   │   ├── TasksView.tsx            # EDIT — make Open section collapsible (US3)
│   │   └── TasksView.test.tsx       # EDIT — cover Open collapse/expand
│   ├── event/
│   │   └── EventDetailSheet.tsx     # EDIT — add Delete action w/ prep-count confirm (US2)
│   └── ui/
│       └── ConfirmDialog.tsx        # NEW — reusable confirm modal (modeled on SnoozeDialog a11y)
├── hooks/
│   └── useMutations.ts              # EDIT — add useDeleteTask, useDeleteEvent
└── components/calendar/
    └── CalendarHome.tsx             # VERIFY — EventDetailSheet delete closes sheet cleanly (likely no change)
```

**Structure Decision**: Web app, `frontend/` only. Backend (`/backend`) is untouched — no `clasp push`/`deploy` needed for this feature. Changes are localized to the task/event detail sheets, the Tasks view, one new shared `ConfirmDialog`, and two new delete hooks.

## Design Notes (informing tasks)

**US1 — Snooze from calendar detail.** `TaskDetailSheet` currently renders Un-snooze only when `status === 'snoozed'`. Add a persistent **Snooze** button (visible regardless of status; a non-snoozed task can still be pushed out) that opens `SnoozeDialog` (already exists, already used by `TasksView`). Local `showSnooze` state, same overlay-stacking pattern as the existing `showEdit`/`TaskEditSheet`. On snooze success `SnoozeDialog` closes itself and invalidates `['tasks']`; the detail sheet also closes (matches the un-snooze flow's `onClose`). Applies everywhere `TaskDetailSheet` opens — calendar chips and the Tasks tab both benefit. Snooze is gated to tasks that have a `dueDate` (chips are dated); the button is still shown for dated tasks in any status.

**US2 — Delete task & event.**
- New `ConfirmDialog` in `components/ui/` — title, body (supports a warning line), Cancel + a destructive Confirm button, built on `useDialogA11y` (focus trap + Esc) exactly like `SnoozeDialog`. Confirm button styled destructive; initial focus on Cancel (safer default for a destructive action).
- New hooks `useDeleteTask` / `useDeleteEvent` in `useMutations.ts` calling `authedCall('tasks.delete' | 'events.delete', { id })`, invalidating `['tasks']` / `['events']` (and `['tasks']` too for event delete, since prep tasks are purged) on settle. **No optimistic removal** — deletes are rare and destructive; a plain pending→invalidate flow with a toast is simpler and avoids flicker on failure. `handleAuthError` in the catch, matching every other hook.
- `TaskDetailSheet`: add a **Delete** button in the read-only view (FR-005/006 — not gated behind Edit). Confirm copy branches on `task.recurringId`: recurring-generated → body states "This deletes only this occurrence. The recurring rule keeps making new ones (manage rules in More → Recurring)." Otherwise a plain "Delete this task?".
- `EventDetailSheet`: add a **Delete** button. Prep-task count comes from `event.tasks.length` (the `EventWithTasks` the sheet already receives). Confirm body: "Delete this event?" + when `event.tasks.length > 0`, append "Its N prep task(s) will also be removed." (singular/plural) (FR-008a). On confirm, `events.delete` handles the gcal mirror + prep purge server-side.
- **Graceful already-gone (FR-012):** on delete error, show a toast ("Couldn't delete — it may have already been removed") and invalidate the list so the view refreshes; close the sheet. No broken state.

**US3 — Collapsible Open section.** `TasksView` already has `doneExpanded` + a chevron header button for Done. Add `openExpanded` state (default **expanded** — Open is the primary list; Done defaults collapsed). Wrap the Open list body in the same `aria-expanded` chevron-header pattern, keeping the "Open (N)" count in the header and preserving the empty/filter/all-caught-up states inside the expanded body. No persistence (Done doesn't persist across visits either — matches FR-015). This sets the collapsible pattern feature 021's Someday section will reuse.

## Complexity Tracking

No constitution violations — section intentionally empty.
