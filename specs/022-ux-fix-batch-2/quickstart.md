# Quickstart / Validation: UX Fix Batch 2

Frontend-only. No `clasp` deploy. Validate against the live web app (or `npm run dev`) once merged/built.

## Prerequisites

- Signed in as Max or Jaz (or the shared account with an acting person chosen).
- At least one dated task visible on the calendar, one open task on the Tasks tab, and one throwaway event (create one if needed) — ideally an event with a prep template so it has prep tasks.

## Automated checks (run before manual)

```bash
cd frontend
npm run build      # must pass with no type errors
npm run test       # Vitest — new/updated suites green
```

## US1 — Snooze from the calendar

1. Open the calendar, tap a **task chip** → `TaskDetailSheet` opens.
2. **Expect**: a **Snooze** action is present (in the read-only view, not behind Edit).
3. Tap Snooze → the standard snooze dialog opens (Tomorrow / Next week / custom date).
4. Pick a date, Snooze. **Expect**: toast "Snoozed until <date>", the sheet closes, and the task now appears at the new date on the calendar; its snooze history (reopen detail) shows the new row.
5. Open an already-snoozed task's detail. **Expect**: both **Snooze** (push further) and **Un-snooze** are available.

## US2 — Delete an event and a task

1. Open the throwaway **event**'s detail. **Expect**: a **Delete** action.
2. Tap Delete. **Expect**: a confirm dialog; if the event has prep tasks it reads "Its N prep task(s) will also be removed." Cancel → nothing changes.
3. Confirm. **Expect**: event disappears from the app and from the shared Google Calendar (check the mirrored calendar); its prep tasks are gone from the Tasks tab; ActivityLog has a delete row.
4. Open a **one-off task**'s detail → Delete → confirm. **Expect**: task removed; ActivityLog row appended.
5. Open a **recurring-generated** task's detail (one with a `recurringId`) → Delete. **Expect**: the confirm clearly says only this occurrence is deleted and the rule keeps generating (managed in More → Recurring). Confirm → only that occurrence is gone; the recurring rule still exists under More → Recurring and a later generation still produces the next occurrence.
6. **Graceful path**: delete the same item from a second device/tab, then confirm the stale delete. **Expect**: a toast that it was already removed and the list refreshes — no broken UI.

## US3 — Collapse the Open section

1. Go to the Tasks tab with several open tasks.
2. **Expect**: the **Open** header now has a chevron affordance matching Done.
3. Collapse Open. **Expect**: the tasks hide, the "Open (N)" header/count stays. Expand → tasks return.
4. **Expect**: Open and Done present the same collapse/expand affordance.

## Regression sanity

- Create / edit / complete / reopen a task still work.
- Editing a task/event from its detail (Edit button) still works — Snooze/Delete sit alongside Edit without breaking it.
- Owner filter chips and calendar sync unaffected.
