# Phase 0 Research: Someday Force-Rank

## R1 — Comparison algorithm: binary insertion sort

**Decision**: Order the someday list with **binary insertion sort** driven by a human comparator ("this or that?"). Maintain a growing `sorted` array; take the next `unsorted` item and binary-search its position by comparing it against the current midpoint of the active `[lo, hi)` window, narrowing on each answer until `lo === hi`, then splice it in.

**Rationale**:
- Comparison count is **O(n·log n)** — each insertion costs ⌈log₂ k⌉ comparisons for the k-th item, total ≈ Σ log₂ k, well under the n·(n−1)/2 every-pair bound (satisfies FR-009 / SC-002; ~10 tasks resolve in under ~25 comparisons).
- It is **trivially resumable**: the entire session state is `{ sorted: string[], unsorted: string[], lo: number, hi: number, pivotId: string }`. One answer advances exactly one of these fields. No comparison history or recursion stack to reconstruct (unlike merge sort's interleaved merges), so `localStorage` round-tripping is a plain JSON dump.
- It is **boring and unit-testable** (Constitution IV): the engine is a pure reducer `(state, answer) → nextState` plus a `nextPair(state)` selector, tested with a synthetic comparator.

**Alternatives considered**:
- **Merge sort (pairwise)**: same asymptotic comparison count, but resuming mid-merge means serializing a tree of partially-merged runs and cursors — materially more state and more edge cases for the same n·log n. Rejected for complexity with no benefit at household scale.
- **Full round-robin / every-pair (Condorcet)**: O(n²) comparisons, tolerates contradictions, but explodes the number of "this or that?" questions and violates SC-002. Rejected.
- **Elo / rating from sampled pairs**: probabilistic, never yields a definite total order in bounded questions, and is decidedly not "boring." Rejected.

**Ties / indifference** (Assumptions): each pair yields exactly one winner; there is no "equal" answer. Binary search treats the chosen side as strictly greater — a consistent (if arbitrary) placement for indifferent pairs, corrected only by a full re-rank (FR-015). No per-comparison undo in v1.

**List drift mid-session** (Edge Cases): the session is seeded from the someday-task IDs at start. On each `nextPair`, IDs that no longer qualify (scheduled/completed/deleted by the other user) are skipped/dropped; the final write covers only still-qualifying tasks. The engine never dereferences a task by row position — always by ID against the live task list.

## R2 — Ranking storage: `somedayRank` column on Tasks

**Decision** (clarified): persist the shared order as a per-task **`somedayRank`** column on the **Tasks** tab — a small integer as a plain string; **blank = unranked**. Ranked tasks sort ascending by `somedayRank`; unranked tasks render below, ordered by title (existing behaviour).

**Rationale**:
- Maximally **hand-editable** (Constitution II): the rank sits on the same row as the task title, so either user can renumber in the raw Sheet without cross-referencing UUIDs.
- **Reconciles for free**: the Tasks tab is already read whole per request; no join, no second source that can drift. Scheduling/completing a task just stops it from qualifying for Someday — its stale `somedayRank` is simply ignored while it has a due date, and honoured again if it returns to Someday (FR-020).
- Adding a task = blank rank = appears at the bottom automatically (FR-017/FR-018) with **zero writes** to other rows.

**Rank values**: `tasks.rank` writes **dense 1-based integers** (`1, 2, 3, …`) over exactly the submitted ordered IDs, and **clears** (`''`) any Task that has a `somedayRank` but is not in the submitted set (so a task scheduled away then re-ranked doesn't keep a phantom number). Dense contiguous integers keep the Sheet readable; the frontend never depends on gaps.

**Alternatives considered**:
- **Single ordered ID list in a Settings cell** — one comma-joined list of UUIDs; not human-readable, awkward to hand-edit against titles, and a second place that can drift from Tasks. Rejected.
- **Dedicated `SomedayRank` tab** — a whole tab and duplicated task identity for one ordering. Rejected as over-structured for two users.
- **Fractional/sparse ranks** (LexoRank-style) to allow single-item inserts without renumbering — unnecessary: v1 re-ranks wholesale and appends new items unranked; dense integers stay legible. Deferred unless a future "insert one item" mode needs it.

## R3 — Write path: batched `tasks.rank`, not N× `tasks.update`

**Decision**: add one backend endpoint **`tasks.rank`** taking `{ order: string[] }` (task IDs, best-to-worst). It reads the Tasks tab once, sets `somedayRank` for the listed IDs to their 1-based positions, clears `somedayRank` on any other ranked task, writes back in **one batch**, appends a **single** ActivityLog entry (`rank-someday`), all under `LockService`. Idempotent: re-submitting the same order is a no-op-equivalent (same result). Frontend adds `useRankTasks()` mirroring the existing mutation pattern (invalidate `['tasks']` on success).

**Rationale**: N separate `tasks.update` calls would mean N locks, N log rows, N calendar-mirror passes (irrelevant for undated tasks anyway), and a partial-failure window that could leave a half-applied order — violating FR-016 ("no partial/corrupt order presented as saved"). One atomic batch write matches the "read whole tab, mutate in memory, write once" convention and makes the whole re-rank succeed-or-fail as a unit.

**`somedayRank` via `tasks.update`?** Because `mutablePatch_` iterates `HEADERS[TABS.TASKS]`, once the column exists a stray `somedayRank` in a `tasks.update` payload would be writable. That's acceptable (it stays a plain editable field) but the app's canonical writer is `tasks.rank`; `tasks.update` callers simply never send it. No need to add it to the rejected-lifecycle-fields list.

## R4 — Session resume scope: same-device `localStorage`

**Decision** (clarified): the in-progress force-rank session is stored in `localStorage` under a stable key. Starting a session seeds it; each answer updates it; completing or cancelling clears it. On mount, if a stored session exists **and its task set still matches** the current someday tasks closely enough, offer to resume; otherwise start fresh.

**Rationale**: satisfies FR-013 (same-device resume, no lost answers) with the least machinery — no backend session table, no cross-user coordination, nothing that can drift from the Sheet (Constitution IV). Cross-device / other-user resume was explicitly ruled out of scope in clarify.

**Staleness guard**: store the set of task IDs the session was built from. If, on resume, tasks have appeared/disappeared, the engine drops missing IDs and appends genuinely-new IDs to `unsorted` (so they still get placed) rather than discarding progress — keeping already-answered comparisons intact.

## R5 — Someday section placement & collapsible mechanics

**Decision**: render the Someday section at the **bottom** of `TasksView`, after Open and Done, as a collapsible block mirroring the existing Open/Done disclosure buttons (chevron + `aria-expanded`, min-44px target), **expanded by default** (clarified). `groupTasks` stops routing undated tasks into `open`; a new `someday` slice returns standalone undated open tasks sorted by `somedayRank` then title. `SomedayList` (home dashboard) reuses the same sort so both surfaces agree.

**Rationale**: reuses the exact collapsible pattern already in `TasksView` (feature 012/022) — no new component vocabulary. Keeping the sort in `lib/tasks.ts`/`tether.ts` as pure functions makes the shared order testable and identical across the Tasks tab and the dashboard (SC-003). Event-attached undated tasks remain excluded via the existing `standaloneTasks` split (FR-003).

**Interaction with feature 022** (collapsible Open/Done): 021 introduces the Someday section as collapsible from day one using the same idiom; if 022 later factors out a shared `<CollapsibleSection>`, the Someday section adopts it — no conflict, since both use identical chevron/aria semantics.
