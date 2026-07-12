# Quickstart — Recurring Events (025) Validation

Live end-to-end validation after implementing and deploying. Backend runs from the Apps
Script editor; API steps use the deployed web-app URL. All dates are household-local.

## Prerequisites

- `cd backend && clasp push && clasp deploy` (or `clasp deploy -i <deploymentId>` to keep
  the existing web-app URL).
- In the Apps Script editor, run **`setupDatabase()`** once — provisions the new
  `RecurringEvents` tab, the `Events.recurringEventId` column, and the
  `recurringEventsLookaheadDays` Settings key (additive; existing data untouched).
- Run **`selfTest()`** — all recurring-events assertions must pass.
- Run **`installRecurringEventsTrigger()`** once — installs the nightly generator (hour 2).
  No re-auth (reuses `script.scriptapp`).

## Scenario A — All-day yearly birthday with prep (US1 + US2)

1. Ensure a prep template exists (e.g. `eventType = "birthday"` with steps "Buy gift"
   `offsetDays -14`, "Plan dinner" `offsetDays -3`) via the Prep Templates manager.
2. `recurringEvents.create` with `title:"Mom's birthday"`, `cadence:"annually"`,
   `anchorDate:` a date ~30 days out this year, `defaultOwner:"both"`,
   `templateId:"birthday"` (no `startTime` ⇒ all-day). Expect `{ recurringEvent }` with a
   blank `lastGenerated`.
3. Run `generateRecurringEvents()` from the editor.
4. **Verify** (`events.list`): exactly one occurrence event exists with an id starting `v`,
   `recurringEventId` = the rule id, a **date-only** `start`/`end` (renders all-day on the
   calendar), owner `both`, title "Mom's birthday".
5. **Verify** (`tasks.list`): two prep tasks linked to that occurrence — "Buy gift" due 14
   days before the birthday, "Plan dinner" due 3 days before.
6. **Idempotency**: run `generateRecurringEvents()` again → still exactly one occurrence and
   one pair of prep tasks (no duplicates). The rule's `lastGenerated` = the occurrence date.

## Scenario B — Timed quarterly with season bounds (US1)

1. `recurringEvents.create` `title:"HVAC filter check"`, `cadence:"quarterly"`,
   `anchorDate:` a near date, `startTime:"09:30"`, `durationMinutes:"60"`,
   `defaultOwner:"max"`, `seasonStart:"3"`, `seasonEnd:"10"`.
2. Run the generator. **Verify**: occurrences within the 60-day window carry
   `start = <date>T09:30`, `end = <date>T10:30`; any occurrence whose month is outside
   Mar–Oct is **not** created; `lastGenerated` advances past the skipped season gap.

## Scenario C — Never-resurrect + cascade-clean (Edge Cases, FR-006/FR-017)

1. `events.delete` one generated occurrence from Scenario A.
2. **Verify**: that occurrence's **open** prep tasks are gone (cascade-clean); a
   **completed** prep task, if any, remains as history.
3. Run `generateRecurringEvents()` again → the deleted occurrence is **not** recreated
   (watermark suppresses it); other occurrences and their prep are unaffected.

## Scenario D — Rule edit/delete affects only future (US3, FR-007/FR-008)

1. `recurringEvents.update` the Scenario B rule's `startTime` to `"08:00"`.
2. **Verify**: occurrences already generated keep `09:30`; the next generation (advance the
   window or clear `lastGenerated` by hand) produces `08:00`.
3. `recurringEvents.delete` the rule. **Verify**: no new occurrences generate; existing
   occurrence events (and any prep) remain as ordinary items.

## Scenario E — No/deleted template (FR-012)

1. Create a rule with no `templateId`, generate → occurrence event with **no** prep, no
   error. Create a rule whose `templateId` names a non-existent template, generate → same
   (plain occurrence, no error).

## Frontend check

- More hub → **Recurring Events**: create/edit/delete rules; all-day rules omit a time,
  timed rules take a time + duration; a template picker lists existing prep templates.
- Calendar: all-day occurrences render as all-day chips on their date; timed occurrences
  render at their time with the owner tint; prep tasks tether to their occurrence.
- `npm run build` passes with no type errors; new UI passes an `/impeccable audit`.
