# Feature 012 — Implementation prompts (run each in a fresh context window)

Feature 012 (App Shell & Task UX) is split into 6 checkpoints so no single session
carries all 35 tasks. Run them **in order**; each continues on branch
`012-app-shell-task-ux` and commits its chunk before you close the window. Full detail for
every task lives in [`tasks.md`](tasks.md); the prompts just point a fresh session at the
right slice.

Prereqs already done: spec → clarify → plan → tasks are complete and committed-ready in
`specs/012-app-shell-task-ux/`. Only US3 (Prompt 3) touches `/backend`.

---

## Prompt 1 — Nav shell (MVP) · T001–T007

```
Continue feature 012 (App Shell & Task UX). Run `git checkout 012-app-shell-task-ux`.
Read specs/012-app-shell-task-ux/spec.md, plan.md, tasks.md, and research.md (R1, R2).

Implement Phase 1–3, tasks T001–T007: a shared nav definition + NavSection type; lift
active-section state into App.tsx (always land on Calendar); refactor AppShell into a
mobile bottom tab bar + desktop LEFT SIDEBAR RAIL with aria-current and 44px targets
(remove the disabled stubs); and create real TasksView, FeedView (over activity.list), and
MoreView hub so all four destinations are reachable.

Follow DESIGN.md/PRODUCT.md. When done: `cd frontend && npm run build` passes clean; in the
preview confirm Tasks/Feed/More are reachable at 375px and ~1200px with the active item
indicated and reload lands on Calendar (quickstart Scenario A). Commit on this branch with
a message describing the US1 nav shell. Do NOT open a PR — five more phases follow.
```

---

## Prompt 2 — Complete/reopen any task + grouping · T008–T012

```
Continue feature 012 on branch 012-app-shell-task-ux (Prompt 1 is committed). Read
specs/012-app-shell-task-ux/tasks.md (Phase 4) and research.md (R8), data-model.md.

Implement US2, tasks T008–T012: a pure lib/tasks.ts grouping/sort (Open vs Done, overdue
first, undated last) with Vitest tests; enhance TasksView to render Open + collapsed Done
groups, integrate useOwnerFilter + OwnerFilterChips, and a friendly empty state; confirm
standalone tasks (no eventId) complete/reopen from the list and stay in sync with
EventDetailSheet; add an accessible overflow (kebab) menu to TaskRow with Snooze
(placeholder) + Edit-due entries.

When done: `npm run build` clean, Vitest green; verify quickstart Scenario B in the
preview. Commit on this branch. No PR yet.
```

---

## Prompt 3 — Snooze with history (the one backend change) · T013–T021

```
Continue feature 012 on branch 012-app-shell-task-ux (Prompts 1–2 committed). Read
specs/012-app-shell-task-ux/tasks.md (Phase 5), contracts/api-tasks-snooze.md,
data-model.md (snoozeHistory encoding), research.md (R3, R4, R5).

Implement US3, tasks T013–T021. Backend: add setTaskSnooze_/unsnooze in backend/Sheets.js
(lock, idempotent no-change, set status/dueDate, append snoozeHistory + ActivityLog),
register tasks.snooze/tasks.unsnooze handlers in Api.js, add snooze/unsnooze to ACTION_VERBS
and extend isWriteAction_ to cover complete|reopen|snooze|unsnooze in Config.js, and add the
SelfTest.js cases from the contract. Frontend: useSnoozeTask/useUnsnoozeTask hooks,
parse/format snoozeHistory in lib/tasks.ts (+tests), a SnoozeDialog (presets + date picker
≥ today), a TaskDetailSheet showing readable snooze history + Un-snooze, and wire TaskRow's
overflow Snooze.

Then run `selfTest()` mentally/against SelfTest, `npm run build` clean, and
`cd backend && clasp push && clasp deploy -i <deploymentId>` (refresh the stable URL — no
appsscript.json scope change, so no re-auth). Validate quickstart Scenarios C + G against
the live backend. Commit on this branch. No PR yet.
```

---

## Prompt 4 — Event end date on create + edit · T022–T026

```
Continue feature 012 on branch 012-app-shell-task-ux (Prompts 1–3 committed). Read
specs/012-app-shell-task-ux/tasks.md (Phase 6) and research.md (R7).

Implement US4, tasks T022–T026: a pure end-before-start validator in lib/datetime.ts
(+test); add an optional end date/time to the event path in QuickAddSheet with an end<start
guard (keep the end=start+1h default); add useUpdateEvent (events.update); create a new
minimal EventEditSheet (title/start/end/owner); and add an Edit affordance to
EventDetailSheet that opens it. Multi-day and end==start allowed; only end<start rejected.

When done: `npm run build` clean, tests green; verify quickstart Scenario D in the preview.
Commit on this branch. No PR yet.
```

---

## Prompt 5 — Feed polish + More managers · T027–T032

```
Continue feature 012 on branch 012-app-shell-task-ux (Prompts 1–4 committed). Read
specs/012-app-shell-task-ux/tasks.md (Phases 7–8) and research.md (R6).

Implement US5 + US6, tasks T027–T032: polish FeedView (newest-first, plain-language Max/Jaz
attribution, snooze/unsnooze verbs, friendly empty state); create useRecurring and
useTemplates hooks (each with its own list + create/update/delete); build RecurringManager
(title/cadence/anchorDate/defaultOwner + optional season) and TemplatesManager
(eventType/taskTitle/offsetDays/defaultOwner), each with delete-behind-confirm; and wire
both into MoreView.

When done: `npm run build` clean; verify quickstart Scenarios E + F in the preview. Commit
on this branch. No PR yet.
```

---

## Prompt 6 — Polish, audit & open the PR · T033–T035

```
Continue feature 012 on branch 012-app-shell-task-ux (Prompts 1–5 committed). Read
specs/012-app-shell-task-ux/tasks.md (Phase 9) and quickstart.md.

Implement T033–T035: run an `/impeccable audit` across all new UI (WCAG 2.1 AA — contrast on
owner tints, 44px targets, focus rings, aria-current, focus-trapped sheets/dialogs,
prefers-reduced-motion) and fix findings; ensure `npm run build` is clean and all Vitest
units are green; update BACKLOG.md's 012 row and any README/spec deltas; then run the full
quickstart.md against the live deployment.

When everything passes, commit, push the branch, and open a PR to main (title + summary of
the six user stories; link the spec). PAUSE before merging — merging is the user's call.
```

---

## Notes

- Each prompt ends with a commit so the next fresh window sees the work on disk. If a
  session ends mid-chunk, the next one can just re-read `tasks.md` and continue from the
  first unchecked task.
- Optionally tick the `- [ ]` boxes in `tasks.md` as you finish each task, so progress is
  visible across windows.
- Only Prompt 3 deploys the backend; Prompts 1, 2, 4, 5 are frontend-only.
