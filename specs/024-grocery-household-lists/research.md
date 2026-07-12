# Research: Grocery & Household Lists

No `NEEDS CLARIFICATION` markers remain in the Technical Context (Phase 0 gate) — the two
prior specify/clarify passes already resolved list scope, section vocabulary, and the
nudge threshold. This file covers implementation-shape decisions made while drafting the
plan, in the spec's own Decision/Rationale/Alternatives format.

## R1: One combined tab vs. two tabs (Lists + ListItems)

**Decision**: Two tabs — `Lists` (`id`, `name`) and `ListItems` (`id`, `listId`, `name`,
`status`, `section`, `staple`, `note`), linked by `listId`, mirroring how `Events` →
`TaskTemplates` and `Recurring` are separate tabs joined by id rather than nested data.

**Rationale**: Matches the existing "Sheets is the DB, tabs as tables" relational
convention (Constitution II) — a hand-editor scanning the Sheet sees a normal two-table
join, not a single tab with a repeated list-name column or JSON-blob items array. It also
lets `lists.list` stay a cheap, tiny read (a handful of rows) independent of how many
items exist.

**Alternatives considered**: A single `Lists` tab with a delimited `items` string
(rejected — reintroduces the encoded-blob problem Constitution II explicitly forbids, and
Tasks' own `listItems` column already carries this exact anti-pattern warning in its
name — this feature deliberately doesn't extend that column, it replaces the concept with
real rows).

## R2: No `owner` field on List/ListItem

**Decision**: Neither tab has an owner (`max`/`jaz`/`both`) column. Every list and item is
implicitly shared — whoever flips it, flips it for both people.

**Rationale**: The spec's own model ("Both users must be able to add/flip immediately, no
role checks") never differentiates by owner — unlike Tasks/Events, there's no per-person
assignment concept for a grocery item. Adding an unused `owner` column would be schema
cruft that invites a values feature never asked for (Constitution I: no generalization
beyond the two known users' actual needs).

**Alternatives considered**: Copying the Events/Tasks owner pattern for consistency
(rejected — nothing in the spec calls for per-person list ownership, and it would need a
default value and would show up as a meaningless required field in the hand-edit view).

## R3: Reuse-and-flip implemented as a lookup inside `createListItem_`, not a separate action

**Decision**: `listItems.create` itself performs the case-insensitive name/list match and
flips-to-need if found, rather than requiring the frontend to call `listItems.list` first
and choose between `create` and `toggle`.

**Rationale**: Keeps the low-friction contract client-side-simple (FR-007/SC-006) — the
add-item UI always calls one action with just a name, exactly matching the "type a name,
submit" interaction in User Story 2. Server-side dedupe also protects against races
between two devices adding the same item concurrently (Edge Cases: last-write-wins is
acceptable, but a true accidental duplicate row is not).

**Alternatives considered**: Client-side dedupe against a locally cached item list
(rejected — a second device's freshly-added item wouldn't be visible without a refresh,
so the frontend cache could easily miss a genuine duplicate; the backend has the
authoritative Sheet state at write time).

## R4: Dedicated `listItems.toggle` action vs. reusing `listItems.update`

**Decision**: A separate `listItems.toggle` handler (payload: `{ id }`, flips
need⇄stocked, idempotent no-op has no effect) rather than letting `status` be a settable
field in `listItems.update`.

**Rationale**: Directly mirrors the existing `tasks.complete`/`tasks.reopen` /
`tasks.snooze` pattern (`Api.js`'s comment: "lifecycle fields are not editable [via
update] ... Use tasks.complete / tasks.reopen") — status changes get their own dedicated,
auditable action with its own ActivityLog verb, while `update` stays for the non-lifecycle
fields (name, section, staple, note). This also makes optimistic-UI flips trivial on the
frontend: one fire-and-forget call with no payload beyond the id.

**Alternatives considered**: Toggle-via-update with `{ id, status: 'need' }` (rejected —
would need the client to know/track the *current* status to compute the flip, adding
state the one-tap interaction shouldn't need to carry; a true toggle endpoint needs no
client-side status bookkeeping at all).

## R5: Staple nudge computed client-side, not backend-aggregated

**Decision**: No new backend read/aggregation endpoint for "staple items needed count."
The frontend's existing Home dashboard already fetches cross-entity data and derives
signals purely in `lib/dashboard.ts` (Smart Views, Load Balance) — the nudge follows the
same shape: fetch `listItems.list` (already needed for the Lists screen and cheap — the
whole tab, not per-list), filter `staple === 'TRUE' && status === 'need'`, compare the
count against the `groceryStapleNudgeThreshold` Settings value already returned by
`settings.list`.

**Rationale**: No new backend logic to test/maintain, and it matches the constitution's
"boring and debuggable" principle — one clear filter+count in the same file as every
other dashboard signal, not a new bespoke aggregation action.

**Alternatives considered**: A dedicated `lists.nudgeStatus` backend action returning just
the boolean/count (rejected — pure derived-data endpoint with no write side effect;
unnecessary indirection when the raw rows are already cheap to fetch and filter client
side).

## R6: Nav change — Lists replaces Feed as the 4th bottom-nav tab

**Decision**: `NAV_ITEMS` swaps the `feed` entry for `lists`; `FeedView` becomes a new
subscreen inside `MoreView` (same pattern as Recurring/Templates/Settings), reachable in
one extra tap from More.

**Rationale**: User-confirmed during planning — Lists is meant for multiple-times-daily
use (spec's own framing: "must be extremely low-friction... daily-use, fast-interaction
feature"), so it needs a fixed nav slot, and the existing 5-slot bottom nav has no room to
grow to 6 without crowding a mobile tab bar. Feed (the household activity log) is checked
less often than a grocery list and tolerates living one tap deeper, under More.

**Alternatives considered**: Adding Lists as a 6th tab (rejected by the user — crowds the
tab bar); nesting Lists under More (rejected — defeats the "one tap" daily-use goal this
feature exists for).
