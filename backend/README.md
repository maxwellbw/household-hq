# Household HQ Backend (feature 001)

The Google Apps Script web app that is the household's data layer: the six-tab Google
Sheet schema and the JSON API every later feature calls. Dependency-free by constitution
(Principle IV). Spec: [`specs/001-sheets-schema-and-api/`](../specs/001-sheets-schema-and-api/).

## Files (flat — Apps Script has no folders)

| File | Responsibility |
|---|---|
| `Config.js` | `SPREADSHEET_ID`, `API_VERSION`, tab/header constants, enums, Settings seed |
| `Api.js` | `doGet` ping, `doPost` (parse → route → envelope), error mapping, all action handlers |
| `Sheets.js` | tab access, header-name mapping, row⇄record, locking, blank-ID adoption, mutations |
| `Validation.js` | enum/date checks, payload validation, season-window rule |
| `ActivityLog.js` | append-only log writer (one row per successful mutation) |
| `Setup.js` | `setupDatabase()` — idempotent provisioning (operator-run, not an API action) |
| `Recurring.js` | occurrence math, nightly generator, trigger installer, rule CRUD (feature 004) |
| `RecurringEvents.js` | occurrence id/timing math, nightly generator (Events + inline prep), trigger installer, rule CRUD (feature 025) |
| `Seed.js` | `seedRecurringPack()` — one-time starter pack of home-maintenance chores (feature 015) |
| `PrepTasks.js` | prep-id/date math, `syncPrepForEvent_` sync brain, nightly generator, trigger installer (feature 005) |
| `CalendarSync.js` | calendar builders, `syncCalendarForEvent_`/`syncCalendarForTask_` mirror brain, `syncCalendar()` nightly reconcile + orphan sweep, trigger installer (feature 007) |
| `SelfTest.js` | `selfTest()` — manually-run end-to-end checks |

## Transport & envelope (fixed project-wide here)

All operations are a `text/plain;charset=utf-8` POST to the web-app URL with a JSON body
`{ token, action, payload }`; `doGet` is a health ping only. HTTP status is always 200 —
the `ok` field is the only success discriminator. Full contract:
[`contracts/api.md`](../specs/001-sheets-schema-and-api/contracts/api.md).

## Task lifecycle & activity feed (feature 003)

Feature 003 tightens 001's raw task CRUD and opens the log for reading. Delta contract:
[`api-003.md`](../specs/003-tasks-crud-and-activity-log/contracts/api-003.md).

- **Completion is its own action.** `tasks.complete` / `tasks.reopen` are the *only* way to
  change a task's status. `tasks.update` handles `title`/`owner`/`dueDate` only (due date may
  be cleared) and now **rejects** `status`/`completedBy`/`completedAt` with `BAD_REQUEST`.
  This **supersedes** 001's "set `status` via `tasks.update`" line so completions never appear
  as generic `update`s in the feed.
- **Idempotent completion.** Completing an already-`done` task is a no-change: original
  completer/time preserved, no new log row (`{ task, changed:false }`). The read-then-write is
  inside the write lock, so the simultaneous-completion race yields exactly one completion.
- **Slices.** `tasks.list` takes an optional `filter` ∈ `mine|theirs|ours|all|default`
  (default `all`), resolved server-side from the verified caller — never a client parameter.
  `both` tasks live in `ours`/`default` only.
- **Feed.** `activity.list { limit?, since? }` returns the ActivityLog newest-first (default
  200, max 500 entries), each with the raw columns plus a composed `summary`. Read-only — the
  log stays append-only.

## Recurring chore engine (feature 004)

Chores that materialize themselves. No schema change — the `Recurring` tab's
`lastGenerated`/`seasonStart`/`seasonEnd` columns were provisioned in 001 for exactly this.
Delta contract: [`api-004.md`](../specs/004-recurring-engine/contracts/api-004.md); design
rationale: [`research.md`](../specs/004-recurring-engine/research.md) (decisions D1–D8).

- **Rule management.** `recurring.create` / `recurring.update` / `recurring.delete` join the
  existing `recurring.list`. A rule is `title, cadence (weekly|biweekly|monthly|quarterly|
  annually), anchorDate, defaultOwner, seasonStart?, seasonEnd? (1–12, wrap-around legal)`.
  **`lastGenerated` is generator-managed** — supplying it on create/update is `BAD_REQUEST`;
  clear it by hand in the Sheet if you want to force a rule to re-backfill.
- **The nightly generator**, `generateRecurringTasks()`, reads every rule and materializes
  each occurrence due within a lookahead window (Settings `recurringLookaheadDays`, default
  30) as an ordinary Task linked back via `recurringId`. It is a **trigger**, not an API
  action — install it once from the editor with `installRecurringTrigger()` (idempotent:
  re-running never stacks a second trigger).
- **Idempotent by construction.** Each generated Task's id is deterministic
  (`'r' + hex(MD5(recurringId + '|' + dueDate))`), so re-runs and overlapping executions
  replay to the same row via the existing create-idempotency (001) instead of duplicating.
- **Tombstone, not resurrection.** The rule's `lastGenerated` is a high-water mark; the
  generator never looks behind it, so deleting a generated occurrence Task is permanent — the
  next run does not re-create it.
- **Season windows** are whole-month ranges (`seasonStart`–`seasonEnd`, 1–12); an occurrence
  outside the window is skipped (not generated) but still advances the watermark. Blank season
  fields mean year-round.
- **Completing/editing/deleting a generated Task never touches its rule** — the rule keeps
  producing future occurrences on schedule regardless of what happens to past ones.
- **Logging.** Each generated Task logs a `create` by actor `system`; the watermark advance
  logs one `update` by `system`, and only when it actually changes.

## Events and prep templates (feature 005)

Tagging an event with a prep checklist turns "guests visiting" into dated, owned prep
tasks automatically. **One schema change**: the `Events` tab gains `prepGeneratedFor`
(landed via `setupDatabase()`'s general header migration — see below). Delta contract:
[`api-005.md`](../specs/005-events-and-prep-templates/contracts/api-005.md); design
rationale: [`research.md`](../specs/005-events-and-prep-templates/research.md) (decisions
D1–D11).

- **Checklist management.** `templates.create` / `templates.update` / `templates.delete`
  join the existing `templates.list`. A step is `eventType, taskTitle, offsetDays (signed
  int, e.g. -2 = two days before), defaultOwner`. A "checklist" is simply the set of steps
  sharing an `eventType`. Editing/deleting a step never rewrites prep already generated for
  existing events.
- **Tagging an event.** An event selects a checklist via `templateId`, matched against
  steps' `eventType`. `type` remains a free descriptive/display label and never drives prep.
  `prepGeneratedFor` is **generator-managed** — supplying it on `events.create`/
  `events.update` is `BAD_REQUEST`; clear it by hand in the Sheet to force reconciliation.
- **Generation runs on save *and* nightly.** `createEvent_`/`updateEvent_` call
  `syncPrepForEvent_` synchronously (prep appears immediately), and the nightly trigger
  `generatePrepTasks()` reconciles every event the same way — catching hand-edited/retagged
  Sheet rows and any run that never completed. Install the trigger once with
  `installPrepTrigger()` (idempotent; reuses feature 004's `script.scriptapp` scope).
- **Idempotent by construction.** Each prep Task's id is deterministic
  (`'p' + hex(MD5(eventId + '|' + templateStepId))`) — date-independent, so moving the
  event updates the same row instead of duplicating it.
- **The `prepGeneratedFor` marker is the tombstone.** Creation happens only on a
  *transition* (`templateId !== prepGeneratedFor` — a tag, retag, or hand-edited row);
  in steady state the generator only re-dates survivors and never creates, so a
  hand-deleted prep task is never resurrected.
- **Moving an event** re-dates its outstanding prep to the new start; completed prep is
  left alone. **Retagging** swaps the prep set (old outstanding prep removed, new prep
  generated) while completed prep from the old checklist remains. **Deleting an event**
  purges *all* of its prep — completed and outstanding alike; a user's manually
  event-linked (non-prep-id) tasks are untouched.
- **Logging.** Generated/re-dated/purged prep Tasks and the `prepGeneratedFor` write log
  under actor `system`; event and checklist CRUD log under the acting user.

## Recurring seed pack & alternating weeks (feature 015)

A one-time starter pack of common home-maintenance chores, plus the pattern for modeling
alternating-week curbside pickup with the existing engine — **no new recurrence concepts**.
Spec: [`specs/015-recurring-seed-pack/`](../specs/015-recurring-seed-pack/). **One schema
change**: the `Recurring` tab gains `seedKey` (landed via `setupDatabase()`'s header
migration, same mechanism as `prepGeneratedFor`/`gcalEventId`); one new Settings key,
`recurringSeedApplied`.

- **Alternating-week bins, with zero engine change.** The engine's `biweekly` cadence is
  already a fixed 14-day step from `anchorDate`. To alternate two biweekly pickups (e.g.
  recycling one week, yard waste the next): create both as `biweekly` rules and set their
  `anchorDate`s **exactly 7 days apart**; add a `weekly` rule for anything collected every
  week (e.g. trash). The two biweekly rules then never land in the same week and each recurs
  every other week — no special "alternating" flag or cadence exists or is needed. Editing
  the anchor dates (keeping them 7 days apart) shifts the whole schedule while preserving the
  pattern. The starter pack's `trash`/`recycling`/`yardwaste` rows are a worked example.
- **`seedRecurringPack()`** appends the starter pack (HVAC air filter quarterly, dishwasher
  filter monthly, gutters annually, detector batteries annually, mow lawn weekly
  April–October, plus the three bin rules — see `SEED_PACK` in `Config.js`) as ordinary
  `Recurring` rows. Editor-run only, like `setupDatabase()` — **not** an API action, **not** a
  trigger. Safe to re-run: identity is a per-chore `seedKey`, not title, so renaming a seeded
  rule never causes a re-add.
- **Never-resurrect.** The `recurringSeedApplied` Settings value is a `; `-delimited ledger of
  every seed key ever applied. A chore is skipped once its key is in the ledger **or** is the
  `seedKey` of a live row — so deleting a seeded chore by hand is permanent across re-runs,
  the same guarantee feature 004 gives a deleted occurrence. To deliberately re-seed a removed
  chore: delete its row **and** remove its key from `recurringSeedApplied`.
- **Seeded rows are ordinary rules.** They carry no locked fields; the household edits or
  deletes them exactly like any hand-entered `Recurring` row, and the generator treats them
  identically. Seeded anchors are placeholders (computed relative to the seed run date) —
  correct them to the household's real collection/maintenance days after seeding.
- **Logging.** Each newly-seeded rule logs its own `create` row (actor `system`) via the same
  `createRecord_` path the recurring generator uses per occurrence; a re-run with nothing new
  to add makes no Sheet or log writes at all.

## Recurring events (feature 025)

Extends the recurrence concept from feature 004 (which only ever materializes Tasks) to
Events — birthdays, anniversaries, annual checkups no longer need re-entering by hand.
**Two schema changes**: a new `RecurringEvents` tab (own rule type, distinct from `Recurring`
— see design note below) and the `Events` tab gains `recurringEventId` (landed via
`setupDatabase()`'s header migration, same mechanism as `prepGeneratedFor`/`gcalEventId`).
One new Settings key, `recurringEventsLookaheadDays` (default 60). Delta contract:
[`recurring-events.md`](../specs/025-recurring-events/contracts/recurring-events.md); design
rationale: [`research.md`](../specs/025-recurring-events/research.md) (decisions D1–D8).

- **Rule management.** `recurringEvents.create` / `.update` / `.delete` join
  `recurringEvents.list`. A rule is `title, cadence (same seven cadences as `Recurring`),
  anchorDate, startTime? (HH:mm — blank ⇒ all-day occurrences), durationMinutes? (only
  meaningful with startTime), defaultOwner, templateId? (attaches a feature-005 prep
  checklist by its `eventType`), location?, notes?, seasonStart?, seasonEnd?`. Like
  `Recurring`, **`lastGenerated` is generator-managed** — `BAD_REQUEST` on create/update.
- **Why a separate tab, not a `kind` flag on `Recurring`?** Event rules need columns chores
  don't (`startTime`, `durationMinutes`, `templateId`, `location`) — folding them together
  would leave every row half-blank. Both engines share the same pure date math
  (`occurrencesInWindow_`, `inSeason_`, `addMonthsClamped_`, `addDays_` — all in
  `Recurring.js`) rather than duplicating it.
- **The nightly generator**, `generateRecurringEvents()`, reads every rule and materializes
  each occurrence due within `recurringEventsLookaheadDays` (default 60 — longer than 004's
  30, so long-lead prep on annual events has room to materialize before its offset date) as
  an ordinary Event linked back via `recurringEventId`. All-day when the rule has no
  `startTime` (date-only `start`/`end` — the frontend already renders that as all-day);
  timed otherwise, ending `durationMinutes` (default 60) after `startTime`. It is a
  **trigger**, not an API action — install it once with `installRecurringEventsTrigger()`
  (idempotent). Runs at hour 2, ahead of 004 (3), 005 (4), 007 (5), and 008 (6), so
  occurrences exist before every downstream nightly job.
- **Prep is inline, reusing 005 unchanged.** Immediately after creating each occurrence,
  the generator calls `syncPrepForEvent_` — the same function `createEvent_` calls — so a
  rule with a `templateId` gets its occurrence's prep tasks the same run, dated by each
  step's offset relative to the occurrence. A rule with no template, or one naming a
  deleted template, simply yields a plain occurrence — `syncPrepForEvent_` already tolerates
  that with no error.
- **Idempotent by construction**, exactly like 004: each occurrence's id is deterministic
  (`'v' + hex(MD5(recurringEventId + '|' + date))`), and the rule's `lastGenerated`
  high-water mark means a hand-deleted occurrence is never resurrected.
- **Deleting an occurrence already cascades its prep — no new code.** `deleteEvent_`
  (feature 005) already purges *all* prep tasks for any event it deletes, completed and
  outstanding alike; occurrence Events are ordinary Events, so this was already covered
  (confirmed by `SelfTest.js`, not re-implemented — see research D7 for how this was
  discovered mid-implementation).
- **All-day events now round-trip through the API.** `Events.start`/`end` validation
  changed from `datetime`-only to `datetimeOrDate` (accepts a date-only value too), so a
  hand/API edit to an all-day occurrence's date no longer fails validation.
- **Logging.** Each generated occurrence (and its prep) logs under actor `system`, same as
  004/005; rule CRUD logs under the acting user.

## Google Calendar sync (feature 007)

One-way outbound mirror of Events + dated Tasks to the shared "Household" Google Calendar,
so both phones get free native notifications. **Strictly outbound** — the app is
authoritative and never reads calendar edits back into the Sheet. Reading work calendars,
weather, and the dog-walk finder are **feature 011**, not this feature. Design rationale:
[`research.md`](../specs/007-gcal-sync/research.md) (decisions D1–D9); delta contract:
[`api-007.md`](../specs/007-gcal-sync/contracts/api-007.md).

- **One schema change**: the `Tasks` tab gains `gcalEventId` (landed via `setupDatabase()`'s
  header migration, same as feature 005's `prepGeneratedFor`). `Events.gcalEventId` already
  existed. Two new Settings: `gcalEventReminderMin` (default 30) and `gcalTaskReminderTime`
  (default `09:00`).
- **The pointer is the idempotency key.** A blank `gcalEventId` cell means "create it";
  a set cell that resolves means "update it in place"; a set cell that no longer resolves
  (stale) means "recreate it." **Hand-clearing the cell is a legible repair lever** — it
  forces a fresh mirror on the next sync.
- **Mirrors on save *and* nightly**, exactly like feature 005's prep generator:
  `syncCalendarForEvent_`/`syncCalendarForTask_` run synchronously after each Events/Tasks
  write (best-effort — a Calendar failure is logged and swallowed, never fails the user's
  write), and the nightly trigger `syncCalendar()` reconciles everything the same way, plus
  runs an **orphan sweep** that deletes any app-tagged calendar entry whose backing Sheet row
  was hand-deleted (the write path never saw it). Install the trigger once with
  `installCalendarTrigger()` (idempotent).
- **What's mirrored**: every Event ending today-or-later; every Task with a non-empty
  `dueDate` today-or-later that is `open` or `snoozed`. No far-horizon cap — a two-person
  household's volume is trivial. Owner shows as both a `[Max]`/`[Jaz]`/`[Both]` title prefix
  and a per-owner calendar color (never color-only — accessibility). Reminders are applied on
  every mirror so drift self-corrects.
- **Untouched by design**: calendar entries the app didn't create (no `hhqId` tag, e.g. a
  hand-added birthday) are never read, edited, or deleted.
- **New OAuth scope**: `https://www.googleapis.com/auth/calendar` (broad — read+write on
  accessible calendars), added deliberately wide so **feature 011**'s work-calendar reading
  and invite-sending need no second re-authorization. Only the deploying shared account
  re-authorizes.
- **Logging.** Every calendar create/update/delete (including orphan-sweep deletes) appends
  one `gcal-sync` ActivityLog row under actor `system`; no-op syncs write nothing.

## Deployed endpoint

Web-app URL (deployment `@1`, stable across redeploys — refresh with
`clasp deploy -i <deploymentId>`):

```
https://script.google.com/macros/s/AKfycbzQAE3gbDHzJnbKN-VoHt5VAU-Wx_TCROWtmQjS4iurjRR8-aaRlUykpDfPhnH3jTstQw/exec
```

`curl` note: POST **without** `-X POST` (e.g. `curl -sL -H 'Content-Type: text/plain;charset=utf-8'
--data '…' "$URL"`). Apps Script 302-redirects the POST to a one-time `googleusercontent.com`
result URL that is fetched with GET; `-X POST` wrongly pins the method across the redirect
and yields "Page Not Found".

## First-time setup

1. **Paste the Sheet ID.** In `Config.js`, set `SPREADSHEET_ID` to the "Household HQ DB"
   Sheet's ID (from its URL). It ships as `PASTE_SHEET_ID_HERE`.
2. **Deploy:** from `backend/`, `clasp push && clasp deploy`. Note the web-app URL.
3. **Provision:** open the editor (`clasp open-script`) and run `setupDatabase()` — it
   creates the six tabs, headers, plain-text formatting, and seeds Settings. Safe to
   re-run. Fill in `maxEmail` / `jazEmail` / `sharedEmails` and `OAUTH_CLIENT_ID`
   (`Config.js`) by hand — see feature 002 quickstart.
4. **Validate:** follow [`quickstart.md`](../specs/001-sheets-schema-and-api/quickstart.md),
   or run the five self-test chunks (`selfTest1Core()` … `selfTest4CalendarAndComms()`,
   `selfTestDogWalk()`) — each logs `ALL PASS`. (`selfTest()` itself is a fail-loud guard,
   not a runner.)
5. **Install the nightly triggers:** in the editor, run `installRecurringEventsTrigger()`
   (feature 025), `installRecurringTrigger()` (feature 004), `installPrepTrigger()` (feature
   005), and `installCalendarTrigger()` (feature 007) once each. Re-running any of them is
   safe (it replaces rather than stacks the trigger).
5a. **Optional starter chores (feature 015):** run `seedRecurringPack()` once to populate the
    `Recurring` tab with the starter pack (bins, HVAC filter, gutters, etc.) — correct the
    seeded anchor dates to the household's real schedule afterward. Safe to re-run.
6. **Feature 007 only:** re-authorize once (the manifest now requests the `calendar` scope) —
   run **`checkCalendarAuth()`** from the editor to trigger the consent prompt for the
   deploying shared account (plain `selfTest()` won't trigger it on its own: with
   `householdCalendarId` blank, every calendar code path no-ops before touching the Calendar
   service at all — FR-014). Then set Settings `householdCalendarId` to the shared Household
   calendar's ID.

Note: after any header change to `Config.HEADERS` (e.g. feature 005's `prepGeneratedFor`,
feature 007's `gcalEventId` on Tasks, feature 015's `seedKey` on Recurring, feature 025's
`recurringEventId` on Events plus the new `RecurringEvents` tab), re-run `setupDatabase()`
— it appends any missing header/tab without touching existing columns or data (safe to
re-run).

## CLI: `clasp run` + dev session tokens (Phase 0 tooling, 2026-07-16)

Backend functions (self-tests, setup, generators) run from the CLI — no more manual
editor runs. One-time setup already done:

- A standard GCP project (`household-hq-501817`) is associated with the script
  (Apps Script editor → Project Settings → GCP project number), the **Apps Script API**
  is enabled both in that project and at script.google.com/home/usersettings, and the
  manifest has `"executionApi": { "access": "MYSELF" }`.
- clasp is logged in with a **Desktop-app OAuth client from that same project**
  (required — the default clasp client can't call the Execution API on this script).
  Client secret lives at `~/.config/household-hq/client_secret.json` (never in the repo;
  `client_secret*.json` is gitignored). To re-login (e.g. after rotating the client):
  `clasp login --creds ~/.config/household-hq/client_secret.json --use-project-scopes
  --include-clasp-scopes` as the shared household account.

Usage (from `backend/`; runs against the **head** deployment, i.e. the last `clasp push`):

```bash
clasp run selfTest1Core          # …2Recurring, 3SeedAndLists, 4CalendarA, 4CalendarB,
                                 # 5Comms, then selfTestDogWalk (chunk 7/7)
clasp run setupDatabase
clasp run cleanupSelfTestResidue # sweep selftest- rows/ledger keys after a failed suite
clasp run mintDevSessionToken    # prints a 7-day hqs1. session token (see below)
```

Caveat: an execution that exceeds the 6-minute Apps Script cap makes `clasp run` **hang
indefinitely** rather than error — kill it and check the execution's fate in the Apps
Script dashboard. The old chunk 4 (`selfTest4CalendarAndComms`) ran ~5m30s right at the cap
and was split (feature 030) into `selfTest4CalendarA`/`selfTest4CalendarB` (the four live-
Calendar suites, the real bottleneck) + `selfTest5Comms`; if any chunk starts hanging again,
split it further the same way.

**Dev session tokens (browser access without Google OAuth):** `mintDevSessionToken()`
(`DevTools.js`) mints a short-lived household session token for Max's allowlisted email.
Paste it into the deployed app's `localStorage['hq.sessionToken']` and reload — the normal
`auth.whoami` restore path signs in. Rotating the `SESSION_SECRET` script property revokes
every outstanding token (dev and real).

## Deployment mode (interim; ratified by feature 002)

`appsscript.json` is set to **executeAs `USER_DEPLOYING`, access `ANYONE_ANONYMOUS`** so
feature 001's curl/quickstart validation works before any auth exists. This is an interim
posture: the repo is private and no secrets live in the Sheet yet. **Feature 002** adds
Google ID-token verification against the Settings allowlist (the `token` envelope slot is
already reserved) and formally decides the final execute-as/access mode, updating CLAUDE.md
— see research decision **R1** in
[`research.md`](../specs/001-sheets-schema-and-api/research.md).

## Conventions

- Read a whole tab once, operate in memory, write back in one batch. Never loop cell reads.
- Columns are mapped by header **name**, never position; a missing/renamed required header
  fails loudly with `SCHEMA_MISMATCH`.
- IDs are UUIDs (`Utilities.getUuid()` or client-supplied); row position is never an id.
- Every successful state change appends exactly one `ActivityLog` row; failures append none.
- Dates are ISO 8601 local strings in the household timezone from Settings.
