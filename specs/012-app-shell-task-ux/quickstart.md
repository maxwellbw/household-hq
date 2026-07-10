# Quickstart & Validation: App Shell & Task UX

End-to-end scenarios that prove the feature works against the **live deployed backend**.
Run `cd frontend && npm run dev` for the UI; the one backend change is pushed with
`cd backend && clasp push && clasp deploy -i <deploymentId>` (refresh the stable web-app
URL) before validating US3. Sign in as a personal account for most scenarios; use the
shared account for the attribution check.

## Prerequisites

- `npm run build` passes with zero type errors.
- Backend redeployed with `tasks.snooze` / `tasks.unsnooze` and the `SelfTest.js` cases
  green (run `selfTest()` from the Apps Script editor).
- Signed in and past `ActingPersonPrompt` (shared account) or straight in (personal).

## Scenario A — Navigation works on mobile and desktop (US1 · SC-001)

1. At 375px width: from Calendar, tap **Tasks**, **Feed**, **More** in turn.
   - ✅ Each shows real content; the tapped item is highlighted (`aria-current`); no
     greyed-out/disabled stub remains.
2. At ~1200px width: the **left sidebar rail** shows all four sections; click through them.
   - ✅ Same destinations as mobile; active item indicated; header stays clean.
3. Reload the page from any section.
   - ✅ Lands back on **Calendar**.

## Scenario B — Complete/reopen a standalone task from Tasks (US2 · SC-002)

1. Quick-add a one-time task (no event), e.g. "Buy flea meds", due today.
2. Open **Tasks**.
   - ✅ It appears in the **Open** group with a check-off control; owner-filter chips scope
     the list; Done is a separate collapsed group.
3. Check it off.
   - ✅ Instant confirmation toast; it moves to Done; `completedBy` = you.
4. Expand Done and reopen it.
   - ✅ Returns to Open. If it had an event, its state matches inside the event sheet too.

## Scenario C — Snooze with visible history (US3 · SC-003)

1. On an open, dated task, open the row overflow menu → **Snooze**; pick a later date.
   - ✅ Task shows "snoozed until <date>", de-emphasized, and drops out of today's active
     view until then; status is `snoozed`.
2. Open the task detail.
   - ✅ Snooze history shows one row: `<old due> → <new due>` with when.
3. Snooze it again to a still-later date; reopen the detail.
   - ✅ **Two** history rows (full trail, not just the latest).
4. From the overflow menu choose **Un-snooze**.
   - ✅ Task returns to the Open group as `open`; history is still visible.
5. Check the **Feed**.
   - ✅ "You snoozed '<task>'" and "You un-snoozed '<task>'" appear.
6. (Idempotence) Re-issue the same snooze programmatically / double-tap.
   - ✅ No duplicate history row or feed entry.

## Scenario D — Event end date on create + edit (US4 · SC-004)

1. Quick-add an event "Friends visiting", start Fri, set **end** Sun.
   - ✅ Saves; displays across Fri→Sun on the calendar.
2. Quick-add another event and set end **earlier** than start.
   - ✅ Blocked with a clear message; nothing saved.
3. Open an existing event → **Edit**; change its end; save.
   - ✅ Updated span shown. An event created without an end still defaults to start + 1h
     (no regression).

## Scenario E — Feed (US5 · SC-006)

1. After doing a few actions (complete, add event, snooze), open **Feed**.
   - ✅ Reverse-chronological, plain-language entries, each attributed to Max or Jaz.
2. (Empty case) On a fresh/empty log, open Feed.
   - ✅ Friendly empty state, not a blank screen.

## Scenario F — Manage recurring rules & templates (US6 · SC-005)

1. **More → Recurring rules**: list existing; **create** a new rule (title/cadence/anchor/
   owner); **edit** one; **delete** one (confirm prompt).
   - ✅ Changes persist; future generation reflects them; already-generated tasks unchanged.
2. **More → Templates**: list; **create** a template (eventType/taskTitle/offsetDays/owner);
   **edit**; **delete** (confirm).
   - ✅ Persist; next matching event's prep generation uses the new/edited template.

## Scenario G — Shared-account attribution (US3/US2 · constitution VI)

1. Sign in on the **shared** account, confirm Max or Jaz at the prompt.
2. Snooze and complete a task.
   - ✅ Feed/log attribute the actions to the confirmed person (never the shared account,
     never null).

## Definition-of-done gate

- `npm run build` clean; Vitest units green (task grouping/sort, snoozeHistory parse/format,
  end-before-start guard, snooze payload builder).
- `selfTest()` green including the new snooze cases.
- `/impeccable audit` passes on the new UI (WCAG 2.1 AA: contrast, 44px targets, focus
  rings, `aria-current`, focus-trapped sheets/dialogs, `prefers-reduced-motion`).
