# Research: Email Digests (008)

Phase 0 decisions. Each resolves a design unknown before Phase 1. No NEEDS CLARIFICATION
remained after `/speckit-clarify`; these are the technical choices the plan rests on.

---

## D1 — Trigger shape: daily gate vs. native weekly/monthly triggers

**Decision**: One **daily** time-driven trigger running `sendDigests()` at `digestHour`. Each
run reads Settings and decides in code whether today is a weekly and/or monthly send day.

**Rationale**:
- Apps Script `.onWeekDay(day)` / `.onMonthDay(n)` bake the schedule into the trigger at
  install time; changing the send weekday or month-day would require reinstalling the trigger,
  breaking the "hand-edit Settings and it just works" clarify decision.
- `.onMonthDay(n)` takes a fixed 1–31 and does **not** fire on the "last day" of short months
  (e.g. n=31 never fires in April). The brief wants an **end-of-month** email; a daily gate
  computing the month's actual final day handles Feb/30-day months correctly.
- A daily gate matches the existing repo pattern exactly (004 recurring, 005 prep, 007 gcal
  are all nightly `everyDays(1)` jobs), so it reads Settings live and reuses the same mental
  model and the same installer shape.

**Alternatives considered**: Two native triggers (weekly `onWeekDay`, monthly `onMonthDay`) —
rejected: not Settings-live, and `onMonthDay` can't express "last day." A per-change
reinstall-the-trigger approach — rejected: fragile, more OAuth-scope-sensitive, and puts
schedule state in the trigger instead of the Sheet.

---

## D2 — Duplicate-send prevention: ActivityLog period key vs. mutable "last sent" marker

**Decision**: Dedupe by a **deterministic period key looked up in ActivityLog**. Before
emailing a person, scan for an existing `digest-weekly`/`digest-monthly` row whose `targetId`
equals the period key (`weekly/<yyyy-MM-dd>/<person>` or `monthly/<yyyy-MM>/<person>`); skip if
found, otherwise send and append that row.

**Rationale**:
- FR-012 already requires logging every send, so the log **is** the record — no second source
  of truth. This honors Principle II ("no shadow state that can drift from the Sheet") better
  than a mutable `digestLastWeeklySent` Settings cell, which could disagree with reality if a
  send half-failed.
- Deterministic keys mirror the idempotency ethos of 004/005 (deterministic MD5 keys) — the
  same period never produces a second email, on re-run, double-fire, or retry (Principle V).
- Volume is tiny; one whole-ActivityLog read per run is negligible.

**Alternatives considered**: Mutable Settings marker cells — rejected as drift-prone shadow
state. Apps Script `CacheService`/`PropertiesService` — rejected: not hand-inspectable in the
Sheet, violates the human-readable-DB principle.

---

## D3 — Concurrency: guarding the read-check-append window

**Decision**: Wrap the per-person "check ActivityLog → send → append log" sequence in the
existing `LockService` helper pattern (`withLock_`) so a rare double-fire of the daily trigger
can't both pass the "not yet sent" check and send twice.

**Rationale**: Apps Script can, uncommonly, fire a trigger twice or overlap a manual run with
the scheduled one. The lock makes the check-and-send atomic. Matches the definition-of-done
requirement that concurrent-write paths use `LockService`. Sending is outside the Sheet but the
dedupe decision reads/writes the Sheet, so the lock covers the decision that matters.

**Alternatives considered**: No lock (rely on trigger never overlapping) — rejected: the
double-send failure is exactly what FR-011/SC-004 forbid, and the lock is cheap.

---

## D4 — Email format: HTML with owner colors + plain-text fallback

**Decision**: `MailApp.sendEmail({ to, subject, htmlBody, body })` — `htmlBody` carries owner
color coding via **inline** styles using the DESIGN.md hues (Max `#3E6E68`, Jaz `#7E4A5E`,
Both `#C6613F`); `body` is the plain-text fallback with `[Max]`/`[Jaz]`/`[Both]` labels.

**Rationale**:
- Clarify chose HTML-with-owner-colors; owner color is identity (PRODUCT/DESIGN), so the
  weekly email should reinforce the same hues as the app, not invent a new treatment.
- Email clients strip `<style>`/external CSS and cool-gray many defaults; **inline** styles on
  each element are the portable way to get reliable color. Keep the markup simple (tables/divs,
  no JS, no web fonts) for Gmail/Apple Mail/Outlook.
- Providing `body` as well means non-HTML clients still get a legible digest (FR-007a).

**Alternatives considered**: Plain text only — rejected by clarify (loses owner identity).
External CSS / web fonts — rejected: unsupported in mail clients.

---

## D5 — Settings keys: discrete fields, replacing the `digestSchedule` placeholder

**Decision**: Replace the reserved empty `digestSchedule` seed key with five discrete keys:
`digestWeeklyEnabled` (`TRUE`), `digestWeeklyDay` (`Sunday`), `digestMonthlyEnabled` (`TRUE`),
`digestMonthlyDay` (`last`), `digestHour` (`7`). Weekday accepts a name (`Sunday`) or 0–6;
month-day accepts `last` or 1–28; all blank/invalid values fall back to the defaults.

**Rationale**:
- Principle II forbids opaque blobs; five labeled key–value rows are far more hand-editable
  than one packed schedule string, and each is independently testable.
- `seedSettings_` only **appends** missing keys and never overwrites, so hand-set values
  survive re-seeding. Because it never deletes, a previously seeded blank `digestSchedule` row
  may linger; it is unused and can be hand-deleted or ignored (documented in quickstart).
- Capping month-day at 28 (plus the `last` sentinel) sidesteps "day 30 in February" foot-guns
  while still letting the household pick a specific early-month day if they prefer.

**Alternatives considered**: Keep a single `digestSchedule` string (cron-like) — rejected:
opaque, needs a parser, easy to mis-type, against the hand-editable principle.

---

## D6 — Send identity and recipients

**Decision**: Digests are sent **from** the shared household account (the "Execute as: Me"
deploying account) **to** each person's personal email (`maxEmail` / `jazEmail`). A blank
personal email skips only that person (FR-010).

**Rationale**: The script runs as the shared account, so MailApp sends from it — expected and
fine; the household already treats that account as the system identity. The shared account is
never itself a recipient (consistent with the allowlist model — shared is never an actor).
Personal-email presence is the natural per-person on/off already in the data.

**Alternatives considered**: Sending from personal accounts — impossible (script executes as
one account) and unnecessary.

---

## D7 — Item selection and formatting details

**Decision**:
- **Events** included when `start`'s calendar date (household tz) is within the window and
  `owner ∈ {person, both}`. Show title + date + start time.
- **Tasks** included when `dueDate` is non-blank and within the window, `status ∈ {open,
  snoozed}`, and `owner ∈ {person, both}`. Show title + due date (date-only; `dueDate` is a
  date-typed column). Completed/deleted tasks are excluded (FR-014).
- Items **sorted by their date** and grouped by day for the reader to scan top-to-bottom
  (FR-006).
- Windows are **inclusive** on both ends: weekly = `[today, today+6]` (7 days incl. send day);
  monthly = `[first-of-next-month, last-of-next-month]`.

**Rationale**: Mirrors 007's "desired on the calendar" predicate (open/snoozed + dated +
in-window) so digest membership and calendar membership stay consistent. Events carry no
explicit all-day flag in the schema, so events are formatted with their start time and tasks
(date-typed) with date only — no guessing.

**Alternatives considered**: Including no-due-date tasks — rejected: they have no date to place
in a window (consistent with 007). Half-open windows — rejected: inclusive boundaries are
easier to reason about and match the spec's "exactly seven days / whole next month."
