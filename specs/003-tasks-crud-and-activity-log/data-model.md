# Data Model: Tasks CRUD and Activity Log (003)

This feature **adds no Sheet columns**. It pins down the behavior of columns 001 already
provisioned and defines two read-side projections (feed entry, task slice) that are query
concepts, not stored data. Column definitions live in
[001 data-model.md](../001-sheets-schema-and-api/data-model.md); this file specifies the
lifecycle and projection semantics 003 layers on top.

## Task (existing tab; no new fields)

Columns (from `Config.HEADERS.Tasks`):
`id, title, dueDate, owner, status, eventId, recurringId, completedBy, completedAt,
snoozeHistory, listItems`.

003-relevant fields:

| Field | Type | 003 semantics |
|-------|------|---------------|
| `title` | text, required | non-empty on create (FR-001). Also captured into ActivityLog `detail` so the feed survives deletion (FR-013). |
| `dueDate` | date (`YYYY-MM-DD`), optional | may be **set, moved, or cleared** via `tasks.update` (FR-005). Past dates are valid (Edge Cases). Empty = undated (valid). |
| `owner` | `max\|jaz\|both`, required | drives slice membership (FR-008). Reassignable among the three via `tasks.update`. |
| `status` | `open\|done\|snoozed` | lifecycle managed by `tasks.complete`/`tasks.reopen` only; **not** settable via `tasks.update` (research D1). New tasks are always `open` (FR-001). `snoozed` is tolerated passively — listed and completable, never set by 003 (FR-007). |
| `completedBy` | `max\|jaz` or `''` | server-managed; the verified completer, stamped on complete, cleared on reopen (FR-002/FR-004). Never honored from the client. |
| `completedAt` | datetime (`YYYY-MM-DDTHH:mm`) or `''` | server-managed; completion instant in the household timezone. Stamped/cleared with `completedBy`. |

### Lifecycle state machine

```
            tasks.create (always → open)
                    │
                    ▼
   ┌──────────────────────────────────┐
   │              open                 │◀────────────┐
   └──────────────────────────────────┘             │
      │  tasks.complete                              │ tasks.reopen
      │  (stamp completedBy+completedAt, log         │ (clear completedBy+completedAt,
      │   action=complete)                           │  log action=reopen)
      ▼                                              │
   ┌──────────────────────────────────┐             │
   │              done                 │─────────────┘
   └──────────────────────────────────┘
      ▲  tasks.complete on done = NO-CHANGE
      │  (return unchanged, no log — FR-003)
      │
   snoozed  (hand-edited / Phase 2 only):
      • listed in its owner's slices with status shown honestly
      • tasks.complete works (snoozed → done), tasks.reopen (snoozed → open, no-op stamp)
      • 003 never *sets* snoozed
```

Invariants (all enforced inside `withLock_`, so atomic under concurrent writes):

- `status === 'done'` ⟺ `completedBy` and `completedAt` are both non-empty.
- `status ∈ {open, snoozed}` ⟹ `completedBy === '' && completedAt === ''` after any 003
  operation (reopen enforces this; create sets it).
- A single `complete` closes a `both`-owned task (no per-person completion — FR-002).
- Any 003 lifecycle transition that *changes* state appends **exactly one** ActivityLog row;
  a no-change appends none (FR-015/SC-006).

## Activity feed entry (read-side projection of an ActivityLog row)

ActivityLog columns (existing): `timestamp, actor, action, targetId, detail`. The feed does
not add columns; it projects each row into:

| Field | Source | Notes |
|-------|--------|-------|
| `timestamp` | row `timestamp` | ISO `YYYY-MM-DDTHH:mm`, household tz. Client formats "· today 2:14pm". |
| `actor` | row `actor` | `max` / `jaz` / `system` (and any hand-edited value, passed through). |
| `action` | row `action` | `create \| update \| complete \| reopen \| delete \| adopt-id \| provision`. `complete`/`reopen` are new in 003 (FR-015). |
| `targetId` | row `targetId` | affected record id (or a tab label for `provision`). May reference a now-deleted row — feed does not dereference it (FR-013). |
| `detail` | row `detail` | free text captured at log time (typically the record title). |
| `summary` | **composed at read time** | `<DisplayName> <verb> '<detail>'`; see research D5 for the name/verb maps. `detail` omitted from the quote if empty. Renders for deleted/hand-edited targets and never throws (FR-011/FR-013). |

Feed ordering & bounding (research D5): newest-first by **append order** (reverse of row
order), filtered by optional `since` (keep `timestamp >= since`), truncated to the most
recent `limit` (default 200, hard max 500). Empty log → `[]`. The projection is **read-only**;
no operation writes through it (FR-014).

## Task slice (identity-relative query concept; not stored)

A named view over `Tasks`, computed in memory from one `listRecords_(TABS.TASKS)` read and
the **verified** caller (FR-009):

| Slice | Predicate | Relative to caller |
|-------|-----------|--------------------|
| `all` (or omitted) | `true` | no |
| `mine` | `owner === P` | yes (`P` = caller) |
| `theirs` | `owner === other(P)` | yes |
| `ours` | `owner === 'both'` | no |
| `default` | `owner === P || owner === 'both'` | yes |

where `P` is the caller's person: `identity.actor` for a personal account, or
`payload.actingPerson` for the shared account (required for identity-relative slices,
`ACTING_PERSON_REQUIRED` if absent — research D4). `other(max) = jaz`, `other(jaz) = max`.

Disjointness/coverage (SC-002): `mine`, `theirs`, `ours` are pairwise-disjoint and
`mine ∪ theirs ∪ ours = all`, because every task's `owner` is exactly one of
`{P, other(P), both}`. `default = mine ∪ ours`. Slices include tasks of **every** status
(owner-only filtering — spec Assumptions).
