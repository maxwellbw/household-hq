# Quickstart & Validation: Tasks CRUD and Activity Log (003)

Proves the tightened task lifecycle, the four slices, and the activity feed against the real
deployed web app. Run after `/speckit.implement`. Builds on 001 + 002 being deployed.

## Prerequisites

- Features 001 and 002 deployed; `backend/Config.js` has the real `SPREADSHEET_ID` and
  `OAUTH_CLIENT_ID`; the `Settings` allowlist is filled (Max/Jaz/shared emails).
- A valid Google **ID token** for a personal allowlisted account (Max or Jaz). Mint one via
  the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) with the app's
  Web client ID, or copy one the feature-006 sign-in prints. Export it:
  ```bash
  export URL=<web-app deployment URL>
  export TOKEN=<a Google ID token for Jaz's account>   # examples below assume caller = jaz
  ```

> **curl note (from 002):** use `-sL --data …` and **do not** pass `-X POST` — Apps Script
> 302-redirects POSTs and `-X POST` breaks the follow. `text/plain` is the default, so no
> `-H` is needed (custom headers trigger CORS preflight Apps Script can't answer).

## 0. Editor self-test (fastest signal)

In the Apps Script editor run **`selfTest()`**. It exercises complete/reopen/no-change, the
four slice predicates, and a feed read entirely in-process; the log must end `ALL PASS`.
This covers SC-002/SC-003/SC-006 without minting a token. The live steps below confirm the
same behavior end-to-end over HTTP.

## 1. Deploy

```bash
cd backend
clasp push
clasp deploy -i <deploymentId>     # refresh the existing web-app URL (no re-auth: no new scopes)
```

No `appsscript.json` scope change in this feature, so **no OAuth consent** is needed.

## 2. Task lifecycle — one task, end to end (US1 · FR-001…006 · SC-003)

```bash
# create (open, undated, owner both) → capture the id
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.create","payload":{"title":"Buy flea meds","owner":"both"}}'
# → { ok:true, data:{ task:{ id:…, status:"open", completedBy:"", completedAt:"" } } }
export TID=<that id>

# edit: set a due date, then clear it (partial update; status not allowed here)
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.update","payload":{"id":"'"$TID"'","dueDate":"2026-07-20"}}'
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.update","payload":{"id":"'"$TID"'","dueDate":""}}'   # cleared

# complete → done + attribution; changed:true
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.complete","payload":{"id":"'"$TID"'"}}'
# → data:{ changed:true, task:{ status:"done", completedBy:"jaz", completedAt:"…T…" } }

# complete AGAIN → no-change (FR-003): same completer/time, changed:false
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.complete","payload":{"id":"'"$TID"'"}}'
# → data:{ changed:false, task:{ completedBy:"jaz", … } }   (unchanged)

# reopen → open + completion cleared; changed:true
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.reopen","payload":{"id":"'"$TID"'"}}'
# → data:{ changed:true, task:{ status:"open", completedBy:"", completedAt:"" } }
```

**Expected**: statuses and attribution exactly as annotated; the second complete is a
no-change.

## 3. `tasks.update` refuses lifecycle fields (FR-015)

```bash
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.update","payload":{"id":"'"$TID"'","status":"done"}}'
# → { ok:false, error:{ code:"BAD_REQUEST", … "use tasks.complete / tasks.reopen" } }
```

## 4. Slices (US2 · FR-008/009/010 · SC-002)

Seed one task of each owner, then request each filter as this caller (jaz):

```bash
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.create","payload":{"title":"jaz solo","owner":"jaz"}}'
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.create","payload":{"title":"max solo","owner":"max"}}'
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.create","payload":{"title":"shared","owner":"both"}}'

curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.list","payload":{"filter":"mine"}}'     # jaz-owned only
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.list","payload":{"filter":"theirs"}}'   # max-owned only
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.list","payload":{"filter":"ours"}}'     # both-owned only
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.list","payload":{"filter":"default"}}'  # jaz-owned + both-owned
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.list","payload":{"filter":"all"}}'      # everything
```

**Expected**: `mine`/`theirs`/`ours` disjoint and their union equals `all`; `default` =
`mine` ∪ `ours`; `both` tasks appear only in `ours`/`default`. Repeating with Max's token
flips `mine`↔`theirs` — proving the slice follows the verified caller, not a parameter
(FR-009). An unknown `filter` returns `VALIDATION_FAILED`.

## 5. Activity feed (US3 · FR-011/012/013 · SC-004/005)

```bash
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"activity.list","payload":{"limit":20}}'
```

**Expected**:
- Newest-first entries, each with `timestamp, actor, action, targetId, detail, summary`.
- The steps above appear as readable summaries — e.g. `"Jaz completed 'Buy flea meds'"`,
  `"Jaz added 'jaz solo'"` — with `complete`/`reopen` as distinct actions (not `update`).
- Delete `$TID`, fetch the feed again: its create/complete/reopen entries **still read
  meaningfully** with the title intact (FR-013/SC-005) even though the task is gone.
- The re-complete in step 2 produced **no** extra entry (SC-006).
- `since` returns only newer entries; a huge `limit` is clamped to 500; a fresh household
  (empty log) returns `{ activity: [] }`.

## Cleanup

Delete any tasks created above (`tasks.delete`), or leave them — the feed keeps their
history either way. The `selftest-` prefixed rows from step 0 clean themselves up.
