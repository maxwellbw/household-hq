# Quickstart: Household Seed Data + Engine Extensions

End-to-end validation. Backend steps run from the Apps Script editor (the sandbox can't
execute Apps Script or complete real Google OAuth, so these are manual — same as prior seed
features). Frontend search is verified in the browser preview.

## Prerequisites

- `cd backend && clasp push && clasp deploy` (or `clasp deploy -i <deploymentId>` to refresh
  the existing web-app URL). New `appsscript.json` scopes: none — no re-auth needed.
- `cd frontend && npm run build` passes with no type errors.

## A. Migrate the Sheet + self-test (required first)

1. In the editor, run `setupDatabase()`. Confirm `Lists`, `ListItems`, `TaskTemplates`, and
   `RecurringEvents` each gain a `seedKey` column, and Settings gains blank `listSeedApplied`,
   `templateSeedApplied`, `eventSeedApplied`.
2. Run `selfTest()` → expect `ALL PASS` (includes new ordinal / Thanksgiving / seed asserts).
3. Run `selfTestSeedPack()` → expect `SEED PACK: ALL PASS`.

*Until §A completes, the app fails closed with `SCHEMA_MISMATCH` on affected tabs.*

## B. Seed the data

1. Run `seedHousehold()`. Expect log lines reporting rows added for lists, templates, events,
   and recurring tasks.
2. **Idempotency**: run `seedHousehold()` again → every sub-pack logs "already seeded, no
   changes"; no new rows appear in any tab; ActivityLog gains no rows on this second run.

## C. Verify shopping lists (US1)

1. Open the app → **Lists**. Confirm two lists: **Groceries** and **Not grocery**.
2. Groceries **Needed** view shows the 14 `need` items in section order (produce → dairy →
   frozen → pantry → household → other); staples display their staple marker.
3. Switch to **All** → confirm the `stocked` items are present in the right sections.
4. **Not grocery** contains **Dog food** (staple, stocked).
5. Dashboard shows the "time to shop" nudge (8 staples currently `need` ≥ threshold 3).

## D. Verify birthdays + prep (US2)

1. Run `generateRecurringEvents()` once (or wait for the nightly trigger).
2. On the calendar, confirm the eight birthdays appear on their dates (e.g. "Jaz's
   birthday"), each recurring yearly.
3. Confirm each birthday's prep task materializes at its lead time with the right owner —
   e.g. "Buy Jaz's birthday gift" 14 days before, owned by **Max**; "Buy Max's birthday
   gift" 14 days before, owned by **Jaz**; "Text Uncle in the family group chat" **day
   of**, owned by **both**; "Make dinner/wine reservations for Max's Dad's birthday" 14 days
   before, owned by **Max**.

## E. Verify anniversaries with ordinal titles (US2)

1. With occurrences generated, confirm anniversary titles read as ordinals for the upcoming
   occurrence year — e.g. dating (anchor 2020) shows "7th dating anniversary" for its 2027
   occurrence; "1st"/"2nd wedding anniversary" for married (anchor 2025); "Rufus's Nth gotcha
   day" / "Cleo's Nth gotcha day".
2. Confirm **Engaged** and **Married** both appear on **May 5**.
3. Confirm the ordinal is exactly one higher for the following year's occurrence.

## F. Verify recurring tasks: maintenance / yard / holiday / vet (US3)

1. Run `generateRecurringTasks()` once (or wait for the trigger).
2. In **More → Recurring**, confirm the new rules with correct cadence/owner:
   - Six `Every 6 months` cleans; verify their next due dates land in **six different months**
     (water filter, dishwasher = **Max**, deep clean, fridge, oven, washing machine = **Jaz**).
   - Leaf cleanup (biweekly, only Oct–Dec); rake dirt (monthly); tree trims (Dec + Apr).
   - Holiday shopping (Nov 1); **Christmas lights** shows cadence "Weekend before
     Thanksgiving" and its next due date is the Saturday before Thanksgiving
     (2026-11-21); vet call (Oct 1, **Max**).
3. Confirm leaf-cleanup generates **no** occurrences in summer months and does Oct–Dec.

## G. Verify prep templates on one-off events (US4)

1. Create a one-off event, attach the **Guests arrive** template → confirm prep generates:
   Fresh sheets (−2d, Jaz), Clean guest bathroom (−1d, Max), Get snacks (−1d, Max), Vacuum
   (day of, Jaz).
2. Create a one-off event, attach **Leaving for a trip** → confirm: pumpkin & pup veggies
   (−1d, Max), Water plants (−1d, Jaz), Trash out (−1d, Max), Pup instructions (day of, Max),
   Key under mat for dog sitter (day of, **both**).

## H. Verify list search (US5)

1. On a populated list, type part of an item name (e.g. "pum") → only matching items remain
   visible, in real time, in both Needed and All views.
2. Toggle a filtered item need⇄stocked → status flips and the filter still applies.
3. Type a non-matching string → an empty-result state shows (not a blank screen).
4. Clear the box → the full list returns.

## Regression / done

- `cd frontend && npm run build` clean; Vitest green (new `filterItemsByName` + ordinal/
  Thanksgiving helper tests where applicable).
- `/impeccable audit` on the changed Lists UI before PR (WCAG AA).
- A third `seedHousehold()` run still no-ops (idempotency holds after live edits).
