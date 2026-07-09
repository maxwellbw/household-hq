# Quickstart & Validation: Events and Prep Templates (005)

Live validation that prep generation, template CRUD, and the event-prep lifecycle work
end-to-end against the deployed web app. Mirrors 004's flow; assumes 001–004 are deployed.

## Prerequisites

- `clasp push` of this feature's backend is done, and **`setupDatabase()` has been re-run
  once** so the new `prepGeneratedFor` column is appended to the live Events tab (the header
  migration — step 1). Without it, `events.*` fail `SCHEMA_MISMATCH`.
- `installPrepTrigger()` has been run once from the editor (nightly reconcile trigger). Reuses
  004's `script.scriptapp` scope — no new authorization prompt.
- `URL` = the web-app deployment URL; `TOKEN` = a valid Google ID token for an allowlisted
  account (see 002's quickstart for obtaining one).

> **curl note (from 002):** use `-sL --data …` and **do not** pass `-X POST` (Apps Script
> redirects the POST; `-X` would turn the redirect into a GET). `text/plain` body, JSON inside.

## 0. Editor self-test (fastest signal)

In the Apps Script editor run **`selfTest()`**. It now also covers: `prepTaskId_` determinism +
the prep-id matcher + offset date math (unit); and a live block that seeds a template + event,
generates, and asserts one prep task per step, no duplicate on re-run, re-date on move, retag
swap, delete-purge, non-resurrection of a hand-deleted prep task, and template CRUD round-trip.
The log ends with `ALL PASS` or throws at the first failed assertion.

## 1. Deploy + migrate + install the trigger

```bash
cd backend
clasp push
clasp deploy -i <deploymentId>     # refresh existing web-app URL (no new scopes → no re-auth)
```

Then in the editor, once: run **`setupDatabase()`** (appends `prepGeneratedFor` to Events) and
**`installPrepTrigger()`** (nightly reconcile). Confirm the Events tab now has a
`prepGeneratedFor` header and existing rows/data are intact.

## 2. Template (checklist) CRUD round-trip (US2 · FR-005/006/007)

```bash
# define the "guests-visiting" checklist: two steps → capture their ids
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"templates.create","payload":{"eventType":"guests-visiting","taskTitle":"Clean the house","offsetDays":"-2","defaultOwner":"both"}}'
# → { ok:true, data:{ template:{ id:…, eventType:"guests-visiting", offsetDays:"-2" } } }
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"templates.create","payload":{"eventType":"guests-visiting","taskTitle":"Groceries","offsetDays":"-1","defaultOwner":"jaz"}}'

# edit a step's owner
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"templates.update","payload":{"id":"'"$STEP2"'","defaultOwner":"max"}}'
# → { ok:true, data:{ template:{ defaultOwner:"max" } } }

# unknown field must be rejected
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"templates.create","payload":{"eventType":"x","taskTitle":"y","offsetDays":"-1","defaultOwner":"both","foo":"1"}}'
# → { ok:false, error:{ code:"BAD_REQUEST" } }

# non-integer offset must be rejected
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"templates.create","payload":{"eventType":"x","taskTitle":"y","offsetDays":"soon","defaultOwner":"both"}}'
# → { ok:false, error:{ code:"VALIDATION_FAILED", field:"offsetDays" } }
```

## 3. Tag an event → prep appears, dated + linked (US3 · FR-008/009/010 · SC-002)

```bash
# create a future event tagged guests-visiting (start 2026-07-25) → capture the event id
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"events.create","payload":{"title":"Kim & family visiting","start":"2026-07-25T17:00","end":"2026-07-27T12:00","owner":"both","templateId":"guests-visiting"}}'
# → { ok:true, data:{ event:{ id:…, prepGeneratedFor:"guests-visiting" } } }

# the two prep tasks exist, linked by eventId, dated start-2 and start-1
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.list","payload":{"filter":"all"}}'
# → "Clean the house" dueDate 2026-07-23 (both); "Groceries" dueDate 2026-07-24 (max);
#    each with eventId == the event id, and a "p…" id

# re-generate (simulate the nightly run): run generatePrepTasks() in the editor, then re-list
# → still exactly two prep tasks for the event — no duplicates (SC-002)

# client cannot set the marker
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"events.update","payload":{"id":"'"$EID"'","prepGeneratedFor":"x"}}'
# → { ok:false, error:{ code:"BAD_REQUEST" } }
```

## 4. Move the event → outstanding prep re-dates; completed prep stays (US4 · FR-015 · SC-004)

```bash
# complete "Groceries" first
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.complete","payload":{"id":"'"$GROCERIES_TASK"'"}}'

# push the visit back two days (start 2026-07-27)
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"events.update","payload":{"id":"'"$EID"'","start":"2026-07-27T17:00","end":"2026-07-29T12:00"}}'

# re-list: "Clean the house" (outstanding) re-dated to 2026-07-25 (new start-2);
#          "Groceries" (completed) unchanged at its old date (FR-015)
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.list","payload":{"filter":"all"}}'
```

## 5. Retag → prep set swaps, completed prep from the old set remains (US4 · FR-016)

```bash
# define a different checklist and retag the event to it
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"templates.create","payload":{"eventType":"dinner-party","taskTitle":"Plan menu","offsetDays":"-3","defaultOwner":"both"}}'
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"events.update","payload":{"id":"'"$EID"'","templateId":"dinner-party"}}'

# re-list: outstanding "Clean the house" (old set) is gone; "Plan menu" (new set) appears;
#          the completed "Groceries" from the old set still remains (FR-016)
```

## 6. Non-resurrection — a hand-deleted prep task does not come back (FR-014 · SC-003)

```bash
# delete an outstanding prep task by hand
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.delete","payload":{"id":"'"$PLAN_MENU_TASK"'"}}'

# run generatePrepTasks() in the editor again, then re-list
# → "Plan menu" is NOT re-created — the event is in steady state (templateId == prepGeneratedFor),
#   so the nightly run re-dates survivors but creates nothing (FR-014)
```

## 7. Delete the event → all its prep is purged (US4 · FR-017 · SC-004)

```bash
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"events.delete","payload":{"id":"'"$EID"'"}}'

# re-list: no prep task with eventId == the deleted event remains — completed and outstanding
# alike are gone (a manually created task linked to the event, if any, would remain)
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"tasks.list","payload":{"filter":"all"}}'
```

## 8. Hand-edit resilience (SC-006)

- In the raw Sheet, add an Events row by hand with a `templateId` (leave `id` and
  `prepGeneratedFor` blank) and a future `start`. Run `generatePrepTasks()` → the row's id is
  adopted (001 FR-022) and its prep is generated, `prepGeneratedFor` set — identical to an
  app-created event.
- Change that event's `templateId` by hand and re-run the generator → the prep set swaps
  (transition detected via `templateId != prepGeneratedFor`).

## 9. Activity log (FR-019)

```bash
curl -sL "$URL" --data '{"token":"'"$TOKEN"'","action":"activity.list","payload":{"limit":50}}'
# → "System added 'Clean the house'" prep creates; "System updated …" re-dates; event and
#    template create/update/delete under the acting user; prep purges on delete under the user.
```

## Done when

- `selfTest()` logs `ALL PASS`.
- Tagging a future event materializes one prep task per checklist step, dated `start+offsetDays`
  and linked by `eventId`; re-running the generator adds no duplicates.
- Moving the event re-dates outstanding prep and leaves completed prep; retagging swaps the set
  and keeps completed prep from the old set; deleting the event purges all its prep.
- A hand-deleted prep task is not resurrected by a later generator run.
- Hand-added/hand-retagged Sheet rows are generated identically by the nightly run.
