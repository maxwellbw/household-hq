# Quickstart / Validation: UX Fix Batch

Frontend-only. No backend deploy needed (uses existing `tasks.create` / `tasks.update`).

## Setup

```bash
cd frontend
npm run dev      # local dev server
npm test         # Vitest — must stay green (SC-005)
npm run build    # must pass with no type errors (SC-005)
```

Sign in with an allowlisted account. Validate on **both** a desktop viewport and a mobile viewport (the calendar-tap bug was reported on both — use the preview tools' resize or a real phone).

## US1 — Undated task lands in Someday

1. Tap **+** → Task. Enter a title, **leave the date blank**, pick an owner, submit.
2. ✅ The task appears in the **Someday** section, not on today.
3. ✅ Open the calendar — the task is **not** shown on any date.
4. Add another task **with** a date → ✅ it appears on that date (unchanged behavior).

## US2 — Edit & reassign a task

1. Open a task's detail sheet (tap its title in the task list).
2. ✅ Sheet is read-only; snooze history shows as before.
3. Tap **Edit** → fields become editable.
4. Change the **title**, switch the **owner** to the other person, change the **due date** → **Save**.
5. ✅ All three changes show immediately in the task list and calendar (no manual refresh).
6. Re-open, tap Edit, **clear the date**, Save → ✅ task moves to **Someday**, leaves the calendar.
7. Open a Someday task, Edit, set a date + owner, Save → ✅ task appears on the calendar.
8. Edit, blank the title, try Save → ✅ blocked with an inline error; no change.
9. Edit, change something, **Cancel** → ✅ nothing changes.

## US3 — "Edit due" quick action

1. In the task list, open a task row's **⋮** overflow menu → **Edit due**.
2. ✅ The task detail sheet opens **in edit mode** focused on the due date (not nothing, not a separate picker).
3. Pick a new date → Save → ✅ due date updates in list + calendar.
4. Re-open via Edit due → Cancel → ✅ unchanged.

## US4 — Calendar taps open details

Do each on **desktop (month-grid)** and **mobile (month-agenda)**:

1. Tap an **event** chip → ✅ `EventDetailSheet` opens on the first tap.
2. Tap a **task** chip → ✅ `TaskDetailSheet` opens.
3. From the calendar-opened task sheet, Edit → change a field → Save → ✅ reflected on the calendar.

## Regression sweep (SC-005)

- Complete a task / reopen it → ✅ works as before.
- Snooze a task, then Un-snooze from its detail sheet → ✅ works as before.
- Someday scheduling (feature 013 date+owner sheet) → ✅ still works.

## Definition of done

- [ ] All checks above pass on desktop **and** mobile.
- [ ] `npm test` green, `npm run build` clean.
- [ ] `/impeccable audit` clean on the new `TaskEditSheet` and the edited sheets before PR.
