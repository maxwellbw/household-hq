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
| 012 | App shell & task UX | ✅ merged | [specs/012-app-shell-task-ux](specs/012-app-shell-task-ux/spec.md) | [#10](https://github.com/maxwellbw/household-hq/pull/10) |
| 013 | Someday list (tap-to-schedule; drag deferred) | ✅ merged | [specs/013-someday-list](specs/013-someday-list/spec.md) | [#11](https://github.com/maxwellbw/household-hq/pull/11) |
| 014 | Home dashboard | ✅ merged | [specs/014-home-dashboard](specs/014-home-dashboard/spec.md) | [#12](https://github.com/maxwellbw/household-hq/pull/12) |
| 015 | Recurring seed pack & alternating weeks | ✅ merged | [specs/015-recurring-seed-pack](specs/015-recurring-seed-pack/spec.md) | [#14](https://github.com/maxwellbw/household-hq/pull/14) |

**012 — App shell & task UX** (frontend-only; every backend piece already exists).
Working Tasks / Feed / More navigation on mobile *and* desktop (006 shipped them as disabled
stubs); complete/reopen a task from anywhere it appears (today only `TaskRow` inside
`EventDetailSheet` has a checkbox); snooze/defer with visible history (brief #11 — backend
`snoozed` status + `snoozeHistory` already exist); event **end date** in create/edit (Sheet has
the column, the UI never asks); management screens under More for Recurring rules and
TaskTemplates (list/edit/delete — answers "where do I set up templates?").

**013 — Someday list.** Undated tasks (already supported by the API, currently invisible)
shown in a list below the calendar. Scheduling one **always opens a mini-dialog asking date +
owner** (clarified 2026-07-09 — no implicit ownership from who dragged). US1 (see + complete)
+ US2 (tap-to-schedule) are implemented. **US3 (desktop drag-onto-day) deferred 2026-07-10:**
Schedule-X month-grid cells expose no `data-date`; the `is-leading-or-trailing` class used to
reconstruct the month is keyed to `selectedDate`, not the viewed month, producing wrong dates on
navigation — too fragile to ship (constitution IV). Revisit when Schedule-X adds stable `data-date`.

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

## Phase 2.6 — Fix & flow (planned 2026-07-10, Jaz's feedback round 2)

Jaz's second feedback pass after living with 012–015. Mix of confirmed bugs (root causes
identified in code) and new capabilities. Order clarified with Jaz 2026-07-10: bug batch
first, then calendar, then the rest. Slots before 010/011 (same UI-before-backend
rationale as Phase 2.5 — Phase 3 reorder still pending Max's co-sign).

| # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|
| 016 | UX fix batch (task editing + dead controls) | 🔨 implemented, pending PR | [specs/016-ux-fix-batch](specs/016-ux-fix-batch/spec.md) | — |
| 017 | Calendar views & 7-day surfaces | ⬜ not started | — | — |
| 018 | Stay signed in (session persistence) | ⬜ not started | — | — |
| 019 | Task collaboration (notes, links, acknowledge) | ⬜ not started | — | — |
| 020 | Settings editor under More | ⬜ not started | — | — |
| 021 | Someday force-rank | ⬜ not started | — | — |

**016 — UX fix batch** (frontend-only; every backend piece exists). Confirmed bugs:
Quick Add force-dates blank-date tasks to today (`quickAdd.ts` `buildOneTimeTaskPayload`
`dueDate || todayKey()` — defeats 013's Someday list and is why it looks empty);
TaskRow's "Edit due" menu item is dead (`TasksView` never passes `onEditDue`); tasks can't
be edited/reassigned anywhere (`TaskDetailSheet` shows only snooze history — backend
`tasks.update` already accepts title/owner/dueDate); calendar items don't open on tap
(events *should* open `EventDetailSheet` — investigate why not, mobile + desktop; task
clicks are explicitly ignored in `CalendarHome` `onEventClick` — add a task detail sheet).

**017 — Calendar views & 7-day surfaces.** View dropdown gets **both** a fixed Sun–Sat
week view and a rolling next-7-days view (clarified 2026-07-10); week starts Sunday
everywhere; month prev/next arrows visible on mobile + month scrolling; de-clutter desktop
month-grid stacking (compact chips / "+N more"); event chips show prep-task progress
("3/7 tasks"); **overdue is display-only** (clarified: an overdue open task keeps its real
dueDate in the Sheet but renders on today with an overdue badge — no nightly date rewriting,
no gcal re-sync churn; dashboard already has the Overdue smart view). Plus the dashboard's
**rolling 7-day strip**: seven compact day tiles (today first) with owner-colored dots/counts,
tap a day → calendar on that date.

**018 — Stay signed in.** Google ID tokens live ~1 hour and the app holds them in memory
only (feature 002/006 decision, now outgrown) — so every visit re-prompts, worst on mobile.
Persist the session and silently re-acquire tokens (GIS auto-select / One Tap re-prompt)
so sign-in is rare, not routine. Pairs naturally with 010 (PWA) later.

**019 — Task collaboration.** (a) **Notes on tasks**: new Tasks sheet column (Events
already have `notes`), editable wherever details open, URLs render as tappable links
(air-filter buy link, reservation / Google Maps link). (b) **Acknowledge/commit**
(clarified 2026-07-10): tasks assigned to the other person get an "I've got it" action;
the assigner gets a **dismissible dashboard notification + instant ntfy ping** (009
plumbing reused); unacknowledged assigned tasks visibly read as "not yet committed".
Inbound gcal reservation import explicitly deferred (parked below with the unscheduled items).

**020 — Settings editor under More.** Curated form (clarified: not a raw key–value
editor): digest schedule (weekly/monthly day + hour), ntfy pings on/off, calendar reminder
minutes, timezone. Allowlist emails and ntfy topics stay Sheet-only for safety. Needs a
`settings.update` backend action (does not exist yet).

**021 — Someday force-rank.** "This or that?" pairwise session through the Someday list
producing **one shared household ranking** (clarified: not per-owner); persisted order
drives the list. Efficient insertion (merge-sort-style comparisons), resumable.

## Phase 3 — Stretch (follows Phase 2.5 — reorder of brief §10 pending Max's co-sign)

| # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|
| 010 | PWA install + web push | ⬜ not started | — | — |
| 011 | Weather-aware dog-walk window finder | ⬜ not started | — | — |

**Still unscheduled from the brief** (park here until prioritized): quick-add by email (#14),
recurring-chore streaks/history (#17), shopping/errand list items on tasks (#18 — the
`listItems` field already exists in the Tasks schema), and naming the app (open question #6 —
"Household HQ" is still the placeholder). **Added 2026-07-10:** inbound Google Calendar
import — pull externally-created events (e.g. OpenTable reservations) from the shared
calendar into the app; needs dedupe against our own outbound mirrors (007), so deferred
from 019's scope.

## Phase 4 — Someday (data-model-compatible only; build nothing yet)

- Projects concept (vendor threads grouping tasks)
- Claude API vendor outreach (draft/parse/propose, human sends)

---

## Currently active

**016 — UX fix batch: implemented, awaiting review/PR.** Frontend-only, no backend deploy
needed. Fixed: (1) Quick Add blank-date tasks now omit `dueDate` instead of defaulting to
today, so they land in Someday. (2) New `TaskEditSheet` (mirrors `EventEditSheet`) lets
title/owner/dueDate be edited from a read-only-then-Edit `TaskDetailSheet`, via new
`useUpdateTask`. (3) TaskRow's "Edit due" now opens that same detail sheet already in edit
mode. (4) Calendar taps: task chips now open `TaskDetailSheet` (were explicitly ignored);
event taps' root cause was confirmed to be Schedule-X's own `isResponsive` breakpoint logic
fighting our `isMobile`/`defaultView` choice and destroying/rebuilding event DOM nodes on
resize — fixed with `isResponsive: false`; also registered `monthAgendaEvent` so the mobile
agenda view gets our owner-colored `EventContent` instead of Schedule-X's plain default
(see `specs/016-ux-fix-batch/research.md` R4b for the full trace). 150 tests green (up from
136 baseline), build clean, `/impeccable audit` clean (one contrast fix applied: informative
empty-state text moved off `--ink-faint` onto `--ink-muted`, 3.06:1 → 5.68:1).
**Live quickstart validation (desktop + mobile in a real browser) could not be completed
in this session** — the app requires real Google OAuth sign-in against the allowlisted
accounts, which the sandboxed preview browser has no credentials for; automated
component/integration tests exercise the same code paths instead. Recommend a quick manual
pass before merging.

_015 merged to `main` (PR #14). Recurring seed pack + alternating-week bins as offset
biweekly rules._

_014 merged to `main` (PR #12). Frontend-only. Dashboard is now the landing view (replaces calendar-first): smart views (Today / Overdue / This weekend), week + month load balance per owner, and ≤ 3 sparse highlights (upcoming multi-day/weekend events, rare quarterly/annual chores). Constitution amended v1.0.0 → v1.1.0 (dashboard-first principle), co-approved by Max + Jaz. WCAG AA P1 fix: owner-both dot contrast lifted from 4.05:1 to 5.25:1 across all views. 136 tests green._

_013 merged to `main` (PR #11). Frontend-only. Undated open standalone tasks appear in a Someday section below the calendar, owner-filtered, completable/reopenable in place. Tapping a task title opens a bottom-sheet dialog asking date + owner (no pre-selection); Confirm gated on both; success invalidates `['tasks']` so the task moves to the calendar without a refresh. US3 (desktop drag-onto-day) deferred: Schedule-X month-grid cells have no `data-date`, making drop-date reconstruction wrong on month navigation — revisit when Schedule-X exposes stable `data-date`. Three WCAG AA contrast failures fixed in the audit pass (selected-owner text, Confirm button, broken aria-labelledby)._

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
