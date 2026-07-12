# Phase 1 Data Model: Someday Force-Rank

No new entities. One new column on an existing tab, plus render-order and session-state rules.

## Tasks tab — new column `somedayRank`

Appended to `HEADERS.Tasks` (last column, so hand-added rows and existing data are unaffected):

```
Tasks: [ id, title, dueDate, owner, status, eventId, recurringId,
         completedBy, completedAt, snoozeHistory, listItems, gcalEventId,
         notes, ackBy, ackAt, somedayRank ]
```

| Field | Type | Rules |
|-------|------|-------|
| `somedayRank` | integer as string; **blank allowed** | Blank = **unranked**. When set, a dense 1-based position (`1` = highest priority). Only meaningful for a task that currently qualifies for Someday (standalone, open, no dueDate); otherwise ignored but preserved. |

**Validation** (optional, `Validation.js`): if a non-blank `somedayRank` is present it MUST be a positive integer. Blank always valid. Non-qualifying tasks may carry a stale value — not an error (it's simply inert until the task returns to Someday).

**Frontend type** (`types/domain.ts`): add `somedayRank?: string` to `Task` (mirrors the Sheet string; matches how other numeric-ish Sheet fields are typed as strings).

## "Someday task" (unchanged definition, feature 013)

A `Task` where: `eventId` is empty **and** `status === 'open'` **and** `dueDate` is empty. `somedayRank` does not change what qualifies — it only orders the qualifiers.

## Shared ranking — render order

A total order over the current someday tasks, derived deterministically at render time:

1. **Ranked first**: tasks with non-blank `somedayRank`, ascending by numeric `somedayRank`.
2. **Unranked below**: tasks with blank `somedayRank`, ascending by `title` (existing `localeCompare` behaviour).

This ordering is a pure function of the loaded task list — computed identically on the Tasks tab (`groupTasks`) and the home dashboard (`tether.somedayTasks`), guaranteeing both users and both surfaces see one order (FR-010/FR-012, SC-003).

**Transitions that touch ranking**:
- **Schedule** (gains dueDate) or **complete** → task stops qualifying; its `somedayRank` is left as-is on the row but no longer rendered in Someday. Remaining ranked tasks keep their relative order (their integers are unchanged) (FR-019).
- **Return to Someday** (dueDate cleared, reopened) → task qualifies again and re-appears at its preserved `somedayRank`, or at the bottom if blank (FR-020).
- **New undated task** → blank `somedayRank` → appears at the bottom of the unranked group with no writes to other rows (FR-017/FR-018).
- **Re-rank** (`tasks.rank`) → dense 1-based integers assigned over the submitted order; any previously-ranked task not in the submission has its `somedayRank` cleared (FR-021 — no phantom ranks).

## Force-rank session state (transient, `localStorage` — NOT in the Sheet)

Stored under a single stable key (e.g. `hh:someday-forcerank`); cleared on completion or cancel:

```ts
interface ForceRankSession {
  seededIds: string[]   // someday task IDs the session started from (staleness guard)
  sorted: string[]      // IDs placed so far, best → worst
  unsorted: string[]    // IDs still to place
  lo: number            // active binary-search window lower bound (into `sorted`)
  hi: number            // active binary-search window upper bound
  pivotId: string       // the unsorted item currently being placed
}
```

**Engine contract** (`lib/forceRank.ts`, pure):
- `startSession(ids: string[]): ForceRankSession` — seed `sorted = [first]`, `unsorted = rest`, begin placing the next item.
- `nextPair(session): { a: string; b: string } | null` — returns the two IDs to show ("this or that?"), or `null` when the session is complete (`unsorted` empty and no active placement). `a` = pivot being placed, `b` = current window midpoint of `sorted`.
- `applyAnswer(session, winnerId): ForceRankSession` — narrows `[lo, hi)` (winner decides which half); when `lo === hi`, splices `pivotId` into `sorted` at that index and begins the next `unsorted` item.
- `finalOrder(session): string[] | null` — the completed `sorted` order, or `null` if not finished.
- `reconcile(session, liveSomedayIds): ForceRankSession` — drop IDs absent from `liveSomedayIds` (from `sorted`/`unsorted`/pivot, re-opening the window if the pivot vanished) and append genuinely-new IDs to `unsorted`; used on resume and when the list drifts mid-session.

All engine functions are deterministic and side-effect-free; `localStorage` read/write lives in the `useForceRankSession` hook, not the engine (keeps the algorithm unit-testable).

## Activity log

`tasks.rank` appends **one** entry per persisted re-rank: `action: 'rank-someday'`, `actor` = verified caller, `targetId` = (household-level; may be empty or a sentinel), `detail` = count of tasks ranked. Consistent with FR-022 — a completed re-rank is auditable without one row per task.
