# Household HQ — Backlog / Sprint Tracker

Source of truth for feature order: `docs/household-hq-project-brief.md` §10.
Per-feature detail lives in `specs/NNN-name/`. This file is the one-glance index —
update it whenever a feature moves stage (spec written, plan done, tasks generated,
implemented, merged). Ask Claude to "update BACKLOG.md" after any speckit step or PR merge.

**Stage legend:** `spec` → `clarify` → `plan` → `tasks` → `implement` → `deployed` → `merged`

## Phase 1 — Core (MVP)

| # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|
| 001 | Sheets schema and JSON API | ✅ merged | [specs/001-sheets-schema-and-api](specs/001-sheets-schema-and-api/spec.md) | [#1](https://github.com/maxwellbw/household-hq/pull/1) |
| 002 | Auth allowlist + verified attribution | ✅ merged | [specs/002-auth-allowlist](specs/002-auth-allowlist/spec.md) | [#2](https://github.com/maxwellbw/household-hq/pull/2) |
| 003 | Tasks CRUD and activity log | ✅ merged | [specs/003-tasks-crud-and-activity-log](specs/003-tasks-crud-and-activity-log/spec.md) | [#3](https://github.com/maxwellbw/household-hq/pull/3) |
| 004 | Recurring chore engine | ✅ merged | [specs/004-recurring-engine](specs/004-recurring-engine/spec.md) | [#4](https://github.com/maxwellbw/household-hq/pull/4) |
| 005 | Events and prep templates | ✅ merged | [specs/005-events-and-prep-templates](specs/005-events-and-prep-templates/spec.md) | [#5](https://github.com/maxwellbw/household-hq/pull/5) |
| 006 | Calendar UI (home screen) | ✅ merged | [specs/006-calendar-ui](specs/006-calendar-ui/spec.md) | [#6](https://github.com/maxwellbw/household-hq/pull/6) |
| 007 | Google Calendar sync | ✅ merged | [specs/007-gcal-sync](specs/007-gcal-sync/spec.md) | [#7](https://github.com/maxwellbw/household-hq/pull/7) |

## Phase 2 — Comfort

| # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|
| 008 | Email digests | ✅ merged | [specs/008-email-digests](specs/008-email-digests/spec.md) | [#8](https://github.com/maxwellbw/household-hq/pull/8) |
| 009 | ntfy.sh completion pings | ✅ merged (live validation deferred) | [specs/009-ntfy-pings](specs/009-ntfy-pings/spec.md) | [#9](https://github.com/maxwellbw/household-hq/pull/9) |

## Phase 2.5 — UX completion (planned 2026-07-09, Jaz's feedback session)

The backend outran the UI: task completion is only reachable inside an event's detail sheet,
the Tasks/Feed/More nav buttons are disabled stubs from 006, events can't get an end date from
the UI, and recurring rules / prep templates have full CRUD APIs (004/005) but no management
screens. These four features close that gap, **in this order**, before 010/011:

| # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|
| 012 | App shell & task UX | 🟡 tasks | [specs/012-app-shell-task-ux](specs/012-app-shell-task-ux/spec.md) | — |
| 013 | Someday list (drag/tap-to-schedule) | ⬜ not started | — | — |
| 014 | Home dashboard | ⬜ not started | — | — |
| 015 | Recurring seed pack & alternating weeks | ⬜ not started | — | — |

**012 — App shell & task UX** (frontend-only; every backend piece already exists).
Working Tasks / Feed / More navigation on mobile *and* desktop (006 shipped them as disabled
stubs); complete/reopen a task from anywhere it appears (today only `TaskRow` inside
`EventDetailSheet` has a checkbox); snooze/defer with visible history (brief #11 — backend
`snoozed` status + `snoozeHistory` already exist); event **end date** in create/edit (Sheet has
the column, the UI never asks); management screens under More for Recurring rules and
TaskTemplates (list/edit/delete — answers "where do I set up templates?").

**013 — Someday list.** Undated tasks (already supported by the API, currently invisible)
shown in a list below the calendar. Scheduling one **always opens a mini-dialog asking date +
owner** (clarified 2026-07-09 — no implicit ownership from who dragged); desktop drag-and-drop
can pre-fill the date but still asks. Seed examples: air-duct cleaning, carpet cleaning.

**014 — Home dashboard.** Week + month summaries, individual and together: "Friends are here
Fri–Sun — you have 4 tasks, Jaz has 5", "rare chore coming up: change the air filter". Absorbs
the brief's load-balance view (#12) and smart views (#13: Today / This weekend / Overdue).
**Clarified 2026-07-09: the dashboard becomes the home/landing view** — this reverses the
calendar-first principle in DESIGN.md/PRODUCT.md and the constitution's workflow section, so
this feature includes a design/constitution amendment PR that **Max must co-approve** per
governance before implementation.

**015 — Recurring seed pack & alternating weeks.** Alternating bins modeled as **offset
biweekly rules** (clarified 2026-07-09: "Trash" weekly + "Yard waste" and "Recycling" biweekly,
anchored a week apart — works with today's engine, no new concepts). Plus a hand-editable
starter pack of common home-maintenance chores (air filter quarterly, dishwasher clean, gutters,
smoke-detector batteries, …) seeded by a one-time editor function. Decide seasonal windows
(mow April–October — brief open question #4) at this feature's clarify.

## Phase 3 — Stretch (follows Phase 2.5 — reorder of brief §10 pending Max's co-sign)

| # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|
| 010 | PWA install + web push | ⬜ not started | — | — |
| 011 | Weather-aware dog-walk window finder | ⬜ not started | — | — |

**Still unscheduled from the brief** (park here until prioritized): quick-add by email (#14),
recurring-chore streaks/history (#17), shopping/errand list items on tasks (#18 — the
`listItems` field already exists in the Tasks schema), and naming the app (open question #6 —
"Household HQ" is still the placeholder).

## Phase 4 — Someday (data-model-compatible only; build nothing yet)

- Projects concept (vendor threads grouping tasks)
- Claude API vendor outreach (draft/parse/propose, human sends)

---

## Currently active

**Next up: 012 — App shell & task UX** (first of the Phase 2.5 UX-completion features planned
in Jaz's 2026-07-09 feedback session). Kick off with "start feature 012".

**009 — ntfy.sh completion pings** (brief §10 item 10, Phase 2). ✅ Merged to `main` (PR #9)
and deployed (`clasp` @13, same stable URL). A real open→done completion
POSTs `"<Completer> completed: <title>"` to **the other person's** private ntfy topic (clarified:
never yourself; `both`-owned included). Best-effort side effect on `completeTask_`'s
`changed`-flag branch — no trigger, no new OAuth scope, no frontend. New `backend/Ntfy.js`;
one-line `Api.js` edit; new Settings key `ntfyEnabled` (topics already seeded).
**Deferred validation (user decision 2026-07-09):** run `setupDatabase()` + `selfTest()` in the
editor, pick topics, subscribe phones, and run quickstart Scenarios A–F (tasks T012/T014).

_008 merged to `main` (PR #8) and deployed to the Apps Script web app (`clasp` @12, same stable
URL). Personalized weekly "week ahead" (Sunday default) + monthly "next month" HTML digests
(owner colors + plain-text fallback), sent via `MailApp` on a daily-gate trigger
(`sendDigests()`, hour from `digestHour`, default 6–7am household tz). Own+`both`
owner-filtering only (never the other person's solo items, clarified). Schedule fully
hand-editable in Settings (`digestWeeklyEnabled/Day`, `digestMonthlyEnabled/Day`,
`digestHour`) — weekday/month-day/on-off take effect next run, no reinstall; only
`digestHour` needs `installDigestTrigger()` re-run. Dedupe via a deterministic period-key
lookup in ActivityLog (no mutable "sent" flag) under `LockService`, so re-fires never
double-send. New `backend/Digests.js`; `script.send_mail` scope added (shared account
re-authorized). Validated end-to-end — `selfTest()` ALL PASS, `setupDatabase()` seeded the 5
new Settings keys, `installDigestTrigger()` installed, and a real `sendWeeklyDigestNow()` run
delivered correctly owner-filtered, color-coded emails to both inboxes (quickstart Scenario A
confirmed manually).

_007 merged to `main` (PR #7) and deployed to the Apps Script web app (`clasp` @11, same stable URL). One-way outbound sync of Events + dated Tasks → shared Household Google Calendar; nightly `syncCalendar()` trigger installed on the shared account, which is now authorized for the broad `calendar` scope (front-loaded so 011 needs no re-auth). `Tasks.gcalEventId` column + `gcalEventReminderMin`/`gcalTaskReminderTime` Settings live. Validated end-to-end (selfTest ALL PASS + quickstart A–G on both phones). Feature 011 work-calendar decisions (sharing target, ignore-list, auto-invite) captured in brief §5 item 16._

_006 merged to `main` and deployed to GitHub Pages at `https://maxwellbw.github.io/household-hq/` (Vite + React + Schedule-X calendar frontend; first frontend feature). Deploy runs on push to `main` via `.github/workflows/deploy-frontend.yml`, reading repo Variables `VITE_API_BASE_URL` (backend `clasp` @10) + `VITE_GOOGLE_CLIENT_ID`. One user-run validation still open: T057 live quickstart sign-in walkthrough (Scenarios A–G)._

## How to keep this current

- After `/speckit.specify`: mark stage `spec written`.
- After `/speckit.clarify`: mark stage `clarified`.
- After `/speckit.plan`: mark stage `planned`.
- After `/speckit.tasks`: mark stage `tasks generated` (⏸ review gate — waiting on go-ahead).
- After `/speckit.implement` + clasp deploy + quickstart validation: mark stage `implemented, pending PR`.
- After PR merge: mark stage `✅ merged`, fill in the PR link, move "Currently active" to the next feature in brief §10.
