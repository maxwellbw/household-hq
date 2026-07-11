# Research: UX Fix Batch 2

All three fixes surface existing capabilities; research here is limited to reuse decisions and the two clarified UX points. No open `NEEDS CLARIFICATION` remained after the clarify session.

## R1 — Reuse `SnoozeDialog` for calendar snooze (US1)

**Decision**: Open the existing `SnoozeDialog` from `TaskDetailSheet` rather than build a calendar-specific snooze.

**Rationale**: `SnoozeDialog` already implements presets (Tomorrow / Next week), a custom date ≥ today, the `useSnoozeTask` optimistic mutation, snooze-history append (server-side), and a11y via `useDialogA11y`. `TaskDetailSheet` opens from both the calendar and the Tasks tab, so adding the trigger there closes the gap on every surface at once (FR-002: "no divergent behavior").

**Alternatives considered**: A bespoke inline date picker in the detail sheet — rejected: duplicates behavior and risks divergence, violating FR-002 and the "boring/reuse" principle.

## R2 — New shared `ConfirmDialog` vs. inline `window.confirm` (US2)

**Decision**: Add a small reusable `components/ui/ConfirmDialog.tsx` modeled on `SnoozeDialog`'s structure (overlay, `role="dialog"`, `aria-modal`, `useDialogA11y` focus trap, Cancel + destructive Confirm).

**Rationale**: Native `window.confirm` can't carry the recurring-instance note or the prep-count line (FR-008a, FR-010), isn't theme-styled, and reads as a browser chrome break in a PWA. A styled dialog keeps copy control and WCAG parity with the rest of the app. Cancel takes initial focus (safer default for a destructive action).

**Alternatives considered**: (a) `window.confirm` — rejected (no rich copy, off-brand). (b) A full shadcn AlertDialog dependency — rejected: heavier than needed; the existing `SnoozeDialog` pattern is the established, dependency-free precedent.

## R3 — Delete lives in the read-only detail view (US2, clarified)

**Decision**: Place Delete (and Snooze) in the read-only detail sheet, not behind the Edit button.

**Rationale**: Clarified 2026-07-11 — reachability. From the calendar a task is tap chip → detail; requiring Edit first adds a step to a common action. Keeps Snooze and Delete peers in the same view.

## R4 — No optimistic delete (US2)

**Decision**: Delete mutations use a plain pending → invalidate flow (no `onMutate` cache surgery), with a success/error toast.

**Rationale**: Deletes are infrequent and destructive; optimistic removal would flicker the row back on failure and complicate the recurring/prep cascade (event delete also purges prep tasks server-side). Simpler and matches the create/update hooks that also invalidate rather than optimistically mutate. Snooze/complete stay optimistic as they are today.

## R5 — Detecting a recurring-generated task on the frontend (US2)

**Decision**: Branch the confirm copy on `task.recurringId` being non-empty.

**Rationale**: `Task.recurringId` (types/domain.ts) is populated by the recurrence engine for generated occurrences. Non-empty ⇒ show the "only this occurrence; the rule keeps generating (manage in More → Recurring)" note (FR-010). Deleting the row never touches the rule (existing `deleteTask_`), so no special backend call is needed — instance-only is the default.

## R6 — Prep-task count for event delete (US2, clarified)

**Decision**: Use `event.tasks.length` from the `EventWithTasks` the sheet already holds.

**Rationale**: `EventDetailSheet` receives `EventWithTasks` (the tether groups prep tasks onto the event). The exact count is already in hand — no extra fetch. Backend `deleteEvent_` purges all prep tasks (done + outstanding) but leaves manually event-linked non-prep tasks; the count shown reflects the prep tasks the user sees in the sheet. Copy: singular/plural on N.

## R7 — Open section collapse: default state & persistence (US3)

**Decision**: `openExpanded` defaults to **true** (Open is the working list); no cross-visit persistence.

**Rationale**: Symmetry with Done's existing collapse affordance while respecting that Open is the primary list users act on. Done defaults collapsed; Open defaults expanded. FR-015 asks persistence to match Done — Done does not persist, so Open doesn't either. Feature 021's Someday section will reuse this collapsible header pattern (ships collapsed).
