# Quickstart / Validation: Someday Force-Rank

End-to-end scenarios proving the feature works. Prereqs: backend pushed + deployed
(`cd backend && clasp push && clasp deploy -i <deploymentId>`), frontend running
(`cd frontend && npm run dev`), signed in as an allowlisted account. The Tasks tab already
shows tasks; features 003 (CRUD) and 013 (someday) are live.

## Setup

Create at least three **standalone, open, undated** tasks (no due date) — e.g. "Air-duct
cleaning", "Carpet cleaning", "Reseal the deck". These are the someday tasks under test.

## Scenario A — Someday section on the Tasks tab (US1)

1. Open the **Tasks** tab.
2. **Expect**: an **Open** section (dated open tasks only), and a distinct **Someday** section
   at the bottom, **expanded by default**, listing the three undated tasks. Undated tasks are
   **not** mixed into Open.
3. Collapse the Someday section via its chevron; **expect** the tasks hide and the count stays
   in the header. Expand again; **expect** them back.
4. Toggle the owner filter chips (Max / Jaz / Both); **expect** the Someday section to show only
   matching tasks.
5. Attach an undated task to an event (feature 005), then re-check; **expect** it does **not**
   appear in Someday (event-attached excluded).
6. Delete/complete all undated tasks for the current filter; **expect** a calm empty state
   ("Nothing parked…"), not a vanished section.

## Scenario B — Force-rank with "this or that?" (US2)

1. With ≥ 2 someday tasks, start the **force-rank** action.
2. **Expect**: exactly two tasks shown at a time with a "which matters more?" prompt; picking one
   advances to the next pair. For 3 tasks, the session finishes in **2–3** comparisons (never all
   3 pairs unless forced by order).
3. Finish the session. **Expect**: the Someday section immediately re-renders in the chosen order
   (highest priority first).
4. Verify the Sheet: the three tasks now have `somedayRank` = `1`, `2`, `3` in the chosen order;
   any previously-ranked-but-now-absent task has a blank `somedayRank`.
5. Verify the ActivityLog: exactly **one** new `rank-someday` row (not three).
6. **Shared order**: sign in as the other user (or open a second session); **expect** the same
   Someday order.

## Scenario C — Resume a partial session (US2 / FR-013)

1. Start a force-rank session with ≥ 4 tasks; answer one or two comparisons.
2. Navigate away (switch tabs / reload the page) on the **same device**.
3. Re-open force-rank. **Expect**: it resumes from where it stopped — the already-answered
   comparisons are **not** repeated.
4. Complete it; **expect** a coherent full order written once.

## Scenario D — Change resilience (US3)

1. After a completed ranking (`1,2,3`), add a **new** undated task.
2. **Expect**: it appears at the **bottom** of the Someday section (unranked group), and the
   existing ranked tasks keep their relative order (their `somedayRank` values unchanged).
3. **Schedule** the rank-`2` task (give it a due date). **Expect**: it leaves Someday; the
   remaining tasks keep their relative order (still `1` then `3`); no re-rank forced.
4. Clear that task's due date again. **Expect**: it returns to Someday at its preserved rank
   (`2`), slotting back between `1` and `3`.

## Scenario E — Save failure is honest (FR-016)

1. Simulate a failed `tasks.rank` (e.g. offline). Complete a session.
2. **Expect**: a clear "didn't save" message; the Someday section still shows the **previous**
   order; no partial/corrupt order is presented as final.

## Scenario F — Guards (edge cases)

1. With **one or zero** someday tasks, **expect**: the force-rank action is unavailable / a calm
   no-op (nothing to compare) — not an error.

## Automated checks

- `cd frontend && npm run build` — type-clean.
- `cd frontend && npm test` — `forceRank` engine unit tests (comparison-count bound, resume via
  `reconcile`, single-winner placement), `groupTasks`/`somedayTasks` ordering tests
  (ranked-then-title), and `TasksView` Someday-section rendering/collapse tests pass.
- Backend `selfTest()` — `rankTasks_` writes dense positions, clears absent ranks, appends one
  log row, and is idempotent on re-run.
- New Someday UI passes an `/impeccable audit` before the PR.
