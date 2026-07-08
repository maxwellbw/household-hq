# Quickstart & Validation: Sheets Schema and API (001)

Proves the feature end-to-end against the real deployed web app. Run after
`/speckit.implement` completes.

## Prerequisites

- initial-setup.md **Phase 6** done: Apps Script API enabled, `clasp login`, `backend/`
  created via `clasp create`, the "Household HQ DB" Sheet exists and its ID is in
  `backend/Config.js`.
- First deploy configured per initial-setup.md Phase 7 (execute-as / access settings —
  and see [research.md](research.md) R1 for the browser-CORS caveat; curl below is
  unaffected).

## Deploy

```bash
cd backend
clasp push
clasp deploy            # note the web app URL → export URL=<it>
```

## 1. Provision the database

In the Apps Script editor (`clasp open-script`), run `setupDatabase()` twice.

**Expected**: after run 1, the Sheet has six tabs with frozen header rows and seeded
Settings keys; after run 2, nothing changed (no duplicate tabs/headers/keys) — FR-021.
Fill in `allowedEmails` by hand while you're there.

## 2. Ping

```bash
curl -sL "$URL"
```

**Expected**: `{"ok":true,"data":{"service":"household-hq","version":…}}`

## 3. CRUD round-trip (SC-003)

```bash
# create (client-supplied id proves FR-017 plumbing)
curl -sL -X POST -H 'Content-Type: text/plain;charset=utf-8' --data '{
  "token":"", "action":"tasks.create",
  "payload":{"id":"11111111-1111-1111-1111-111111111111","title":"Buy flea meds","owner":"both","dueDate":"2026-07-20"}
}' "$URL"
# → ok:true, task echoed, status "open"

# replay the exact same create   → ok:true, SAME record, no duplicate row (SC-005)
# list                           → {"ok":true,"data":{"tasks":[…]}} includes the task
# update: {"action":"tasks.update","payload":{"id":"1111…","status":"done"}}
#                                → completedBy/completedAt stamped
# delete: {"action":"tasks.delete","payload":{"id":"1111…"}}
#                                → row gone from the Tasks tab
```

Repeat create/list/update/delete once for `events.*` (title/start/end/owner).

## 4. Errors keep the envelope (SC-002)

| Send | Expect `error.code` |
|---|---|
| `{"action":"nope.nope"}` | `UNKNOWN_ACTION` |
| body `not json` | `BAD_REQUEST` |
| `tasks.create` with `"owner":"dog"` | `VALIDATION_FAILED`, `field:"owner"` |
| `tasks.update` with unknown id | `NOT_FOUND` |

## 5. Hand-edit resilience (SC-004, US3)

In the Sheet by hand: ① sort Tasks by title; ② add a Tasks row with a title but blank
id; ③ set some row's dueDate to `garbage`.

Then `tasks.list` →

- sorted rows still update/delete correctly by id;
- the blank-id row comes back **with a UUID assigned** and an `adopt-id` ActivityLog
  row (FR-022);
- the garbage-date row is returned with `_warnings`, everything else clean (FR-020).

Finally, rename the `title` header to `titel` → any tasks action returns
`SCHEMA_MISMATCH` naming tab+header. Rename it back.

## 6. ActivityLog audit (SC-006)

After steps 3–5 the ActivityLog tab shows exactly: one `provision` set, `create`,
`update`, `delete` (with the task's title in detail), `adopt-id` — timestamp + actor +
targetId each — and **no rows** for the failed requests of step 4.

## 7. Concurrency spot-check (SC-007)

```bash
for i in 1 2 3 4 5; do curl -sL -X POST -H 'Content-Type: text/plain;charset=utf-8' \
  --data "{\"token\":\"\",\"action\":\"tasks.create\",\"payload\":{\"title\":\"race $i\",\"owner\":\"max\"}}" "$URL" & done; wait
```

**Expected**: five `ok:true` (a `BUSY` is acceptable — retry succeeds), five distinct
rows, five log entries, zero corrupt/merged rows.

## 8. SelfTest

Editor → run `selfTest()` → execution log ends `ALL PASS` (covers the above without
curl; useful re-check after any backend change).

## Done

All eight sections behave as stated → SC-001…SC-007 verified → feature 001 is done per
the spec.
