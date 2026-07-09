# Contract: Email Digests (008)

This feature exposes **no new HTTP API verb** (no `doGet`/`doPost` change) and no frontend
surface. Its "contracts" are: the trigger/editor entry points, the email output shape, the
Settings inputs, and the ActivityLog rows it writes. Downstream features and the users depend
on these staying stable.

---

## 1. Entry points (Apps Script functions — all public, no trailing underscore)

| function | kind | contract |
|----------|------|----------|
| `sendDigests()` | trigger handler + manual | The daily gate. Reads Settings; sends weekly and/or monthly digests to due recipients **iff today matches the configured day and the digest is enabled**. Idempotent — safe to run any number of times per day (dedupe via ActivityLog). Never throws on a single-recipient failure; logs and continues. |
| `installDigestTrigger()` | editor-run installer | Deletes any existing `sendDigests` trigger and installs one daily time-based trigger at `digestHour` (household tz). Re-run to apply a changed `digestHour`. Idempotent. |
| `sendWeeklyDigestNow()` | manual test kick | Sends the weekly digest **bypassing only the weekday gate** — still honors `digestWeeklyEnabled`, dedupe, and email presence. For quickstart validation on any day. |
| `sendMonthlyDigestNow()` | manual test kick | Same, for the monthly digest (bypasses the day-of-month gate only). |

**Guarantees:**
- **Idempotent** (FR-011, Principle V): a given `(kind, period, person)` is emailed at most
  once, enforced by ActivityLog dedupe under `LockService`.
- **Isolation**: one recipient's failure (e.g. bad address) never blocks the other (FR-010).
- **Logged** (FR-012): every successful send appends exactly one ActivityLog row.
- **Timezone-correct** (FR-013): all windows/day checks use the household tz from Settings.

---

## 2. Email output contract (`MailApp.sendEmail`)

Each send is `MailApp.sendEmail({ to, subject, htmlBody, body })`:

- **`to`**: the recipient's personal email (`maxEmail` or `jazEmail`). Blank → recipient
  skipped, no send, no error (FR-010).
- **`subject`**: identifies kind + period, e.g. `Your week ahead — Jul 13–19`,
  `August at a glance`.
- **`htmlBody`**: HTML with **inline** owner-color styling (Max `#3E6E68`, Jaz `#7E4A5E`, Both
  `#C6613F`), items grouped by day, each showing title + date (+ time for events) + owner chip
  (FR-006, FR-007, FR-007a). Warm, app-consistent styling; no JS, no external CSS/fonts.
- **`body`**: plain-text fallback, same items, owner as `[Max]`/`[Jaz]`/`[Both]` labels.
- **Empty state** (FR-009): when `count == 0`, both bodies still render a clear
  "Nothing on the calendar for the coming week/month" message — never blank.

**Contents (per recipient `p`)** — only items with `owner ∈ {p, both}`; the other person's
solo items never appear (FR-003, FR-004).

---

## 3. Settings inputs (read each run)

See [data-model.md](../data-model.md) for full validation. Summary of the contract:

| key | shape | on blank/invalid |
|-----|-------|------------------|
| `digestWeeklyEnabled` / `digestMonthlyEnabled` | boolean-ish | default `TRUE` |
| `digestWeeklyDay` | weekday name or 0–6 | default `Sunday` |
| `digestMonthlyDay` | `last` or 1–28 | default `last` |
| `digestHour` | 0–23 | default `7` |
| `maxEmail` / `jazEmail` | email or blank | blank → that recipient skipped |
| `timezone` | IANA tz | falls back per existing `getTimezone_()` |

Changing weekday / month-day / enabled flags takes effect **next run, no reinstall**. Changing
`digestHour` requires re-running `installDigestTrigger()`.

---

## 4. ActivityLog rows written

| action | targetId (period key) | when |
|--------|-----------------------|------|
| `digest-weekly` | `weekly/<yyyy-MM-dd>/<person>` | after a weekly digest is emailed to a person |
| `digest-monthly` | `monthly/<yyyy-MM>/<person>` | after a monthly digest is emailed to a person |

These rows are both the audit trail (FR-012) and the dedupe ledger (FR-011). `actor = system`.

---

## 5. OAuth scope

Adds `https://www.googleapis.com/auth/script.send_mail` (MailApp send). The deploying (shared)
account re-authorizes once after the manifest change. No other new scope; `script.scriptapp`
(trigger install) already present.
