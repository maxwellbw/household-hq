# Implementation Plan: Email Digests (email-digests)

**Branch**: `008-email-digests` | **Date**: 2026-07-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-email-digests/spec.md`

## Summary

Two personalized, per-recipient emails — a **weekly "week ahead"** and a **monthly "next
month"** — composed from the live Sheet (Events + dated Tasks) and sent via **MailApp** on a
time-driven schedule. Each of Max and Jaz gets their own email containing only the items
owned by them or by `both` (strict owner-filtering, per clarify); the emails are **HTML with
the app's owner color coding** plus a plain-text fallback; the send schedule is **hand-edited
in Settings** (weekly weekday, monthly day-of-month, hour, and independent on/off flags).

The design reuses the project's established **daily-gate trigger + read-Settings-each-run**
pattern (features 004/005/007 all install a nightly time-driven job at a fixed hour). One new
public entry point `sendDigests()` fires **once a day**; each run reads Settings and decides
whether *today* is a weekly send day and/or a monthly send day, then builds and sends the due
digests. Keeping the cadence check in code (not baked into the trigger) is what makes the
weekday and day-of-month **live-editable from the Sheet without reinstalling the trigger** —
and lets "last day of month" work correctly for short months, which a fixed `onMonthDay`
trigger cannot.

### Idempotency model — the one thing that must not double-send (FR-011, Principle V)

There is no mutable "already sent" flag. Idempotency comes from a **deterministic period key
recorded in ActivityLog** — the same append-only log every send already writes to (FR-012),
so the log *is* the ledger and there is no shadow state that can drift (Principle II):

- Weekly period key = the send date, `weekly/<yyyy-MM-dd>/<person>`.
- Monthly period key = the covered month, `monthly/<yyyy-MM>/<person>`.

Before emailing a person, scan ActivityLog for an existing `digest-weekly` / `digest-monthly`
row whose `targetId` equals that key. If present → **skip** (already sent). If absent → send,
then append the row. A retried run, an accidental double-fire, or a same-day re-run therefore
never sends a second copy. Because two recipients × a handful of items is trivial volume,
reading the whole ActivityLog once per run is well within Apps Script limits.

### Send flow (`sendDigests()`, daily gate)

1. Read Settings + household timezone; compute "today" in that tz.
2. **Weekly**: if `digestWeeklyEnabled` and today's weekday == resolved `digestWeeklyDay`,
   then for each person (`max`, `jaz`) with a non-blank personal email: build window
   `[today, today+6]`, gather relevant items, dedupe by period key, send, log `digest-weekly`.
3. **Monthly**: if `digestMonthlyEnabled` and today's day-of-month == resolved
   `digestMonthlyDay` (`last` → the month's final day), then for each person: window = the
   whole **next** calendar month, gather, dedupe, send, log `digest-monthly`.

Building a digest is a **pure function** of (person, window, Events rows, Tasks rows): filter
Events whose `start` (date, household tz) falls in the window and whose `owner ∈ {person,
both}`; filter Tasks with a non-blank `dueDate` in the window, `status ∈ {open, snoozed}`
(never completed/deleted, FR-014), `owner ∈ {person, both}`; sort by date; render. This purity
is what makes the whole feature unit-testable in `SelfTest.js` without sending mail.

### Email rendering (FR-007, FR-007a — clarify: HTML + colors)

- **HTML body** (`htmlBody`): items grouped by day, each line showing title, date (and time
  for events), and an owner chip using the DESIGN.md owner hues inlined as styles (Max
  `#3E6E68`, Jaz `#7E4A5E`, Both `#C6613F`) — email clients require inline CSS. Warm ivory
  card styling consistent with the app.
- **Plain-text body** (`body`): same items, owner shown as a `[Max]`/`[Jaz]`/`[Both]` label —
  the fallback for non-HTML clients (`MailApp.sendEmail` sends both).
- **Empty state** (FR-009): when a person has zero relevant items, still send, with a clear
  "Nothing on the calendar for the coming week" (or month) message — never a blank body.

### Schedule configurability (FR-008 — clarify: configurable day + time)

New discrete, hand-editable Settings keys (no opaque schedule blob — Principle II):

| Key | Default | Meaning |
|-----|---------|---------|
| `digestWeeklyEnabled` | `TRUE` | send the weekly digest at all |
| `digestWeeklyDay` | `Sunday` | weekday the weekly digest sends (name or 0–6) |
| `digestMonthlyEnabled` | `TRUE` | send the monthly digest at all |
| `digestMonthlyDay` | `last` | day-of-month the monthly sends (`last` or 1–28) |
| `digestHour` | `7` | hour (household tz) the daily gate fires |

Weekday, month-day, and the enabled flags are **read every run** → change them in the Sheet
and the next day honors them, no reinstall. `digestHour` is baked into the trigger at install
time (Apps Script triggers fire at a fixed hour), so changing the hour is the one case that
needs a one-line re-run of `installDigestTrigger()` — documented, and consistent with every
other trigger installer in this repo. Blank/invalid values fall back to the defaults above.

The reserved placeholder seed key `digestSchedule` (empty, note "feature 008") is **replaced**
by the five discrete keys; any already-seeded blank `digestSchedule` row is harmless and can
be hand-deleted (see [research.md](research.md) D5).

### Backend additions

- **`Digests.js`** (NEW) — the whole feature. Public entry points (no trailing underscore, per
  the trigger/editor gotcha): `sendDigests()` (daily gate + trigger handler),
  `installDigestTrigger()` (editor-run installer), and manual test kicks
  `sendWeeklyDigestNow()` / `sendMonthlyDigestNow()` (bypass only the day-of-week/day-of-month
  gate; still honor enabled flags, dedupe, and email presence — so quickstart can send on any
  day). Internal helpers (`_`): window builders, `relevantItemsFor_`, pure
  `buildDigest_(person, kind, window, events, tasks) → {subject, html, text, count}`,
  `renderHtml_` / `renderText_`, `alreadySent_(kind, periodKey)`, `resolveWeekday_`,
  `resolveMonthlyDay_`, and a thin `sendOne_` MailApp wrapper.
- **`Config.js`** (EDIT) — `DIGEST_TRIGGER_HOUR = 6` (offset from 004/005/007's 3/4/5 so the
  nightly jobs don't contend); digest schedule defaults; `OWNER_EMAIL_HUE` map (DESIGN hues);
  `digest-weekly` / `digest-monthly` added to `ACTION_VERBS`; `SETTINGS_SEED` updated (drop
  `digestSchedule`, add the five keys); `API_VERSION` patch bump for traceability.
- **`SelfTest.js`** (EDIT) — new cases exercising the **pure** builders: owner-filtering
  (own+both included, other's solo excluded), window boundaries (weekly ±1 day, next-month
  in/out), empty-state text, the `alreadySent_` dedupe predicate, and that the public entry
  points exist and run the gate without throwing (per the CLAUDE.md "exercise the entry point"
  rule). Rendering asserts on returned strings — no mail is sent during selfTest.
- **`Setup.js`** (NO code change) — `seedSettings_` appends the new keys on the next
  `setupDatabase()` run; re-run once after deploy (same as 007).
- **`appsscript.json`** (EDIT) — add `https://www.googleapis.com/auth/script.send_mail` for
  `MailApp.sendEmail`. Manifest change → `clasp push --force`, redeploy, and the **deploying
  (shared) account re-authorizes once**. `script.scriptapp` (trigger install) is already
  present from 004/005/007; no other new scope.

No frontend work: digests are trigger-driven, outbound-only email. No new HTTP API verbs.

## Technical Context

**Language/Version**: Google Apps Script (V8 runtime, ES2015+); backend-only feature.

**Primary Dependencies**: `MailApp` (send), `SpreadsheetApp` (read Sheet), `ScriptApp`
(time-driven trigger), `Utilities.formatDate` (tz-correct date math). No npm — Apps Script has
none; keep dependency-free.

**Storage**: the one Google Sheet — reads Events / Tasks / Settings tabs; appends to
ActivityLog (which doubles as the send ledger). No new tab, no new stored state.

**Testing**: `SelfTest.js` in-project harness (`selfTest()`), asserting on pure digest
builders; live validation per [quickstart.md](quickstart.md) using the manual-kick entry
points and real inboxes.

**Target Platform**: Apps Script web-app project (`/backend`), deployed via `clasp`, executed
as the shared household account; triggers run server-side on Google's schedule.

**Project Type**: Backend / serverless-trigger feature within the existing monorepo.

**Performance Goals**: Trivial — ≤2 recipients × ≤2 digest types per day; a handful of items
each. Each run reads a few whole tabs once (batch reads per the "read whole tab once" rule)
and sends ≤2 emails; nowhere near the 6-minute execution limit.

**Constraints**: Free-tier only — MailApp consumer quota is ~100 recipient-emails/day; this
feature uses at most ~4/day (two people × two digest types), orders of magnitude under. No
paid services. All date windows computed in the single household timezone from Settings.

**Scale/Scope**: Two users, forever. One new backend file, edits to three existing files, one
manifest scope, five new Settings keys.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Two Users Forever** — ✅ Recipients are exactly `max` and `jaz` resolved from the two
  personal Settings emails; the shared account is never a recipient. Owner filter uses the
  fixed `{max, jaz, both}` model. No roles, no registration, no generalization.
- **II. The Sheet Is the Source of Truth** — ✅ Content is read live from the Sheet at send
  time; nothing is cached. The five new Settings keys are discrete plain-text values (no opaque
  blob). Dedupe reads the append-only ActivityLog rather than introducing a mutable "sent"
  flag, so there is no shadow state that can drift. Everything stays hand-editable.
- **III. Free-Tier Only** — ✅ MailApp + Apps Script triggers are free; usage is ~4 emails/day
  against a ~100/day quota. No servers, no API keys that bill.
- **IV. Every state change is logged** — ✅ Each digest send appends one ActivityLog row
  (`digest-weekly`/`digest-monthly`), which also serves as the idempotency ledger.
- **V. Idempotent, re-runnable** — ✅ Deterministic period key + ActivityLog dedupe means a
  re-run / double-fire / retry never double-sends. `LockService` guards the read-check-append
  window against a concurrent double-fire (research D3).
- **Timezone** — ✅ All "this week" / "next month" boundaries use the household tz from
  Settings via the existing `getTimezone_()` helper.
- **Trigger/editor entry points** — ✅ `sendDigests`, `installDigestTrigger`,
  `sendWeeklyDigestNow`, `sendMonthlyDigestNow` are all public (no trailing underscore) so the
  trigger fires and they appear in the editor Run menu; only internal helpers use `_`.

**Result: PASS** — no violations; Complexity Tracking left empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-email-digests/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions D1–D7
├── data-model.md        # Phase 1 — Settings keys, digest content model, ActivityLog dedupe keys
├── quickstart.md        # Phase 1 — live validation (manual kicks + real inboxes)
├── contracts/
│   └── digest-contract.md   # trigger + email + Settings + ActivityLog contract (no HTTP API)
└── checklists/
    └── requirements.md  # spec quality checklist (from /speckit-specify)
```

### Source Code (repository root)

```text
backend/
├── Digests.js         # NEW — entry points, gate, pure builders, HTML/text render, dedupe, installer
├── Config.js          # EDIT — DIGEST_TRIGGER_HOUR, schedule defaults, OWNER_EMAIL_HUE, verbs, SETTINGS_SEED, API_VERSION
├── SelfTest.js        # EDIT — pure-builder + gate + dedupe tests (no mail sent)
├── appsscript.json    # EDIT — add script.send_mail scope
├── Setup.js           # unchanged — seedSettings_ picks up new keys on next setupDatabase()
├── Sheets.js          # unchanged — reuse readTable_, readSettingsMap_, getTimezone_
└── ActivityLog.js     # unchanged — reuse appendLog_ (as send + dedupe ledger)
```

**Structure Decision**: Single new backend file `backend/Digests.js` owns the feature, mirroring
how `CalendarSync.js` owns 007 — one file per trigger-driven capability, reusing the shared
Sheets/Config/ActivityLog helpers. No frontend, no new tab.

## Complexity Tracking

No constitution violations — section intentionally empty.
