# Quickstart: Email Digests (email-digests)

Live validation that Max and Jaz each receive a personalized **weekly "week ahead"** and
**monthly "next month"** email, correctly owner-filtered, HTML-formatted with owner colors,
schedule-driven from Settings, and never double-sent. Backend-only feature — validate via the
Apps Script editor (`selfTest()` for the pure logic) plus a real end-to-end send to both
inboxes.

## Prerequisites

- 001–007 deployed; the web app runs as the **shared household account**
  (`household@example.com`) with "Execute as: Me".
- Settings has non-blank `maxEmail` and `jazEmail` (the two personal inboxes) and a valid
  `timezone` (default `America/Los_Angeles`).
- Some **Events** and **dated Tasks** exist in the Sheet in the next 7 days and in next
  calendar month, with a mix of owners (`max`, `jaz`, `both`) — enough to see filtering.

## One-time setup (deploying shared account)

1. **Push + deploy** the backend:
   ```bash
   cd backend
   clasp push --force            # manifest scope change (script.send_mail)
   clasp deploy -i <existing deploymentId>   # refresh the web-app URL (or `clasp deploy` for a new one)
   ```
2. **Authorize the new mail scope.** The manifest now lists
   `https://www.googleapis.com/auth/script.send_mail`. Open the editor (`clasp open-script`)
   and run **`sendWeeklyDigestNow()`** once — the first `MailApp.sendEmail` forces Apps Script
   to prompt for the new scope. Complete the OAuth consent — **only the shared deploying
   account** re-authorizes (not Max's/Jaz's personal accounts).
3. **Seed the new Settings.** Run **`setupDatabase()`** once from the editor. It appends the
   five digest keys (`digestWeeklyEnabled`, `digestWeeklyDay`, `digestMonthlyEnabled`,
   `digestMonthlyDay`, `digestHour`) with defaults. Idempotent. *(A leftover blank
   `digestSchedule` row from earlier seeding is unused — hand-delete it or ignore it.)*
4. **Install the daily trigger.** Run **`installDigestTrigger()`** once (idempotent; installs
   the `sendDigests` handler at `digestHour`, default 6–7am household tz). Re-run this only if
   you later change `digestHour`.

## Automated self-test (no email sent)

Run **`selfTest()`** in the editor. It exercises the **pure** digest logic without sending
mail and must print **ALL PASS**, covering:

- **Owner filtering**: a `max`-owned item appears in Max's digest and **not** Jaz's; a `both`
  item appears in both; Jaz's solo item never appears in Max's build.
- **Window boundaries**: weekly includes today and today+6, excludes today−1 and today+7;
  monthly includes first/last of next month, excludes this month and two-months-out.
- **Task status**: completed/deleted and no-due-date tasks are excluded.
- **Empty state**: a zero-item build still yields a non-blank "nothing scheduled" body.
- **Dedupe**: `alreadySent_` returns true when a matching period-key ActivityLog row exists.
- **Entry points**: `sendDigests()` runs the gate without throwing when today is not a send
  day (no-op).

## End-to-end validation (real emails)

Run the manual kicks from the editor (they bypass only the day gate):

### Scenario A — Weekly digest, both recipients, owner-filtered
1. Run **`sendWeeklyDigestNow()`**.
2. **Expect**: Max's inbox and Jaz's inbox each get one "week ahead" email. Max's lists his +
   `both` items for the next 7 days; Jaz's lists hers + `both`. Neither shows the other's solo
   items. Items are grouped/ordered by date; owner chips show the right colors (Max teal, Jaz
   plum, Both terracotta). Timed events show a time; tasks show a date only.
3. Check the **ActivityLog**: two new `digest-weekly` rows, `targetId`
   `weekly/<today>/max` and `weekly/<today>/jaz`.

### Scenario B — Monthly digest
1. Run **`sendMonthlyDigestNow()`**.
2. **Expect**: each inbox gets one "next month" email covering all of next calendar month's
   relevant items; nothing from this month or two months out. Two `digest-monthly` ActivityLog
   rows appear.

### Scenario C — No double-send (idempotency)
1. Run **`sendWeeklyDigestNow()`** again the same day.
2. **Expect**: **no** new emails arrive and **no** new `digest-weekly` rows are added — the
   existing period-key rows short-circuit the send (FR-011, SC-004).

### Scenario D — Empty window
1. Temporarily point a run at a person with no items in the window (e.g. clear their upcoming
   items, or test with a future-empty week).
2. **Expect**: that person still receives a clear "Nothing on the calendar for the coming
   week" email — not a blank message and not a skip (FR-009).

### Scenario E — Missing recipient email
1. Blank one person's email in Settings (e.g. `jazEmail`), run **`sendWeeklyDigestNow()`**.
2. **Expect**: only the other person is emailed; the run completes with no error; no row is
   logged for the skipped person (FR-010, SC-005). Restore the email afterward.

### Scenario F — Schedule is Settings-driven
1. Set `digestWeeklyDay` to today's weekday and `digestWeeklyEnabled` = `TRUE`; run
   **`sendDigests()`** (the real gate). Confirm the weekly digest sends.
2. Set `digestWeeklyEnabled` = `FALSE`; run **`sendDigests()`** again (clear the day's dedupe
   rows first if re-testing). Confirm **no** weekly email sends (FR-008, SC-007).

## Success criteria mapping

| Scenario | Requirements / SC |
|----------|-------------------|
| self-test | FR-003/004/006/009/011/014, SC-001/002/006 |
| A | FR-001/003/004/005/006/007/007a/012/013, SC-001/003 |
| B | FR-002/003/004, SC-002 |
| C | FR-011, SC-004 |
| D | FR-009, SC-006 |
| E | FR-010, SC-005 |
| F | FR-008/015, SC-007 |

## Ongoing operation

Once validated, the daily `sendDigests` trigger runs unattended: it emails the weekly digest
on `digestWeeklyDay` and the monthly digest on `digestMonthlyDay`, each at most once per
period per person. Adjust cadence or turn either off by editing the Settings tab (no code
change; re-run `installDigestTrigger()` only if you change `digestHour`).
