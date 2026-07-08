# Quickstart & Validation: Recurring Chore Engine (004)

Proves rule CRUD, nightly generation, idempotency, the tombstone (no resurrection),
seasonal skipping, and rule-independence — against the real deployed web app plus an
editor run of the generator. Run after `/speckit.implement`. Builds on 001 + 002 + 003.

## Prerequisites

- Features 001–003 deployed; `backend/Config.js` has the real `SPREADSHEET_ID` and
  `OAUTH_CLIENT_ID`; the `Settings` allowlist is filled.
- `setupDatabase()` has been re-run once after this feature's `clasp push` so the
  `recurringLookaheadDays` Settings key is seeded (append-only; existing values untouched).
- A valid Google **ID token** for a personal allowlisted account (Max or Jaz):
  ```bash
  export URL=<web-app deployment URL>
  export TOKEN=<a Google ID token for Jaz's account>   # examples below assume caller = jaz
  ```

> **curl note (from 002):** use `-sL --data …` and **do not** pass `-X POST` (Apps Script
> 302-redirects POSTs); `text/plain` is the default, so send no custom headers.

## 0. Editor self-test (fastest signal)

In the Apps Script editor run **`selfTest()`**. It now also covers: occurrence math for
every cadence (incl. month-end/leap-day clamping) and season windows in-process, plus a live
block that seeds a rule, runs the generator, and asserts correct dated tasks, a duplicate-free
re-run, no resurrection of a deleted occurrence, and an out-of-season no-op. The log must end
`ALL PASS`. This covers SC-002/SC-003/SC-004/SC-006 without minting a token. The steps below
confirm the same behavior end-to-end.

## 1. Deploy + seed + install the trigger

```bash
cd backend
clasp push
clasp deploy -i <deploymentId>     # refresh existing web-app URL (no new scopes → no re-auth)
```

Then, once, from the Apps Script editor:
- Run **`setupDatabase()`** (seeds `recurringLookaheadDays=30`).
- Run **`installRecurringTrigger_()`** (creates the single daily trigger; re-running it does
  not stack duplicates). Confirm under **Triggers** that exactly one `generateRecurringTasks_`
  time-driven trigger exists.

## 2. Rule CRUD round-trip (US2 · FR-001/009/010)

```bash
# create a monthly rule anchored in the recent past, owner both → capture the id
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"recurring.create","payload":{"title":"Flea & tick meds","cadence":"monthly","anchorDate":"2026-06-15","defaultOwner":"both"}}'
# → { ok:true, data:{ recurring:{ id:…, lastGenerated:"" } } }
export RID=<that id>

# edit the title
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"recurring.update","payload":{"id":"'"$RID"'","title":"Flea + tick meds"}}'
# → { ok:true, data:{ recurring:{ title:"Flea + tick meds" } } }

# lastGenerated is generator-managed — must be refused (research D8)
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"recurring.update","payload":{"id":"'"$RID"'","lastGenerated":"2026-06-15"}}'
# → { ok:false, error:{ code:"BAD_REQUEST" } }

# half a season window — must be rejected
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"recurring.create","payload":{"title":"x","cadence":"weekly","anchorDate":"2026-06-01","defaultOwner":"max","seasonStart":"4"}}'
# → { ok:false, error:{ code:"VALIDATION_FAILED", field:"seasonEnd" } }
```

## 3. Generate + idempotency (US1 · FR-003/004/005/006 · SC-002)

From the editor, run **`generateRecurringTasks_()`** (don't wait for the nightly trigger).
Then list generated tasks for the rule:

```bash
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.list","payload":{"filter":"all"}}' \
  | tr ',' '\n' | grep -A0 "$RID"
```

Expected:
- One or more Tasks with `recurringId == $RID`, `owner:"both"`, `status:"open"`, and a
  `dueDate` on the rule's anchor day-of-month, all within the next 30 days (FR-004/016).
- Each task's `id` starts with `r` (deterministic id, D1).
- The rule's `recurring.list` now shows a non-blank `lastGenerated` (the watermark, D2).

**Idempotency**: run `generateRecurringTasks_()` **again**. `tasks.list` shows the **same**
count for `$RID` — no duplicates (SC-002). The activity feed shows no new `create` rows for
the unchanged window:

```bash
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"activity.list","payload":{"limit":50}}'
# → the earlier "System added 'Flea + tick meds'" create rows, none duplicated on re-run
```

## 4. Tombstone — a deleted occurrence is not resurrected (US1 · FR-013 · SC-004)

```bash
# delete one generated occurrence (grab a task id with recurringId == $RID from step 3)
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.delete","payload":{"id":"<occurrence task id>"}}'
```

Run **`generateRecurringTasks_()`** again → the deleted occurrence does **not** reappear
(its `dueDate` is ≤ `lastGenerated`, so the generator never revisits it). Any genuinely new
occurrence entering the sliding window still appears.

## 5. Completion does not touch the rule (FR-008 · SC-004)

```bash
# complete a generated occurrence
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.complete","payload":{"id":"<another occurrence task id>"}}'
# → { ok:true, data:{ task:{ status:"done" }, changed:true } }
```

`recurring.list` for `$RID` is unchanged (same `cadence`/`anchorDate`/`lastGenerated`);
future runs keep generating the next occurrence on schedule.

## 6. Seasonal skip (FR-014)

```bash
# a summer-only weekly chore: season Apr–Oct (4–10), anchored in July
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"recurring.create","payload":{"title":"Mow lawn","cadence":"weekly","anchorDate":"2026-07-01","defaultOwner":"max","seasonStart":"4","seasonEnd":"10"}}'
```

Run `generateRecurringTasks_()`:
- If today is within Apr–Oct → weekly `Mow lawn` tasks appear in the window.
- Set the season to an off month (e.g. `12`–`2`) via `recurring.update`, clear the rule's
  `lastGenerated` **by hand** in the Sheet, and re-run → **no** new `Mow lawn` tasks for the
  out-of-season window (occurrences skipped, watermark still advances). Confirms out-of-season
  generation is a no-op.

## 7. Hand-edit resilience (SC-006)

In the Sheet, hand-add a Recurring row (leave `id` blank): `title=Air filter`,
`cadence=quarterly`, `anchorDate=2026-01-01`, `defaultOwner=both`. Run
`generateRecurringTasks_()`:
- The blank-id row is adopted with a UUID (001 FR-022; an `adopt-id` feed row by `system`).
- Quarterly `Air filter` tasks are materialized identically to an API-created rule.

## Done when

- `selfTest()` logs `ALL PASS`.
- Steps 2–7 behave as described: CRUD + validation refusals, generation with deterministic
  ids, duplicate-free re-runs, no resurrection of deleted occurrences, rule-independence on
  completion, seasonal skipping, and hand-edited rules picked up.
- Exactly one `generateRecurringTasks_` trigger is installed.
