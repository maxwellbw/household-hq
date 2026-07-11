# Feature Specification: Recurring Seed Pack & Alternating Weeks

**Feature Branch**: `015-recurring-seed-pack`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Recurring seed pack & alternating weeks. Provide a hand-editable starter pack of common home-maintenance recurring chores plus a clean way to model alternating-week bin collection. (1) Alternating weeks via offset biweekly rules — model alternating curbside collection using the existing recurring engine (biweekly = 14-day step from anchor date) with no new concepts: Trash weekly, Yard waste and Recycling biweekly anchored a week apart so they land on alternating weeks. (2) A hand-editable starter pack of common home-maintenance chores seeded by a one-time editor-run function (like setupDatabase — public, idempotent, appends only, never overwrites hand-edits): HVAC air filter (quarterly), clean dishwasher filter, clean gutters, replace smoke/CO detector batteries, mow lawn (seasonal, April–October), plus the bin rules. Everything is normal Recurring-tab rows the household fully owns and can edit or delete by hand. Decide the mowing season window here."

## Clarifications

### Session 2026-07-10

- Q: How does the seeder recognize a starter chore is already present (for dedup / edit-preservation)? → A: By a dedicated, stable **seed-key column** on the Recurring tab, not by title. Each pack chore has a fixed key; the seeder writes it on rows it creates and reads it to decide what already exists. Renaming a seeded chore's title therefore never causes a re-add.
- Q: If the household deletes a seeded chore, what does a later manual re-run of the seeder do? → A: **Never resurrect it.** A deleted starter chore stays gone across re-runs — matching how feature 004 treats a user-deleted occurrence. This requires the seeder to persist which keys it has already applied (a hand-editable ledger in Settings), so "already seeded" is remembered even after the row is deleted.
- Q: How is "Clean gutters" seeded, given the engine has no biannual cadence? → A: As a **single annual rule** (anchored in fall). The household can add a spring rule by hand if they want twice-a-year cleaning.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seed a starter pack of common chores in one run (Priority: P1)

Max or Jaz runs a single one-time function that populates the household's recurring-chore
list with a curated set of common home-maintenance chores — air filter, dishwasher filter,
gutters, detector batteries, lawn mowing, and the weekly/alternating bin collection — each
already carrying a sensible cadence, a starting anchor date, a default owner, and (where
seasonal) a month window. From that moment the recurring engine materializes dated tasks for
these chores exactly as it does for any hand-entered rule; the household never had to think
up the list or type each rule by hand.

**Why this priority**: The starter pack is the whole point of the feature — it turns an empty
Recurring tab into a working home-maintenance schedule with one action, removing the blank-page
problem. Without it there is nothing to seed and no feature.

**Independent Test**: Starting from a Recurring tab with none of the pack's chores present,
run the seed function once and confirm that every chore in the pack now exists as a normal
recurring rule with the expected title, cadence, owner, anchor, and season window, and that
the recurring engine then generates dated tasks from them on its next run.

**Acceptance Scenarios**:

1. **Given** a Recurring tab that does not yet contain the starter-pack chores, **When** the
   seed function is run, **Then** each chore in the pack is added as a normal recurring rule
   carrying its title, cadence, starting anchor date, default owner, and season window (where
   seasonal), and each addition is attributed in the activity log.
2. **Given** a household that has just seeded the pack, **When** the recurring engine next
   runs, **Then** it materializes dated tasks from the seeded rules identically to how it
   treats any hand-entered rule (the seeded rules are ordinary Recurring rows, not a special
   kind).
3. **Given** a seeded rule, **When** the household later opens the Recurring tab, **Then** they
   can edit any of its fields (title, cadence, anchor, owner, season) or delete it by hand,
   with no field locked or hidden.

---

### User Story 2 - Re-run the seeder safely without duplicates or clobbering edits (Priority: P1)

The seeder can be run more than once — after a schema migration, when trying it out again, or
by accident — and it never creates a second copy of a chore it already added, and it never
overwrites a chore the household has since edited. Once a starter chore exists, the household
owns it; re-running the seeder leaves their version exactly as they left it and only fills in
starter chores that are genuinely missing.

**Why this priority**: An editor-run function that isn't safe to re-run is a foot-gun in a
Sheet the household edits by hand every day. Idempotency and edit-preservation are what make
the seeder trustworthy enough to keep in the project rather than a one-shot script that must
never be touched again. This is inseparable from US1 being usable in practice.

**Independent Test**: Run the seeder, edit a seeded rule's owner and anchor by hand, run the
seeder a second time, and confirm no duplicate rule appeared and the hand-edited rule is
unchanged.

**Acceptance Scenarios**:

1. **Given** a starter chore already present in the Recurring tab, **When** the seeder is run
   again, **Then** no second rule for that chore is created — the pack is materialized at most
   once per chore.
2. **Given** a seeded rule whose owner, anchor, cadence, or season the household has since
   changed by hand, **When** the seeder is run again, **Then** that rule is left exactly as the
   household edited it — the seeder never resets or overwrites it.
3. **Given** a starter chore the household has deleted from the Recurring tab, **When** the
   seeder is run again, **Then** the chore is **not** re-added — its seed key is already recorded
   as applied, so a deleted starter chore stays gone (deletion is permanent, matching feature
   004's treatment of a deleted occurrence).
4. **Given** any addition the seeder makes on a re-run, **When** it succeeds, **Then** only the
   genuinely-new rules are appended and attributed in the activity log; unchanged chores produce
   no log noise.

---

### User Story 3 - Alternating bin collection without new machinery (Priority: P2)

The household's real-world curbside schedule — trash every week, and recycling and yard waste on
opposite weeks — is expressed entirely with the recurring rules that already exist: a weekly rule
for trash, and two biweekly rules whose starting anchor dates sit one week apart so recycling
falls on one week and yard waste on the next. The household sees the correct bin on the calendar
each week and can shift the whole schedule to match their actual pickup day just by changing the
anchor dates — no special "alternating" concept to learn or maintain.

**Why this priority**: Alternating pickup is the single most common real-world recurrence that
looks like it needs a new feature but doesn't. Proving (and documenting) that offset biweekly
anchors cover it keeps the engine simple and gives the household a schedule they'll actually
rely on. It rides on the P1 seeding mechanism, so it is P2.

**Independent Test**: Seed (or hand-create) trash weekly plus recycling and yard waste biweekly
anchored one week apart, run the engine across several weeks, and confirm trash appears every
week while recycling and yard waste alternate — never both due in the same week, each due every
other week.

**Acceptance Scenarios**:

1. **Given** a weekly trash rule and two biweekly rules (recycling, yard waste) whose anchor
   dates are exactly one week apart, **When** the engine materializes tasks across several weeks,
   **Then** trash comes due every week, and in each week exactly one of recycling / yard waste
   comes due — the two never collide in the same week and each recurs every other week.
2. **Given** the alternating bin rules, **When** the household changes the anchor dates to match
   their actual pickup day, **Then** every future occurrence shifts accordingly with the weekly /
   alternating pattern preserved, using only ordinary anchor-date edits.
3. **Given** the alternating-week pattern, **When** a household member wants to understand or
   reproduce it, **Then** the pattern is documented as a supported recipe so it can be set up by
   hand without reverse-engineering the engine.

---

### Edge Cases

- **Placeholder anchor dates**: seeded rules ship with a reasonable starting anchor (bins on a
  placeholder collection day, maintenance chores anchored around the seed run) that almost
  certainly does not match the household's real dates. The household is expected to correct
  anchors after seeding; the seed's job is a sensible, editable starting point, not the household's
  exact schedule.
- **Partial pack already present**: if some starter chores exist (hand-created earlier, or a prior
  partial seed) and others do not, the seeder fills only the missing ones and touches nothing that
  is already present.
- **Household-renamed starter chore**: renaming a seeded chore's title does not affect
  recognition — the seeder identifies it by its seed key (in the dedicated column), so a re-run
  correctly treats it as already present and leaves the rename intact.
- **Household clears a seed key by hand**: if the household blanks a row's seed-key cell or removes
  a key from the applied-keys ledger, that chore becomes eligible for (re-)seeding on the next run —
  this is the deliberate, human-readable escape hatch, not a bug.
- **Mowing at the season boundary**: a mow occurrence whose due date falls in a month outside the
  April–October window is not generated (the recurring engine already enforces season bounds);
  occurrences resume when the window reopens the next spring.
- **Empty vs. seeded database**: seeding is independent of `setupDatabase` — it assumes the
  Recurring tab and its columns already exist and only appends rows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a one-time, editor-runnable seed function that appends a
  curated starter pack of common home-maintenance recurring chores to the Recurring tab.
- **FR-002**: Each seeded chore MUST be a normal Recurring rule carrying a title, a cadence drawn
  only from the engine's existing cadences, a starting anchor date, a default owner
  (`max` / `jaz` / `both`), and, where seasonal, a month-based season window — with no fields
  locked, hidden, or of a new kind.
- **FR-003**: The seed function MUST be idempotent: running it any number of times results in at
  most one rule per starter chore, never a duplicate. Identity for this purpose MUST be a stable
  per-chore **seed key**, not the rule's title.
- **FR-004**: The seed function MUST preserve household edits: a starter chore already present
  (including one whose fields — title included — the household has since changed) MUST be left
  exactly as-is on re-run. The seeder appends only, never overwrites.
- **FR-004a**: The Recurring tab MUST carry a dedicated seed-key column; every rule the seeder
  creates MUST record its chore's seed key there, and rows created by hand leave it blank. This
  column is the only schema addition this feature introduces and MUST remain human-readable.
- **FR-004b**: The seeder MUST persist an applied-keys ledger in Settings and, on each run, skip
  any pack chore whose key is already in the ledger — so a starter chore the household has
  **deleted** is never resurrected. Adding a chore also adds its key to the ledger.
- **FR-005**: The starter pack MUST include at minimum: HVAC air filter change (quarterly),
  dishwasher filter clean, gutter cleaning (a single annual rule anchored in fall), smoke/CO
  detector battery replacement, seasonal lawn mowing, and the weekly + alternating bin-collection
  rules (trash, recycling, yard waste).
- **FR-006**: The seasonal lawn-mowing rule MUST be seeded with a season window of April through
  October inclusive (resolving brief open question #4).
- **FR-007**: Alternating bin collection MUST be modeled using only existing recurrence concepts —
  a weekly rule for trash and two biweekly rules (recycling, yard waste) whose anchor dates are set
  one week apart — introducing no new "alternating" cadence, flag, or entity.
- **FR-008**: The two biweekly bin rules MUST, once seeded, produce alternating occurrences: over
  any two-week span each comes due once, and in any single week at most one of them is due.
- **FR-009**: Every rule the seeder adds MUST be attributed in the activity log; a re-run that adds
  nothing MUST NOT produce spurious activity-log noise for chores it left untouched.
- **FR-010**: The alternating-week bin pattern MUST be documented as a reusable recipe (how to pick
  anchor dates one week apart) so the household can recreate or adjust it by hand.
- **FR-011**: Seeded anchor dates MAY be placeholders that the household is expected to correct;
  the system MUST allow the household to change any seeded rule's anchor, owner, cadence, title, or
  season by hand without breaking the seeder's idempotency for the remaining chores.

### Key Entities *(include if feature involves data)*

- **Starter pack**: the curated, in-code list of common home-maintenance chores the seed function
  knows how to add. It is a source of *initial* data, not a live registry — once a chore is seeded,
  the Recurring-tab row is the source of truth and the household owns it.
- **Seeded recurring rule**: an ordinary Recurring-tab row (title, cadence, anchor date, default
  owner, optional season start/end) that happens to have originated from the starter pack.
  Indistinguishable in structure and behavior from a hand-entered rule.
- **Seed key**: a stable, fixed identifier assigned to each chore in the starter pack. The seeder
  writes it into a dedicated seed-key column on every Recurring row it creates, and reads it to
  decide whether that pack chore already exists. It is the sole identity used for
  duplicate-prevention and edit-preservation — independent of the row's title, so renaming a
  seeded chore never causes a re-add.
- **Applied-keys ledger**: a hand-editable record in Settings of every seed key the seeder has
  already applied. It is what makes deletion permanent — once a key is in the ledger the seeder
  skips that chore forever, even if its row has been deleted. Clearing a key from the ledger by
  hand is the deliberate way a household re-enables seeding of a chore they previously removed.
- **Alternating bin pair**: the two biweekly rules (recycling, yard waste) whose anchor dates are
  offset by one week to produce the alternating pattern. Not a distinct entity — just two ordinary
  rules in a documented relationship.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A household starting with none of the pack's chores can go from empty to a complete
  working home-maintenance schedule with a **single** seed run.
- **SC-002**: Running the seeder twice in a row results in **zero** duplicate rules — the rule count
  after the second run equals the count after the first.
- **SC-003**: After the household edits a seeded rule and re-runs the seeder, **100%** of their
  edits survive unchanged.
- **SC-004**: Across any 8-week span after seeding the bins, trash comes due in **every** week and
  recycling / yard waste each come due in **exactly 4** of the 8 weeks, never in the same week as
  each other.
- **SC-005**: Lawn-mowing tasks are generated **only** for occurrences due April–October; **zero**
  mow tasks are generated for November–March.
- **SC-006**: A household member can reproduce the alternating-bin setup by hand from the documented
  recipe without reading engine source code.

## Assumptions

- **Identity by seed key** (clarified 2026-07-10): the seeder recognizes a starter chore by a
  stable per-chore seed key stored in a dedicated Recurring column, not by title. This survives
  renames and edits to every field. The trade-off vs. a title match is one added column, accepted
  because it is human-readable and makes edit-preservation and never-resurrect unambiguous.
- **Deletion is permanent** (clarified 2026-07-10): a starter chore the household deletes is not
  resurrected by a later seed run, enforced by the applied-keys ledger in Settings. To deliberately
  re-seed a removed chore, the household clears its key from the ledger by hand.
- **Default owner is `both`**: home-maintenance chores in the pack default to `both`; the household
  reassigns to `max` or `jaz` as they see fit. No attempt is made to guess per-chore ownership.
- **Placeholder anchors**: bin rules are anchored on a generic starting collection day and the two
  biweekly rules exactly one week apart; maintenance chores are anchored around the seed run date.
  These are starting points the household corrects, not their real pickup/maintenance dates.
- **Cadence vocabulary is fixed**: the pack uses only the recurrence cadences the engine already
  supports (weekly, biweekly, monthly, quarterly, annually); chores with no exact fit (e.g. gutters
  twice a year) are seeded at the nearest supported cadence for the household to adjust.
- **Minimal schema addition**: the Recurring tab and its columns (including season start/end)
  already exist from feature 004. This feature adds exactly **one** new Recurring column (the seed
  key) plus one Settings ledger key, and no engine changes — the recurrence generator ignores the
  new column.
- **Backend-only, no new UI**: this feature ships as a backend seed function plus documentation; the
  seeded rules surface through the recurring-rule management UI already built in feature 012. The
  seed-key column is provenance metadata and need not be surfaced in that UI.
