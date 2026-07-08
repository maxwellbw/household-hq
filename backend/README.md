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
   or run `selfTest()` in the editor (expects `ALL PASS`).

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
