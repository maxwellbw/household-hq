# Feature Specification: Dog-care recurring seed rows

**Feature Branch**: `023-dog-care-seed-rows`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "Dog-care recurring seed rows. Add a standard set of dog-care recurring chores to the recurring-chore seed pack, extending feature 015's Seed.js mechanism (idempotent, seedKey-identified, hand-editable and hand-deletable without resurrection). The standard set, all owned by `both`: flea/tick meds monthly, heartworm meds monthly, nail trim about every 6 weeks, grooming about every 8 weeks. Household members hand-edit dates/cadence/owner after seeding. Annual vet visit + vaccines are out of scope for now (they wait for feature 025's yearly-recurrence work, or get seeded as a yearly rule if that engine work lands first). Backend-only; no frontend, no new API action. Seeded rows appear in the existing More → Recurring management screen and generate task occurrences through the existing recurring engine."

## Clarifications

### Session 2026-07-12

- Q: Nail trim (~6 wk) and grooming (~8 wk) have no matching cadence in the engine
  (weekly/biweekly/monthly/quarterly/annually), and nothing sits between monthly and
  quarterly. How should these two be represented? → A: Add two new fixed cadences —
  "every 6 weeks" (+42 days) and "every 8 weeks" (+56 days) — to the recurring engine
  **and** the frontend cadence enum/dropdown, so seeded rows match the real rhythm and
  stay hand-selectable. This makes the feature touch the frontend cadence list (a small,
  bounded exception to the original "backend-only" framing); it remains no-new-API-action
  and no new screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seed a standard dog-care routine in one step (Priority: P1)

Max or Jaz runs the one-time seeding step and the household's standard dog-care chores
appear as ordinary recurring rules — flea/tick meds, heartworm meds, nail trim, and
grooming — each owned by `both` and generating task occurrences on the calendar going
forward, with no manual data entry.

**Why this priority**: This is the entire feature. Without it there is nothing to
seed. It delivers the core value: a couple who just adopted (or wants to formalize) a
dog-care routine gets a sensible starter set instantly instead of hand-building four
recurring rules.

**Independent Test**: Run the seeding step against a database that has never seen the
dog-care chores; confirm four new Recurring rows appear (flea/tick, heartworm, nail
trim, grooming), all owned by `both`, each with a valid future anchor date and a
cadence the recurring engine understands, and that the next engine run generates their
first task occurrences.

**Acceptance Scenarios**:

1. **Given** a database with none of the dog-care chores present, **When** the seeding
   step runs, **Then** exactly the four dog-care rules are appended, each owned by
   `both`, and each is visible in the More → Recurring management screen.
2. **Given** the dog-care chores were just seeded, **When** the recurring engine next
   runs, **Then** each seeded rule generates task occurrences on its cadence exactly as
   a hand-created rule would.

---

### User Story 2 - Re-running seeding is safe (idempotent) (Priority: P1)

Because seeding shares feature 015's mechanism, running it a second time (or any number
of times) never creates duplicate dog-care rules and never resurrects a rule the
household deliberately deleted.

**Why this priority**: Idempotency is a hard project principle (Constitution V) and the
whole reason 015 built the seed-key + ledger machinery. A seed step that could
double-seed or resurrect deleted chores would be worse than none.

**Independent Test**: Seed once; seed again; confirm no duplicate dog-care rows and no
new writes on the second run. Then delete one seeded rule by hand and seed again;
confirm the deleted rule stays gone.

**Acceptance Scenarios**:

1. **Given** the dog-care chores were already seeded, **When** the seeding step runs
   again, **Then** no duplicate rows are created and no change is logged.
2. **Given** a household member deleted the seeded "Grooming" rule, **When** the seeding
   step runs again, **Then** "Grooming" is **not** re-created.
3. **Given** a household member renamed the seeded "Nail trim" rule or changed its
   cadence/owner/date, **When** the seeding step runs again, **Then** their edited row is
   left untouched and not duplicated.

---

### User Story 3 - Hand-tune after seeding (Priority: P2)

After seeding, Max and Jaz adjust the starter rules to their actual vet/groomer
schedule — changing the next date, the cadence, or the owner — using the existing
Recurring management screen, and their edits persist across future seed re-runs.

**Why this priority**: The seeded values are sensible defaults, not prescriptions; the
real dates depend on when meds were last given and when the next groomer appointment
is. This is covered by the existing Recurring editor plus Story 2's edit-preservation,
so it needs no new UI — it is called out to bound scope (we ship defaults, the household
personalizes).

**Independent Test**: Seed, then edit a seeded rule's date and owner through the
existing Recurring screen; confirm the change persists and survives a subsequent seed
re-run.

**Acceptance Scenarios**:

1. **Given** a freshly seeded "Flea/tick meds" rule, **When** a household member changes
   its next date and owner in the Recurring screen, **Then** the change persists and a
   later seed re-run does not revert it.

---

### Edge Cases

- **Partial prior seeding**: some dog-care chores already exist (from an earlier partial
  run) and others do not → only the missing ones are added; existing ones are skipped.
- **A single chore fails to create** (e.g., transient write error) → the remaining
  dog-care chores are still seeded; the failure is logged and the run does not abort.
- **Season restriction**: dog-care chores run year-round, so none carry a seasonal window
  (unlike 015's "Mow lawn").
- **New cadence values reach an un-updated client**: an older frontend build that does
  not yet know the "every 6 weeks" / "every 8 weeks" cadences must not crash on a seeded
  rule carrying one (fall back to showing the raw cadence value rather than erroring).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The seed pack MUST include a standard dog-care set: flea/tick meds,
  heartworm meds, nail trim, and grooming. Annual vet visit + vaccines are explicitly
  **out of scope** for this feature.
- **FR-002**: Every seeded dog-care rule MUST be owned by `both` and MUST run year-round
  (no seasonal window).
- **FR-003**: Each seeded rule MUST carry a cadence the recurring engine can materialize
  and a valid future first date. Flea/tick meds and heartworm meds MUST be monthly. Nail
  trim MUST recur every 6 weeks and grooming every 8 weeks, using two new fixed cadences
  ("every 6 weeks" = +42 days, "every 8 weeks" = +56 days) added to the recurring engine.
- **FR-003a**: The two new cadences MUST also be added to the frontend cadence list
  (type, management-screen dropdown + labels, and any cadence-aware dashboard logic) so
  seeded rows display correctly and remain hand-selectable when the household edits a
  rule. No other frontend behavior changes; no new screen is added.
- **FR-004**: Seeding MUST be idempotent: re-running it MUST NOT create duplicate
  dog-care rules and MUST NOT resurrect a dog-care rule that was hand-deleted after a
  prior seeding (reusing 015's seed-key + applied-ledger mechanism).
- **FR-005**: Household edits to a seeded rule (rename, date, cadence, owner change) MUST
  be preserved across seed re-runs; identity MUST NOT depend on the rule's title.
- **FR-006**: Seeding MUST NOT abort if one dog-care chore fails to be created; it MUST
  log the failure and continue with the remaining chores.
- **FR-007**: Seeding MUST record its state changes consistently with the rest of the
  system (each newly created rule appends its own creation entry to the activity log; a
  no-op re-run writes nothing and logs nothing).
- **FR-008**: This feature MUST add no new API action and no new frontend screen. The
  only frontend change permitted is extending the cadence list (FR-003a). Seeded rules
  surface through the existing More → Recurring management screen and generate occurrences
  through the existing recurring engine.

### Key Entities *(include if feature involves data)*

- **Dog-care seed chore**: a starter recurring-rule definition — a stable seed key, a
  display title, a cadence, a first-date rule, and a default owner (`both`) — added to
  the existing seed pack alongside the household chores from feature 015.
- **Recurring rule**: the existing entity a seeded chore becomes once applied; carries
  the seed key so it is recognized as "already seeded" and never duplicated.
- **Applied-seed ledger**: the existing durable record (from 015) of which seed keys
  have ever been applied; makes a hand-deletion permanent across re-runs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From an unseeded database, a single seeding run produces the four dog-care
  rules (flea/tick, heartworm, nail trim, grooming), all owned by `both`, with zero
  manual data entry.
- **SC-002**: Running the seeding step any number of additional times results in zero
  duplicate dog-care rules and zero resurrected deletions.
- **SC-003**: 100% of seeded dog-care rules generate their task occurrences through the
  existing recurring engine with no rule-specific handling.
- **SC-004**: A household member can change a seeded rule's date, cadence, and owner
  through the existing Recurring screen, and those edits survive every subsequent seed
  re-run.

## Assumptions

- The dog-care chores extend the **same** seed pack and seeding mechanism built in
  feature 015 (`seedRecurringPack` + the `recurringSeedApplied` ledger); no new seeding
  machinery is introduced.
- Seeding remains a manual, re-runnable step run from the backend editor (like
  `setupDatabase`), not an API action and not a trigger handler.
- The recurring engine, the Recurring Sheet tab, and the More → Recurring management
  screen from features 004/012/015 already exist and are reused, extended only by the two
  new cadence values (FR-003/FR-003a). The Recurring Sheet stays hand-editable; the new
  cadences are ordinary values in the existing `cadence` column.
- Owner `both` and the household timezone/date conventions from the constitution apply as
  everywhere else.
- Default first dates are sensible starting points anchored relative to the seeding date;
  the household will hand-tune them to their real vet/groomer schedule (User Story 3).
