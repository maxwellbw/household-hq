# Household HQ — Backlog / Sprint Tracker

Per-feature detail lives in `specs/NNN-name/`. This file is the one-glance index —
update it whenever a feature moves stage (spec written, plan done, tasks generated,
implemented, merged). Ask Claude to "update BACKLOG.md" after any speckit step or PR merge.

**The queue below is the source of truth for feature order** (supersedes brief §10;
order confirmed by Jaz 2026-07-11, including 010/011 — definitely a go, slotted last).

**Stage legend:** `spec` → `clarify` → `plan` → `tasks` → `implement` → `deployed` → `merged`

## The queue — up next, in order

**Next up: PRIV — Public-repo personal-data scrub** (added 2026-07-14 after the 011 merge surfaced that `maxwellbw/household-hq` is **public**, not private as the codebase assumed — see the description below; must be done before more personal data accretes).

| Order | # | Feature | Stage | Spec folder | PR |
|---|---|---|---|---|---|
| 1 | 021 | Someday force-rank + Tasks-tab Someday section | ✅ merged | specs/021-someday-force-rank | [#21](https://github.com/maxwellbw/household-hq/pull/21) |
| 2 | 023 | Dog-care recurring seed rows | ✅ merged | specs/023-dog-care-seed-rows | [#22](https://github.com/maxwellbw/household-hq/pull/22) |
| 3 | 024 | Grocery & household lists | ✅ merged | specs/024-grocery-household-lists | [#23](https://github.com/maxwellbw/household-hq/pull/23) |
| 4 | 025 | Recurring events | ✅ merged | specs/025-recurring-events | [#24](https://github.com/maxwellbw/household-hq/pull/24) |
| 5 | 027 | Household seed data + engine extensions | ✅ merged | specs/027-household-seed-data | [#25](https://github.com/maxwellbw/household-hq/pull/25) |
| 6 | 028 | UX fix batch 3 (mobile polish + save speed + event lookahead) | ✅ merged | specs/028-ux-fix-batch-3 | [#27](https://github.com/maxwellbw/household-hq/pull/27) |
| 7 | 010 | PWA install + web push | ✅ merged (real-iPhone checks still pending — see Shipped notes) | specs/010-pwa-and-push | [#28](https://github.com/maxwellbw/household-hq/pull/28) |
| 8 | 011 | Weather-aware dog-walk window finder | ✅ merged (live-validated suggest-only; real auto-book run pending — see Shipped notes) | specs/011-dog-walk-finder | [#29](https://github.com/maxwellbw/household-hq/pull/29) |
| 9 | **PRIV** | **Public-repo personal-data scrub (git history rewrite)** | ⬜ **next up — not started** | — | — |
| 10 | 026 | Inbound gcal import (personal calendars) | ⬜ not started | — | — |

**PRIV — Public-repo personal-data scrub (git history rewrite).** Added 2026-07-14. During
011's live setup we discovered `maxwellbw/household-hq` is a **public** repo — it must stay
public for GitHub Pages + the external API URL — while the whole codebase was built assuming
private (`CLAUDE.md` still literally says "the repo is private, so IDs live here as plain
constants"). Personal data is committed and already sitting in **public git history**:
- the shared household email (`vapidSubject: 'mailto:…@gmail.com'` in `backend/Config.js`, feature 010);
- real **family birthdays, names, gift recipients**, and the household's actual grocery/household
  lists (`docs/seed-data.md` + `Config.js` `EVENT_SEED_PACK` / `LIST_SEED_PACK` / `TEMPLATE_SEED_PACK`, feature 027);
- the committed `SPREADSHEET_ID` and `OAUTH_CLIENT_ID` (access is still gated by Google ID
  token + email allowlist, so **not** an open door, but both are world-readable).

Confirmed **not** committed (good): the VAPID private key and clasp credentials (Sheet-only / local).
Scope for the task: (1) inventory exactly what's exposed; (2) move personal seed data out of the
tracked repo — into the Sheet, an untracked local file, or GitHub Actions secrets — and
genericize committed config; (3) **rewrite history** (`git filter-repo` / BFG) + force-push to
purge it from all past commits; (4) decide whether to re-create the Google Sheet (its id is
public) and move IDs into Actions secrets; (5) correct `CLAUDE.md`'s stale "repo is private"
assumption. This is a security/privacy cleanup, not a feature — it needs a careful written plan
and **explicit approval before any force-push** (history rewrite is destructive and coordinated).

**021 — Someday force-rank + Tasks-tab Someday section.** "This or that?" pairwise session
through the Someday list producing **one shared household ranking** (clarified: not
per-owner); persisted order drives the list. Efficient insertion (merge-sort-style
comparisons), resumable. **Added 2026-07-11:** undated tasks currently hide at the bottom
of "Open" via a `9999-99-99` sort sentinel (`frontend/src/lib/tasks.ts`) — split them out
into a labeled **Someday section at the bottom of the Tasks tab**, rendered in the shared
ranking order, collapsible like the other sections (022 makes Open/Done collapsible; the
new Someday section ships collapsible from day one).

**023 — Dog-care recurring seed rows** (extends 015's `Seed.js` pattern). Standard set,
owned by `both`, hand-edit after seeding (clarified 2026-07-11): flea/tick meds monthly,
heartworm monthly, nail trim ~6 weeks, grooming ~8 weeks. Annual vet + vaccines waits for
025 (yearly recurrence) or is seeded as a yearly rule if 025's engine work lands first.
**Clarified 2026-07-12:** the engine had no 6-/8-week cadence (nothing between monthly and
quarterly), so this widened from "backend-only" to add two new fixed cadences —
`sixweekly` (+42d) / `eightweekly` (+56d) — across `backend/Config.js` + `Recurring.js`
**and** the frontend `Cadence` type/labels/dropdowns (`RecurringManager.tsx`,
`QuickAddSheet.tsx`), so seeded rows display and stay hand-selectable. Still no new API
action or screen; `seedRecurringPack()`/the ledger from 015 are untouched.

**024 — Grocery & household lists.** Modeled on Jaz's Apple Notes flow: a **standalone
persistent list** (clarified 2026-07-11 — not task-attached `listItems`), items live forever
and toggle **need ⇄ stocked** with one tap; buying something flips it back to stocked, ready
for next time. All four extras confirmed: **staples flag + time-to-shop signal** (enough
staples out → dashboard nudge — automates the current "we're out of key things" trigger);
**store sections** (produce/dairy/frozen/… so the needed view reads in aisle order);
**multiple lists** (groceries, Costco, hardware, pharmacy — same mechanics); **per-item
note/quantity** ("2 bags", "the good brand"). Needs a new Sheet tab (hand-editable like
everything else) and a Lists screen; must be EXTREMELY low-friction to add/flip items.
**Clarified 2026-07-12:** sections fixed at Produce/Dairy/Frozen/Pantry/Household/Other;
staple-nudge threshold lives in Settings (`groceryStapleNudgeThreshold`, default 3).
**Planned 2026-07-12:** two new tabs, `Lists` + `ListItems` (no owner field — always
shared); Lists **replaces the Feed tab** in the bottom nav (Feed moves into More) since
this is meant to be checked multiple times a day. See specs/024-grocery-household-lists/.

**025 — Recurring events.** The 004 engine materializes tasks only; birthdays,
anniversaries, annual checkups have no home and get re-created by hand. Extend recurrence
to Events with **full parity with the task engine** (weekly / biweekly / monthly / yearly —
clarified 2026-07-11), and **prep templates attachable to the rule** so each occurrence
auto-generates its prep tasks (birthday → buy gift, plan dinner — reuses 005's template
mechanics).

**027 — Household seed data + engine extensions.** Added 2026-07-12, out of the confirmed
order, at Jaz's direct request — the app was fully built but empty, so real starting data
was wanted before more feature work. Loads Max & Jaz's actual shopping lists (2 lists, 38
items), 8 birthdays + 5 anniversaries with per-person prep, 13 recurring
maintenance/yard/holiday/vet tasks, and 2 multi-task prep templates
(`docs/seed-data.md`), via one idempotent `seedHousehold()` (mirrors `seedRecurringPack()`
— per-item seed keys + Settings ledgers, hand-edits/deletions always preserved). Needed
three small engine extensions: a `semiannually` cadence (mirrors 023's
sixweekly/eightweekly precedent), a computed `thanksgiving-sat` cadence so "put up
Christmas lights" never drifts off the actual weekend, and a `{nth}` title token so
anniversary occurrences bake a live ordinal ("6th dating anniversary") with no schema
change. Also ships the list-item search box (US5) that the now much-longer Groceries list
needed. See specs/027-household-seed-data/.

**028 — UX fix batch 3** (Jaz's feedback round 4, 2026-07-13 — mostly real-device mobile
findings; all scope questions clarified same day). Eight items:
1. **Recurring-events lookahead by cadence** (backend): yearly rules materialize **12+
   months ahead** (366 days) so all seeded birthdays/anniversaries appear now; other
   cadences keep the 60-day `recurringEventsLookaheadDays` window (clarified — don't flood
   the calendar/gcal mirror with ~52 occurrences per weekly rule). One-time
   `generateRecurringEvents()` re-run after deploy to backfill.
2. **Fast saves**: creates and edits (Quick Add, task/event edit sheets) go optimistic —
   sheet closes immediately, background sync, revert + toast on failure (clarified: only
   creates/edits feel slow; the already-optimistic one-tap actions are fine). The pattern
   `useMutations.ts` already uses for complete/snooze/acknowledge, extended.
3. **No mobile zoom**: viewport meta (`maximum-scale=1, user-scalable=no`,
   `viewport-fit=cover`) + ≥16px input font-size so iOS stops auto-zooming on focus.
4. **Bottom nav safe area**: `env(safe-area-inset-bottom)` padding so the nav clears the
   iPhone home-indicator swipe zone (currently zero safe-area handling anywhere).
5. **Dashboard day peek**: tapping a day on the `SevenDayStrip` shows that day's
   events/tasks inline **below the strip**, with an "open in calendar" link in the panel
   (clarified: inline + link, replacing the current direct deep-link).
6. **Acknowledge UI redesign**: keep the commit/ack concept (clarified), restyle the
   "not yet committed" badge + "I've got it" button so they sit cleanly on task cards,
   especially mobile.
7. **Snoozed tasks on the 7-day strip**: include them on their snoozed-until day, styled
   identically to other items (clarified — no special marker); flips the deliberate
   exclusion in `lib/dashboard.ts`.
8. **selfTest split** (backend): break the 40+-suite `selfTest()` into a few public
   chunked runners that each finish inside Apps Script's 6-minute limit (the file itself
   already documents the overrun), keeping `selfTestSeedPack()`/`selfTestSessionTokens()`.
Notification quality (round-4 item 7) is **not** in 028 — it *is* feature 010, hence the
promotion. **Shipped as PR #27** (see the Shipped section below for the summary and
`specs/028-ux-fix-batch-3/` for the couple of implementation deviations from plan, all
presentation-level and written back inline in `tasks.md` + `research.md` R7/R8 addenda).
Live validation (self-test chunks, the recurring-events backfill, and the real-iPhone
checks) is still pending — see the open follow-up below.

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
persistence so the installed app opens signed-in. **Implemented 2026-07-13**: real PNG/maskable
icons, hand-written `sw.js` (offline shell + push + notification-click deep-link), per-device
opt-in in Settings, and full RFC 8291/8292 Web Push crypto (VAPID + payload encryption) via a
vendored SJCL build (`backend/Sjcl.js`, pinned commit, RFC-vector-verified byte-for-byte in
Node before ever touching Apps Script). **Web push fully replaces feature 009's ntfy.sh pings**
per the clarify — `Ntfy.js` is deleted, `ntfyEnabled`/topics are gone from Settings, superseded
by a single `pushEnabled`. Backend pushed and deployed (refreshes the existing web-app URL, no new deployment).
`setupDatabase()`/`setupPush()`/`selfTestPush()` run from the Apps Script editor by Jaz —
confirmed passing. Real-iPhone install/enable/receive/disable checks (quickstart §D–G) remain
the standing device-gated follow-up.

**011 — Weather-aware dog-walk window finder** (brief §5 item 16; decisions captured there
2026-07-09). Open-Meteo forecast ∩ mutual-free windows from both work calendars + the
shared Household calendar, all read through one path — `CalendarApp.getCalendarById().getEvents()`.
**Re-scoped 2026-07-14 during live setup (research R4):** the original in-house ICS-fetch
fallback was removed. Jaz's calendar is Google-native (shared at detail access); Max's is
**Outlook/Exchange** (a corporate M365 account), which can't share to a Google account natively — so the
household account **subscribes to its published ICS URL via Google Calendar "From URL,"** and
Google expands recurrence/timezones/titles before we read it as a normal `maxWorkCalId`. This
dropped a large, fragile RRULE/timezone parser (Max's real feed: 300 events, 252 timed
meetings, 79 recurrences, 4 timezones) in favor of the boring/dependable path, and keeps the
ignore-list working (titles survive). Trade-off: Google's subscription refresh lag (hours–day),
tolerated by the daily re-eval + never-cancel design. **Open live-validation watch:** Max's
feed carries all-day team noise (on-call rotations, others' PTO, office closures) that
currently over-blocks — how all-day events should affect a midday walk is a decision deferred
to first real run (candidate: ignore all-day events for availability). Configurable ignore-list
for not-really-busy titles (Focus time, Hold, …). **Implemented 2026-07-13:** booking = two
separate single-guest invites (one per work email) created on the household account's own
calendar and tagged, not "auto-invite + auto-accept" onto a shared calendar — so neither
person sees the other's invite and the shared Household calendar shows no duplicate; the
app shows one walk from a single new **DogWalks** ledger tab (research R1, FR-010/011 written
back into spec.md). Firm auto-book horizon is 14 days (`dogWalkReliableDays`), sliding toward
a 21-day outer edge (`dogWalkOuterDays`) rather than booking blind to "3 weeks." Never
auto-cancels — a bad-turned window is moved, an unplaceable day is flagged `needs-decision`
and pushes both people once (guarded by `notifiedAt`). Suggest-only mode
(`dogWalkAutoBook=FALSE`) ships from day one. New `dogwalks.list` read action; dashboard
7-day-strip badges (🐾 booked/suggested, ⚠️ needs-decision) + a dismissible needs-decision
notice + a read-only calendar event source with booked/suggested walks as timed chips and
needs-decision days as all-day ⚠️ markers (month grid/agenda only — the week/day list view
doesn't yet render walks/flags, a scope deferral worth a follow-up). **Live-validated
2026-07-14 in suggest-only mode** against the real calendars: correct per-hour weather gating
(Bend July heat wave pushed walks to cool mornings, flagged too-hot days), weekend skip, and
one row per weekday all confirmed; `weatherHeatF=80` left as the dog-safety default. Setup
learnings folded into research R4/R7 (Outlook→Google subscription; "Busy" dropped from the
ignore-list default; all-day events never block; DMS-coordinate hardening).

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
| 018 | Stay signed in (session persistence; revised → session tokens) | [specs/018-stay-signed-in](specs/018-stay-signed-in/spec.md) | [#17](https://github.com/maxwellbw/household-hq/pull/17), rev [#26](https://github.com/maxwellbw/household-hq/pull/26) |
| 022 | UX fix batch 2 (snooze on calendar, delete, collapsible Open) | [specs/022-ux-fix-batch-2](specs/022-ux-fix-batch-2/spec.md) | [#18](https://github.com/maxwellbw/household-hq/pull/18) |
| 019 | Task & event details + collaboration | [specs/019-details-collaboration](specs/019-details-collaboration/spec.md) | [#19](https://github.com/maxwellbw/household-hq/pull/19) |
| 020 | Settings editor under More | [specs/020-settings-editor](specs/020-settings-editor/spec.md) | [#20](https://github.com/maxwellbw/household-hq/pull/20) |
| 023 | Dog-care recurring seed rows (`sixweekly`/`eightweekly` cadences added) | [specs/023-dog-care-seed-rows](specs/023-dog-care-seed-rows/spec.md) | [#22](https://github.com/maxwellbw/household-hq/pull/22) |
| 028 | UX fix batch 3 (yearly lookahead, optimistic saves, mobile feel, day peek, ack redesign, selfTest split) | [specs/028-ux-fix-batch-3](specs/028-ux-fix-batch-3/spec.md) | [#27](https://github.com/maxwellbw/household-hq/pull/27) |
| 010 | PWA install + web push (vendored SJCL for RFC 8291/8292 crypto; ntfy.sh fully retired) | [specs/010-pwa-and-push](specs/010-pwa-and-push/spec.md) | [#28](https://github.com/maxwellbw/household-hq/pull/28) |
| 011 | Weather-aware dog-walk window finder (Open-Meteo gates; Outlook→Google subscription; DogWalks ledger) | [specs/011-dog-walk-finder](specs/011-dog-walk-finder/spec.md) | [#29](https://github.com/maxwellbw/household-hq/pull/29) |

**Planning history:** Phase 1 (001–007) + Phase 2 (008–009) per brief §10 · Phase 2.5
(012–015) planned 2026-07-09, Jaz's feedback round 1 — the backend had outrun the UI ·
Phase 2.6 (016–021) planned 2026-07-10, feedback round 2 — confirmed bugs + fix & flow ·
Phase 2.7 (022–026) planned 2026-07-11, feedback round 3 — gap review found snooze
unreachable from the calendar, delete APIs with no UI, tasks-only recurrence, and promoted
grocery lists + inbound gcal import from the parked list · Phase 2.8 (028) planned
2026-07-13, feedback round 4 — first real-device findings after the 027 seed: mobile polish
(zoom, safe area, ack UI), optimistic saves, per-cadence event lookahead, selfTest split;
010 promoted ahead of 026 for iPhone push.

### Post-merge notes & open follow-ups

**Open follow-ups first:** **010's real-iPhone checks are still pending** — `setupDatabase()`,
`setupPush()`, and `selfTestPush()` (RFC 8291 vector + VAPID roundtrip) were run manually from
the Apps Script editor and confirmed passing; the backend is pushed and the web-app deployment
refreshed (@24). What's left needs a physical iPhone: home-screen install (icon/splash
correctness), enabling notifications on the installed PWA, receiving a closed-app push, and
disabling — see `specs/010-pwa-and-push/quickstart.md` §D–G. **028's live validation is still
pending** — `clasp run` isn't
configured as an API executable in this sandbox, so `setupDatabase()`, the four
`selfTest1Core()` … `selfTest4CalendarAndComms()` chunks, and the one-time
`generateRecurringEvents()` backfill (the moment the seeded birthdays/anniversaries
actually appear on the calendar) all need to be run manually from the Apps Script editor;
the real-iPhone checks (zoom lock, safe-area, day-peek touch, ack redesign at phone width)
also need a real device. Backend code is pushed and the web-app deployment refreshed
(@23) either way — see `specs/028-ux-fix-batch-3/quickstart.md` §A–H. **023's
`selfTestSeedPack()` live run is still pending** — the
sandbox can't execute Apps Script, so `selfTestSeedPack()` (updated for the 12-chore pack
and the two new `sixweekly`/`eightweekly` cadences) needs to be run manually from the Apps
Script editor to confirm `SEED PACK: ALL PASS`, and `seedRecurringPack()` needs a real run to
seed the four dog-care chores into production (see `specs/023-dog-care-seed-rows/quickstart.md`
§A–G). Backend code is pushed and the web-app deployment refreshed (@18) either way.
**020's `selfTest()` and live click-through are still pending** —
`clasp run` needs an API-executable deployment this project doesn't use (web app only), so
`selfTest()` (which now includes `liveSettingsUpdate_()`) must be run manually from the Apps
Script editor; the sandboxed preview also can't complete real Google OAuth, so the new
More → Settings screen has only been verified via component tests + code-level review, not a
live click-through. Backend code is pushed and the web-app deployment refreshed (@16)
either way. **019's Sheet migration is still pending** — `setupDatabase()` (adds
`Tasks.notes/ackBy/ackAt` + `Events.location`) and `selfTest()` need to be run from the Apps
Script editor; until then the app fails closed with `SCHEMA_MISMATCH` on any request
touching those fields. 009's live validation is still deferred (run `setupDatabase()` +
`selfTest()`, pick topics, subscribe phones, quickstart A–F). 016, 017, 018, 019, 020, and
**022** all shipped without a live browser pass (the sandboxed preview can't do real Google
OAuth) — **a manual desktop + mobile quickstart pass is still recommended for all six; 018
especially, since its core value (silent restore/refresh) is exactly what the sandbox can't
exercise** — see `specs/018-stay-signed-in/quickstart.md`. 006's T057 live sign-in
walkthrough was never formally run. 013's US3 (desktop drag-onto-day) is deferred until
Schedule-X exposes stable `data-date` on month-grid cells.

_011 (PR #29). Daily Apps Script finder books one dog walk per weekday in a mutual-free,
good-weather window (Open-Meteo per-hour heat/cold/precip/snow-ice gates; longest of 60/45/30
closest to midday) as two single-guest invites on the household account's own calendar, one
row per (date, slot) in a new **DogWalks** ledger tab; never auto-cancels (moves a bad-turned
window, flags `needs-decision` + pushes both once otherwise); suggest-only mode + second
early-day walk. Frontend: `dogwalks.list`, `useDogWalks`, dashboard needs-decision notice,
7-day-strip 🐾/⚠️ badges, read-only month-calendar markers. Setup re-scoped the calendar read
(research R4): both work calendars now read via one `getCalendarById()` path — Outlook/Exchange
subscribed into Google Calendar "From URL" (dropping an in-house ICS/RRULE parser); all-day
events never block; "Busy" dropped from the ignore-list default; coordinates DMS-hardened. 401
frontend tests green; backend `selfTestDogWalk()` → `DOG WALK: ALL PASS`. Backend deployed
(@25). **Live-validated in suggest-only mode 2026-07-14** against the real calendars (per-hour
gating, weekend skip, one row/day all confirmed). **Open follow-up: the real auto-book run is
still pending** — flip `dogWalkAutoBook=TRUE` and re-run `runDogWalkFinder()` to send real
invites, then confirm move/needs-decision pushes and the app surfaces on real devices._

_028 (PR #27). Seven pre-clarified fixes from Jaz's feedback round 4 (first real-device
pass after the 027 seed). `generateRecurringEvents()`'s window is now per-cadence: annual
rules (birthdays/anniversaries) get 366 days instead of 60, so seeded yearly occurrences
actually materialize; new Settings key `recurringEventsYearlyLookaheadDays`. Task/event
create+edit go optimistic (client-minted id, instant cache insert/patch, revert+toast on
failure) via `useMutations.ts`'s existing onMutate/onError/onSettled pattern — sheets close
immediately instead of awaiting the network; recurring-rule creates stay awaited. Viewport
meta + `touch-action` + 16px coarse-pointer inputs kill iOS zoom; bottom nav/FAB/main
padding respect `env(safe-area-inset-bottom)`. New `DayPeekPanel` opens inline below the
dashboard's 7-day strip on tap (shared `itemsForDay()` selector keeps panel contents and
strip counts from disagreeing); snoozed tasks now show there too. Acknowledge UI collapsed
into a single owner-colored chip (was a stacked badge + button); a critique pass caught and
fixed a real contrast bug (snoozed-row dimming was washing out the chip) plus a copy/
redundancy issue. Backend `selfTest()` split into four chunked runners
(`selfTest1Core()`…`selfTest4CalendarAndComms()`) under the 6-minute Apps Script limit, with
a verified coverage audit (all 42 suites, none dropped/duplicated) and a fail-loud guard on
the old entry point. 379 tests green (up from 346 — the spec's stated 322 was stale); build
clean. Backend pushed and the web-app deployment refreshed (@23); live validation still
pending (see follow-up above)._

_023 (PR #22). Extends 015's seed pack with four dog-care chores (flea/tick meds,
heartworm meds, nail trim, grooming), all owned by `both`, year-round — reuses
`seedRecurringPack()`'s seed-key + `recurringSeedApplied` ledger unchanged, so idempotency,
edit-preservation, and never-resurrect all come free. Nail trim (~6 wk) and grooming
(~8 wk) needed two new fixed cadences — `sixweekly` (+42d) and `eightweekly` (+56d) — added
to `CADENCE_STEP_`/`CADENCES` **and** the frontend `Cadence` type + labels + dropdowns
(`RecurringManager.tsx`, `QuickAddSheet.tsx`), widening the feature from the backlog's
original "backend-only" framing by this bounded amount. No new API action or screen. 322
tests green (2 new); `npm run build` clean. Backend pushed and the web-app deployment
refreshed (@18); `selfTestSeedPack()` live run still pending (see follow-up above)._

_020 (PR #20). New `settings.update` backend action — the only write path onto a curated
subset of the keyless Settings tab (`EDITABLE_SETTINGS` whitelist enforced server-side; every
other key, including emails/ntfy topics, is unreachable through this action even if a client
sends it). All fields validated before any write (no partial writes); a save writes only the
keys that actually changed and appends exactly one `settings-update` ActivityLog row (no log
noise on a no-op resave). Changing `digestHour` reinstalls the daily `sendDigests` trigger in
the same call, so the new schedule takes effect with no manual step. New **Settings** screen
under More (digest schedule, ntfy toggle, reminder minutes, curated 6-zone timezone dropdown)
— single Save button, only submits changed fields. 272 tests green (3 new); backend
`liveSettingsUpdate_()` added to `selfTest()` but not yet run live (see follow-up above)._

_019 (PR #19). Four slices, no new OAuth scope, one new backend action. **Notes**: new
`Tasks.notes` column (Events' `notes` already existed) editable in create/edit everywhere;
new pure `linkify()` + shared `NotesText` renders `http(s)://` URLs as tappable links via
React children only (never `dangerouslySetInnerHTML`). **Acknowledge/commit**: new
`tasks.acknowledge` action (`ackBy`/`ackAt` columns, idempotent, resets on reassignment) —
"not yet committed" reads on task cards/dashboard/detail sheet (not calendar chips, Jaz's
call); assigner gets an instant ntfy ping (009 reused) + a dismissible dashboard notice that
persists until dismissed (per-device `localStorage`, mirrors 018's `session-store` pattern).
**Event notes + location**: create/edit UI added for both; `location` maps onto the mirrored
Google Calendar event via `setLocation()` in the existing 007 sync, including clearing it.
269 tests green (40 new); `/impeccable audit` (code-level — sandbox blocks live OAuth) found
and fixed one real WCAG AA gap (a new link/button color at 4.05:1, below the 4.5:1 floor).
**Sheet migration (`setupDatabase()`) not yet run** — see the follow-up note above; merged
with that and the live pass still pending._

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
2026-07-11) — see the follow-up note above.
**Revised in PR #26 (2026-07-12)** after the silent-GIS approach failed on real devices
(iOS Safari ITP / Chrome FedCM declines — 4s stall, then the wall + popup anyway): the
backend now mints an HMAC-signed 30-day sliding **household session token** on every
`auth.whoami`; the client persists it (`hq.sessionToken`) and boots with one whoami
round-trip. Google is only the first-ever sign-in / post-sign-out. Allowlist still checked
live per request; rotating the `SESSION_SECRET` script property revokes all sessions.
Silent-prompt machinery deleted. API 1.4.0, deployment @22._

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
