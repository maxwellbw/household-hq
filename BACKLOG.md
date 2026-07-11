# Household HQ — Backlog / Sprint Tracker

Per-feature detail lives in `specs/NNN-name/`. This file is the one-glance index —
update it whenever a feature moves stage (spec written, plan done, tasks generated,
implemented, merged). Ask Claude to "update BACKLOG.md" after any speckit step or PR merge.

**The queue below is the source of truth for feature order** (supersedes brief §10;
order confirmed by Jaz 2026-07-11, including 010/011 — definitely a go, slotted last).

**Stage legend:** `spec` → `clarify` → `plan` → `tasks` → `implement` → `deployed` → `merged`

## The queue — up next, in order

**Next up: 019 — Task & event details + collaboration** (022 merged 2026-07-11; 019 is next in the confirmed order).

| Order | # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|---|
| 1 | 019 | Task & event details + collaboration | ⬜ not started | — | — |
| 2 | 020 | Settings editor under More | ⬜ not started | — | — |
| 3 | 021 | Someday force-rank + Tasks-tab Someday section | ⬜ not started | — | — |
| 4 | 023 | Dog-care recurring seed rows | ⬜ not started | — | — |
| 5 | 024 | Grocery & household lists | ⬜ not started | — | — |
| 6 | 025 | Recurring events | ⬜ not started | — | — |
| 7 | 026 | Inbound gcal import (personal calendars) | ⬜ not started | — | — |
| 8 | 010 | PWA install + web push | ⬜ not started | — | — |
| 9 | 011 | Weather-aware dog-walk window finder | ⬜ not started | — | — |

**019 — Task & event details + collaboration** (scope extended 2026-07-11, Jaz's feedback
round 3). (a) **Notes on tasks**: new Tasks sheet column (Events already have `notes`),
editable wherever details open, URLs render as tappable links (air-filter buy link,
reservation / Google Maps link). (b) **Acknowledge/commit** (clarified 2026-07-10): tasks
assigned to the other person get an "I've got it" action; the assigner gets a **dismissible
dashboard notification + instant ntfy ping** (009 plumbing reused); unacknowledged assigned
tasks visibly read as "not yet committed". (c) **Event notes editing** (added 2026-07-11):
the `notes` column exists and `EventDetailSheet` displays it, but no create/edit UI ever
asks — add a notes field to event create + `EventEditSheet`, same tappable-link rendering
as tasks. (d) **Event location** (added 2026-07-11): new Events sheet column + create/edit
UI + display in the detail sheet, and `CalendarSync.js` maps it onto the mirrored gcal
event's location so Google Maps/directions work from the synced calendar.

**020 — Settings editor under More.** Curated form (clarified: not a raw key–value
editor): digest schedule (weekly/monthly day + hour), ntfy pings on/off, calendar reminder
minutes, timezone. Allowlist emails and ntfy topics stay Sheet-only for safety. Needs a
`settings.update` backend action (does not exist yet).

**021 — Someday force-rank + Tasks-tab Someday section.** "This or that?" pairwise session
through the Someday list producing **one shared household ranking** (clarified: not
per-owner); persisted order drives the list. Efficient insertion (merge-sort-style
comparisons), resumable. **Added 2026-07-11:** undated tasks currently hide at the bottom
of "Open" via a `9999-99-99` sort sentinel (`frontend/src/lib/tasks.ts`) — split them out
into a labeled **Someday section at the bottom of the Tasks tab**, rendered in the shared
ranking order, collapsible like the other sections (022 makes Open/Done collapsible; the
new Someday section ships collapsible from day one).

**023 — Dog-care recurring seed rows** (backend-only; extends 015's `Seed.js` pattern).
Standard set, owned by `both`, hand-edit after seeding (clarified 2026-07-11): flea/tick
meds monthly, heartworm monthly, nail trim ~6 weeks, grooming ~8 weeks. Annual vet +
vaccines waits for 025 (yearly recurrence) or is seeded as a yearly rule if 025's engine
work lands first.

**024 — Grocery & household lists.** Modeled on Jaz's Apple Notes flow: a **standalone
persistent list** (clarified 2026-07-11 — not task-attached `listItems`), items live forever
and toggle **need ⇄ stocked** with one tap; buying something flips it back to stocked, ready
for next time. All four extras confirmed: **staples flag + time-to-shop signal** (enough
staples out → dashboard nudge — automates the current "we're out of key things" trigger);
**store sections** (produce/dairy/frozen/… so the needed view reads in aisle order);
**multiple lists** (groceries, Costco, hardware, pharmacy — same mechanics); **per-item
note/quantity** ("2 bags", "the good brand"). Needs a new Sheet tab (hand-editable like
everything else) and a Lists screen; must be EXTREMELY low-friction to add/flip items.

**025 — Recurring events.** The 004 engine materializes tasks only; birthdays,
anniversaries, annual checkups have no home and get re-created by hand. Extend recurrence
to Events with **full parity with the task engine** (weekly / biweekly / monthly / yearly —
clarified 2026-07-11), and **prep templates attachable to the rule** so each occurrence
auto-generates its prep tasks (birthday → buy gift, plan dinner — reuses 005's template
mechanics).

**026 — Inbound gcal import (personal calendars).** Pull externally-created events
(reservations, appointments) from **Max's and Jaz's personal gmail calendars** (shared to
the household account, which the Apps Script runs as) into the app. **Work calendars stay
free/busy only** (clarified 2026-07-11) — they feed 011's mutual-free-window finder and
never appear as events in the household calendar. Imported events are **read-only mirrors**
(clarified 2026-07-11): the external calendar stays source of truth, re-syncs update the
copy, time/title edits happen in Google Calendar — but prep tasks and notes can still be
attached in the app. Needs dedupe against our own outbound mirrors from 007
(`gcalEventId` both directions).

**010 — PWA install + web push** (brief §10 item 11). Installable PWA (manifest + service
worker on the GitHub Pages deploy) and web-push notifications. Builds on 018's session
persistence so the installed app opens signed-in.

**011 — Weather-aware dog-walk window finder** (brief §5 item 16; decisions captured there
2026-07-09). Open-Meteo forecast ∩ mutual-free windows from both work calendars, read as
**free/busy only** (re-confirmed 2026-07-11 at 026's clarify): Max's work calendar shares
full details directly to `household@example.com` (no extra credentials needed —
`CalendarApp.getCalendarById()`); Jaz's sharing capability TBD (ICS fallback). Configurable
ignore-list for not-really-busy titles (Focus time, Hold, …); auto-invite + auto-accept
booking of good windows up to 3 weeks out, idempotent via stored event ids, with a
suggest-only mode first.

## Parked (unscheduled — pull into the queue when prioritized)

From the brief: quick-add by email (#14), recurring-chore streaks/history (#17), and naming
the app (open question #6 — "Household HQ" is still the placeholder). Shopping lists (#18)
promoted to **024** 2026-07-11 as standalone persistent lists — the Tasks `listItems` field
stays unused for now (task-attached checklists explicitly not chosen). Inbound gcal import
(parked 2026-07-10) promoted to **026**. Noted 2026-07-11 as future fix-batch candidates:
per-event gcal reminder overrides, an explicit all-day toggle on events (time-less events
currently default to 9:00 AM), and duplicate-an-event ("same as last year", pulling its
prep template).

## Phase 4 — Someday (data-model-compatible only; build nothing yet)

- Projects concept (vendor threads grouping tasks)
- Claude API vendor outreach (draft/parse/propose, human sends)

---

## Shipped

| # | Feature | Spec folder | PR |
|---|---|---|---|
| 001 | Sheets schema and JSON API | [specs/001-sheets-schema-and-api](specs/001-sheets-schema-and-api/spec.md) | [#1](https://github.com/maxwellbw/household-hq/pull/1) |
| 002 | Auth allowlist + verified attribution | [specs/002-auth-allowlist](specs/002-auth-allowlist/spec.md) | [#2](https://github.com/maxwellbw/household-hq/pull/2) |
| 003 | Tasks CRUD and activity log | [specs/003-tasks-crud-and-activity-log](specs/003-tasks-crud-and-activity-log/spec.md) | [#3](https://github.com/maxwellbw/household-hq/pull/3) |
| 004 | Recurring chore engine | [specs/004-recurring-engine](specs/004-recurring-engine/spec.md) | [#4](https://github.com/maxwellbw/household-hq/pull/4) |
| 005 | Events and prep templates | [specs/005-events-and-prep-templates](specs/005-events-and-prep-templates/spec.md) | [#5](https://github.com/maxwellbw/household-hq/pull/5) |
| 006 | Calendar UI (home screen) | [specs/006-calendar-ui](specs/006-calendar-ui/spec.md) | [#6](https://github.com/maxwellbw/household-hq/pull/6) |
| 007 | Google Calendar sync | [specs/007-gcal-sync](specs/007-gcal-sync/spec.md) | [#7](https://github.com/maxwellbw/household-hq/pull/7) |
| 008 | Email digests | [specs/008-email-digests](specs/008-email-digests/spec.md) | [#8](https://github.com/maxwellbw/household-hq/pull/8) |
| 009 | ntfy.sh completion pings (live validation deferred) | [specs/009-ntfy-pings](specs/009-ntfy-pings/spec.md) | [#9](https://github.com/maxwellbw/household-hq/pull/9) |
| 012 | App shell & task UX | [specs/012-app-shell-task-ux](specs/012-app-shell-task-ux/spec.md) | [#10](https://github.com/maxwellbw/household-hq/pull/10) |
| 013 | Someday list (tap-to-schedule; drag deferred) | [specs/013-someday-list](specs/013-someday-list/spec.md) | [#11](https://github.com/maxwellbw/household-hq/pull/11) |
| 014 | Home dashboard | [specs/014-home-dashboard](specs/014-home-dashboard/spec.md) | [#12](https://github.com/maxwellbw/household-hq/pull/12) |
| 015 | Recurring seed pack & alternating weeks | [specs/015-recurring-seed-pack](specs/015-recurring-seed-pack/spec.md) | [#14](https://github.com/maxwellbw/household-hq/pull/14) |
| 016 | UX fix batch (task editing + dead controls) | [specs/016-ux-fix-batch](specs/016-ux-fix-batch/spec.md) | [#15](https://github.com/maxwellbw/household-hq/pull/15) |
| 017 | Calendar views & 7-day surfaces | [specs/017-calendar-views](specs/017-calendar-views/spec.md) | [#16](https://github.com/maxwellbw/household-hq/pull/16) |
| 018 | Stay signed in (session persistence) | [specs/018-stay-signed-in](specs/018-stay-signed-in/spec.md) | [#17](https://github.com/maxwellbw/household-hq/pull/17) |
| 022 | UX fix batch 2 (snooze on calendar, delete, collapsible Open) | [specs/022-ux-fix-batch-2](specs/022-ux-fix-batch-2/spec.md) | [#18](https://github.com/maxwellbw/household-hq/pull/18) |

**Planning history:** Phase 1 (001–007) + Phase 2 (008–009) per brief §10 · Phase 2.5
(012–015) planned 2026-07-09, Jaz's feedback round 1 — the backend had outrun the UI ·
Phase 2.6 (016–021) planned 2026-07-10, feedback round 2 — confirmed bugs + fix & flow ·
Phase 2.7 (022–026) planned 2026-07-11, feedback round 3 — gap review found snooze
unreachable from the calendar, delete APIs with no UI, tasks-only recurrence, and promoted
grocery lists + inbound gcal import from the parked list.

### Post-merge notes & open follow-ups

**Open follow-ups first:** 009's live validation is still deferred (run `setupDatabase()` +
`selfTest()`, pick topics, subscribe phones, quickstart A–F). 016, 017, 018, and **022** all
shipped without a live browser pass (the sandboxed preview can't do real Google OAuth) —
**a manual desktop + mobile quickstart pass is still recommended for all four; 018
especially, since its core value (silent restore/refresh) is exactly what the sandbox
can't exercise** — see `specs/018-stay-signed-in/quickstart.md`. 006's T057 live sign-in
walkthrough was never formally run. 013's US3 (desktop drag-onto-day) is deferred until
Schedule-X exposes stable `data-date` on month-grid cells.

_018 (PR #17). Frontend-only, no backend/scope/clasp change. GIS `auto_select` + a silent
`prompt()` restore on boot (`RestoringGate` while resolving; falls back to the sign-in wall
once, no loop, on decline); reactive single-flight token refresh + retry via a new
`authedCall()` on `useAuth` (migrated all 7 data hooks off raw `apiCall({ token:
session!.token })`); new `frontend/src/lib/session-store.ts` holds only an auto-sign-in
hint + the remembered acting person in `localStorage` — **no credential is ever
persisted**. Shared-account returns show a dismissible `ActingPersonAffirm` ("Signed in as
X — switch?") instead of the blocking prompt. Sign-out clears both storage keys and
disables auto-select. 202 tests green (17 new); `/impeccable audit` fixed one WCAG 2.4.7
gap (missing focus ring). Merged without the real-device quickstart pass (Jaz's call,
2026-07-11) — see the follow-up note above._

_022 (PR #18). Frontend-only; every backend piece (`tasks.snooze`, `tasks.delete`,
`events.delete`) already existed. `TaskDetailSheet` gained a persistent Snooze action
opening the existing `SnoozeDialog` (previously only Un-snooze was reachable from the
calendar). New shared `ConfirmDialog` (`components/ui/`) + `useDeleteTask`/`useDeleteEvent`
wire delete into both detail sheets: recurring-generated tasks get instance-only copy (rule
untouched, still managed under More → Recurring); events show the exact prep-task count
that will also be removed (clarified 2026-07-11), or omit the clause when there are none.
Tasks-tab Open section is now collapsible like Done, defaulting expanded — the pattern
021's Someday section will reuse. 219 tests green (17 new); `/impeccable audit` (code-level
— sandbox blocks live OAuth) fixed a 44px touch-target gap in the new `ConfirmDialog`.
Merged without the real-device quickstart pass (Jaz's call, 2026-07-11) — see the
follow-up note above._

_017 (PR #16). Frontend-only. `CalendarViewSwitcher` adds fixed Sun–Sat week + rolling
Next-7-days views on desktop **and** mobile via bespoke `DayListView`/`DayColumn` all-day
chip columns (household items are almost entirely all-day — `research.md` R1); Sunday is
first-of-week everywhere. Root-caused two mobile month-nav bugs in `calendar-theme.css`
(Schedule-X's `.sx__is-calendar-small` width detection hid the prev/next arrows; its
`height:100%; overflow:hidden` clipped the month grid). Desktop month cells cap at 3 chips
with "+N more" jumping to a single-day list; event chips show "M/N tasks" prep progress;
overdue open tasks display-only remap onto today with a badge (stored `dueDate` untouched,
no re-sync); new dashboard `SevenDayStrip` deep-links into the calendar. 185 tests green;
`/impeccable audit` fixed two `--ink-faint` contrast repeats + a 36px touch target._

_016 (PR #15). Frontend-only. Quick Add no longer force-dates blank-date tasks (they land
in Someday); new `TaskEditSheet` + read-only-then-Edit `TaskDetailSheet` make tasks
editable/reassignable; "Edit due" opens detail in edit mode; calendar task chips open
`TaskDetailSheet`, and event-tap breakage was root-caused to Schedule-X's `isResponsive`
logic destroying event DOM nodes on resize (fixed with `isResponsive: false`; see
`specs/016-ux-fix-batch/research.md` R4b). 150 tests green; one audit contrast fix
(3.06:1 → 5.68:1)._

_015 (PR #14). Recurring seed pack + alternating-week bins as offset biweekly rules._

_014 (PR #12). Frontend-only. Dashboard is now the landing view (replaces calendar-first):
smart views (Today / Overdue / This weekend), week + month load balance per owner, ≤ 3
sparse highlights. Constitution amended v1.0.0 → v1.1.0 (dashboard-first), co-approved by
Max + Jaz. WCAG AA fix: owner-both dot contrast 4.05:1 → 5.25:1. 136 tests green._

_013 (PR #11). Frontend-only. Undated open tasks appear in a Someday section below the
calendar, owner-filtered, completable in place; tapping opens the date + owner dialog (no
pre-selection, Confirm gated on both). Three WCAG AA contrast failures fixed in audit._

_009 (PR #9, `clasp` @13). Real open→done completions POST "<Completer> completed: <title>"
to **the other person's** private ntfy topic (never yourself; `both`-owned included).
Best-effort side effect in `completeTask_` — no trigger, no new scope, no frontend. New
`backend/Ntfy.js`; Settings key `ntfyEnabled`._

_008 (PR #8, `clasp` @12). Weekly "week ahead" + monthly "next month" HTML digests via
`MailApp` on a daily-gate trigger; own+`both` filtering only. Schedule hand-editable in
Settings (only `digestHour` needs `installDigestTrigger()` re-run). Dedupe via period-key
lookup in ActivityLog under `LockService`. `script.send_mail` scope added. Validated
end-to-end on both inboxes._

_007 (PR #7, `clasp` @11). One-way outbound sync of Events + dated Tasks → shared Household
Google Calendar; nightly `syncCalendar()` trigger on the shared account, authorized for the
broad `calendar` scope (front-loaded so 011 needs no re-auth). `Tasks.gcalEventId` +
reminder Settings live. Validated end-to-end on both phones; 011 work-calendar decisions
captured in brief §5 item 16._

_006. First frontend feature — Vite + React + Schedule-X, deployed to GitHub Pages at
`https://maxwellbw.github.io/household-hq/` via `.github/workflows/deploy-frontend.yml`
(repo Variables `VITE_API_BASE_URL` + `VITE_GOOGLE_CLIENT_ID`)._

_012 (PR #10). Frontend-only. Working Tasks / Feed / More navigation (were disabled stubs),
complete/reopen anywhere, snooze with visible history, event end date in create/edit,
management screens under More for Recurring rules and TaskTemplates._

## How to keep this current

- After `/speckit.specify`: mark stage `spec written`.
- After `/speckit.clarify`: mark stage `clarified`.
- After `/speckit.plan`: mark stage `planned`.
- After `/speckit.tasks`: mark stage `tasks generated` (⏸ review gate — waiting on go-ahead).
- After `/speckit.implement` + clasp deploy + quickstart validation: mark stage `implemented, pending PR`.
- After PR merge: mark stage `✅ merged`, fill in the PR link, and promote the next feature in the queue to "Next up".
