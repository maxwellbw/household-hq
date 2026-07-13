# Seed Data — Household HQ

Working doc for the one-time (idempotent) data load: shopping lists, recurring
events (birthdays, anniversaries, maintenance), recurring/seasonal tasks, and prep
templates. Confirmed items are in the tables; anything still open is in §9. This is the
source list a future `seedLists()` / `seedEvents()` / `seedTemplates()` feature will
encode, plus three small engine extensions (§8).

Status legend: ✅ confirmed · 🔧 needs an engine change (all four now approved to build)

---

## 1. Shopping lists ✅

Two Lists. `[ ]` items load as **need**, `[x]` items as **stocked**. Staple-nudge
threshold stays at Settings default **3**. (8 staples load as `need`, so the dashboard
"time to shop" nudge fires immediately — expected.)

### List: Groceries

| Item | Section | Staple | Status |
|---|---|---|---|
| Coffee | pantry | ✓ | need |
| Yasso bars | frozen | ✓ | need |
| Popcorn | pantry | | need |
| Tea | pantry | | need |
| Pup veggies | frozen | ✓ | need |
| Ice | frozen | | need |
| Bubbly water | pantry | | need |
| Eggs | dairy | ✓ | need |
| Yogurt | dairy | ✓ | need |
| Frozen berries | frozen | ✓ | need |
| Sweet potato | produce | | need |
| Protein pastry | pantry | | need |
| Avocado | produce | ✓ | need |
| Pumpkin (canned, for pup) | pantry | ✓ | need |
| Windex | household | | stocked |
| Carrots | produce | ✓ | stocked |
| Jaz protein bars | pantry | | stocked |
| Pepper | pantry | | stocked |
| Face lotion | household | | stocked |
| Paper towels | household | ✓ | stocked |
| Toilet paper | household | ✓ | stocked |
| Eggos | frozen | | stocked |
| Rice | pantry | | stocked |
| Hot & spicy Bachan BBQ | pantry | | stocked |
| Dish soap | household | | stocked |
| Peanut butter | pantry | | stocked |
| Oatmeal | pantry | | stocked |
| Orange | produce | | stocked |
| Pears | produce | | stocked |
| Body wash | household | ✓ | stocked |
| Ziploc sandwich | household | | stocked |
| Hot sauce (Valentina black label) | pantry | | stocked |
| Hand soap refill | household | | stocked |
| King Arthur all-purpose flour | pantry | | stocked |
| Tin fish | pantry | | stocked |
| Laundry detergent | household | ✓ | stocked |
| Butter | dairy | ✓ | stocked |

### List: Not grocery

| Item | Section | Staple | Status |
|---|---|---|---|
| Dog food | other | ✓ | stocked |

---

## 2. Birthdays (yearly RecurringEvents) ✅

Annually-recurring events. Each has a per-person prep template (§7 mechanism) so lead
time **and** gift-buyer differ per person. `Prep owner` = who owns the gift/prep task.

| Person | Date | Prep owner | Prep task (lead time) |
|---|---|---|---|
| Jazmine | Jan 2 | Max | Buy gift — 2 wks before (−14d) |
| Jaz's Mom | Feb 17 | Jaz | Buy gift — 3 wks before (−21d) |
| Max | Apr 12 | Jaz | Buy gift — 2 wks before (−14d) |
| Max's Dad | Jun 4 | Max | Dinner/wine reservations — 2 wks before (−14d) |
| Jaz's Dad | Jun 7 | Jaz | Buy gift — 2 wks before (−14d) |
| Jaz's Uncle Joe | Jun 12 | both | Text in family group chat — day of (0d) |
| Wyatt | Jul 30 | Max | Buy gift — 1 wk before (−7d) |
| Max's Mom | Sep 13 | Max | Buy gift — 3 wks before (−21d) |

(No pet birthdays for now — Rufus/Cleo tracked via gotcha days in §3.)

---

## 3. Anniversaries (yearly RecurringEvents) ✅

**All five show a live ordinal "Nth anniversary" count** (🔧 engine gap #3 — approved to
build). N = occurrence year − anchor year, with proper ordinal suffix (clarified 2026-07-12).

| Occasion | Anchor (first) date | Displayed |
|---|---|---|
| Started dating | Jan 24 2020 | "Nth dating anniversary" |
| Engaged | May 5 2022 | "Nth engagement anniversary" |
| Married | May 5 2025 | "Nth wedding anniversary" |
| Rufus gotcha day | Jul 10 2022 | "Rufus's Nth gotcha day" |
| Cleo gotcha day | Sep 27 2020 | "Cleo's Nth gotcha day" |

Engaged + Married **both fall on May 5** and both surface each year (confirmed intended).

---

## 4. Recurring house maintenance (Recurring tasks) ✅

Cadence **`semiannually` (every 6 mo)** — 🔧 new cadence, gap #1 approved. Anchors
staggered so no two land in the same month. "+N mo" = from the seed run.

Owners: dishwasher = Max, washing machine = Jaz; the rest `both`.

| Task | Cadence | First occurrence | Owner |
|---|---|---|---|
| Replace water filter | semiannually | +2 mo | both |
| Clean dishwasher | semiannually | +3 mo | Max |
| Deep clean | semiannually | +4 mo | both |
| Clean fridge | semiannually | +5 mo | both |
| Clean oven | semiannually | +6 mo | both |
| Clean washing machine | semiannually | +7 mo | Jaz |

Already seeded elsewhere (do not duplicate): HVAC filter (quarterly), dishwasher
**filter** (monthly), gutters, detector batteries, trash/recycling/yard-waste, mowing,
dog-care chores.

---

## 5. Yard maintenance (Recurring tasks) ✅

All owner `both`.

| Task | Cadence | Season / anchor |
|---|---|---|
| Leaf cleanup | biweekly | season Oct–Dec; anchor late Oct |
| Rake dirt away from fence | monthly | year-round |
| Tree/shrub trim (winter) | annually | Dec 1 |
| Tree/shrub trim (spring) | annually | Apr 1 |

Mowing already seeded (weekly, season Apr–Oct).

---

## 6. Holiday / seasonal (Recurring tasks) ✅

Owner `both`.

| Task | Cadence | Anchor |
|---|---|---|
| Start holiday shopping | annually | Nov 1 |
| Put up Christmas lights | annually | 🔧 computed "weekend before Thanksgiving" (gap #4 approved) |

---

## 7. Vet (Recurring task) ✅

Modeled as a **recurring task**, not an event — the real trigger is "call in October";
the appointment date isn't known until scheduled.

| Task | Cadence | Anchor | Owner |
|---|---|---|---|
| Call vet — schedule annual visit + vaccines | annually | Oct 1 | Max |

---

## 8. Prep templates (TaskTemplates, applied to one-off events) ✅

Attach when creating a one-off event; each row generates a prep task at `offsetDays`
relative to the event date (negative = before, 0 = day of).

### `guests-arriving` — "Guests arrive"

| Task | offsetDays | Owner |
|---|---|---|
| Fresh sheets | −2 | Jaz |
| Clean guest bathroom | −1 | Max |
| Get snacks | −1 | Max |
| Vacuum | 0 (day of) | Jaz |

### `leaving-trip` — "Leaving for a trip"

| Task | offsetDays | Owner |
|---|---|---|
| Get enough pumpkin & pup veggies | −1 | Max |
| Water plants | −1 | Jaz |
| Take trash out | −1 | Max |
| Set out pup instructions | 0 (day of) | Max |
| Key under mat for dog sitter | 0 (day of) | both |

---

## 9. Engine extensions to build (all approved) 🔧

Supported cadences today: `weekly, biweekly, monthly, sixweekly, eightweekly,
quarterly, annually`. Season windows and prep templates already work on Recurring
tasks and RecurringEvents.

1. **`semiannually` cadence (+6 mo)** — mirror the sixweekly/eightweekly addition (023):
   `CADENCES` + `CADENCE_STEP_` in the backend, plus the frontend `Cadence` type +
   labels + dropdowns. Used by all five §4 cleans.
2. **Live "N years" count on anniversaries** — a flag on the RecurringEvent (e.g.
   `countYears`); at materialization the title gets ` — N years` where N = occurrence
   year − anchor year. Backend-only (each occurrence's title is baked when generated);
   no frontend change. Used by all five §3 rows.
3. **Computed "weekend before Thanksgiving" anchor** — bespoke: the Saturday before the
   4th Thursday of November, recomputed per year in the materialization window (plain
   `annually` would drift). Used only by Christmas lights.

---

## 10. Open / deferred

- Upcoming one-off events (trips, weddings, appointments) — Jaz will add later.
- Bills / renewals reminders — skipped for now.
- Pet birthdays (Rufus, Cleo) — not tracked for now.

---

## Next step

Data gathering is complete. This becomes a feature (spec → plan → tasks → implement):
a `seedLists()`/`seedEvents()`/`seedTemplates()` pack (idempotent, mirroring
`seedRecurringPack()`) **plus** the three §9 engine extensions and the list-search UI
enhancement (filter list items by name to flip need⇄stocked). Slot into BACKLOG when Jaz
gives the go.

---

## 11. Implementation notes (feature 027, built 2026-07-12)

Built as `specs/027-household-seed-data/`. No row-level deviations from §1–§8 above — every
value here matches what shipped. Two specifics this doc didn't pin down, now fixed by
implementation and recorded here for traceability:

- **Birthday event titles** are `"<Person>'s birthday"`, including the double-possessive
  cases (e.g. `"Jaz's Mom's birthday"`, `"Max's Dad's birthday"`, `"Jaz's Uncle Joe's
  birthday"`) — grammatically imperfect but unambiguous, and consistent throughout the
  calendar/dashboard/prep-task copy.
- **Anniversary titles** use a `{nth}` token baked to an ordinal at generation (not the
  `"— N years"` shorthand originally sketched in §9 — superseded by the 2026-07-12
  clarification: ordinal "Nth anniversary" style, e.g. `"6th dating anniversary"`,
  `"Rufus's 4th gotcha day"`).
- **§9's engine extension list is superseded** by `specs/027-household-seed-data/data-model.md`
  §3 in one respect: no new `countYears` column was added — the `{nth}` token lives directly
  in the rule's `title` string instead (simpler, no schema change, no `RecurringEvents`
  migration beyond the shared `seedKey` column).

All seedKey/eventType naming conventions, the exact `TEMPLATE_SEED_PACK`/`EVENT_SEED_PACK`/
`LIST_SEED_PACK` contents, and the `seedHousehold()` entry point live in
`backend/Config.js` / `backend/Seed.js` — this doc remains the human-readable source of
truth for *what* was seeded; the spec folder is the source of truth for *how*.
