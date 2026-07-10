# Quickstart & Validation: Someday List

**Feature**: 013-someday-list | **Phase 1**

End-to-end validation against the **live deployed backend** (no backend change or redeploy
for this feature). Frontend runs locally; it talks to the same Apps Script web app.

## Prerequisites

- `cd frontend && npm install` (no new deps expected).
- Signed in as Max or Jaz (or the shared account, resolving to a person).
- At least one **open, standalone, undated** task exists. Create one via the app's add
  flow leaving the due date empty, or add a row to the Tasks tab by hand with a `dueDate`
  cell left blank (e.g. `Air-duct cleaning`, owner `both`; `Carpet cleaning`, owner `jaz`).

## Run

```bash
cd frontend && npm run dev      # local dev against the live backend
npm run build                   # must pass with zero type errors (DoD)
npm run test                    # vitest: someday selector, canConfirm, payload builder
```

## Scenario 1 — Someday list is visible and owner-filtered (US1)

1. Open the app on the **Calendar** home view.
2. **Expect**: a "Someday" list below the calendar listing the undated open tasks
   (`Air-duct cleaning`, `Carpet cleaning`), each with its title and owner chip.
3. Toggle the owner filter chips (Max / Jaz / Both).
   **Expect**: the list shows only tasks matching the filter, consistent with the calendar.
4. Confirm a **dated** task never appears in Someday, and a done task is absent.
5. Filter to an owner with no undated tasks.
   **Expect**: a calm empty state, not a vanished section (FR-013).

## Scenario 2 — Complete / reopen from the list (US1)

1. Check off `Carpet cleaning` in the Someday list.
   **Expect**: it marks done (completer recorded) and leaves the open list.
2. Reopen it (from wherever done tasks are reachable).
   **Expect**: it returns to Someday as open, still undated.

## Scenario 3 — Tap to schedule (US2) — the core path

1. Tap `Air-duct cleaning`.
   **Expect**: a dialog opens asking **date** (empty) and **owner** (nothing pre-selected).
2. Confirm is **disabled**. Pick a date only → still disabled. Pick an owner only → still
   disabled. Pick **both** → Confirm enables (FR-008, SC-004).
3. Verify the owner was **not** pre-filled from the signed-in user (SC-003).
4. Confirm.
   **Expect**: the task leaves the Someday list and appears on the calendar on the chosen
   day with the chosen owner (FR-009); an `update` row lands in ActivityLog / the Feed
   (FR-015). No manual refresh needed (SC-005).
5. Repeat, but **Cancel** the dialog.
   **Expect**: no change; the task stays in Someday (FR-010).
6. Force an error (offline), confirm.
   **Expect**: task stays in Someday, a "couldn't schedule" toast shows (FR-014).

## Scenario 4 — Drag to schedule (US3, desktop, progressive enhancement)

> Run only if US3 shipped (may be deferred — see research.md R4).

1. On a desktop-width window, drag a Someday task onto a specific calendar day and drop.
   **Expect**: the same scheduling dialog opens with **that day pre-filled** as the date,
   owner still **unset** (FR-011), no write yet.
2. Change the pre-filled date to a different day, confirm.
   **Expect**: the task is scheduled to the **edited** date, not the drop target.
3. Cancel a drag-opened dialog.
   **Expect**: no due date applied; task stays in Someday.

## Accessibility check (SC-006, before PR)

- Full keyboard path: focus a Someday row → open the dialog → tab to date, to owner
  options, to Confirm/Cancel → operate entirely without a mouse; focus is trapped and
  returns to the row on close.
- Confirm's disabled state is announced; owner options and chips meet ≥4.5:1 contrast on
  their real backgrounds; targets ≥44px; motion respects `prefers-reduced-motion`.
- Run `/impeccable audit` on the new list + dialog and resolve findings before the PR.

## Definition of done (this feature)

- Scenarios 1–3 pass; Scenario 4 passes **or** US3 is explicitly deferred with a note.
- `npm run build` clean; new unit tests green; `/impeccable audit` clean.
- No backend files changed; `BACKLOG.md` updated (stage + PR link).
