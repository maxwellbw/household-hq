# Data Model: Perf & Resilience (030)

This feature introduces **no new stored entity** and changes **no tab, column, or record shape** in the Google Sheet. The only new data structure is a transport-level aggregate used on cold load. Everything below already exists in the Sheet and in the individual `*.list` responses; bootstrap just carries them together.

## Bootstrap payload (transport aggregate)

The `data.bootstrap` action returns one object whose keys are the existing per-dataset collections, each **field-identical** to its standalone `*.list` response:

| Key | Source action (unchanged) | Backing tab | Shape |
|-----|---------------------------|-------------|-------|
| `events` | `events.list` | Events | `Event[]` |
| `tasks` | `tasks.list` | Tasks | `Task[]` (per-actor scoped, identical to `tasks.list` for the same actor) |
| `recurring` | `recurring.list` | Recurring | `RecurringRule[]` |
| `recurringEvents` | `recurringEvents.list` | RecurringEvents | `RecurringEventRule[]` |
| `lists` | `lists.list` | Lists | `List[]` |
| `listItems` | `listItems.list` | ListItems | `ListItem[]` — **all lists' items at once** (already the existing unfiltered behavior) |
| `templates` | `templates.list` | TaskTemplates | `TaskTemplate[]` |
| `settings` | `settings.list` | Settings | `Settings` (map) |
| `dogWalks` | `dogwalks.list` | (computed, DogWalk) | `DogWalk[]` |

**Excluded**: `activity` (from `activity.list`, ActivityLog tab). It remains a lazy per-tab load fired when the More view opens. Rationale: it is the one ever-growing collection and is not shown on any cold-path view (see spec Clarifications + research R1).

### Invariants

- **Shape parity (FR-002)**: for each key, the value equals what the corresponding `*.list` action returns for the same actor at the same instant. Bootstrap changes *how many requests* carry the data, never the data. The backend self-test asserts this by comparing `data.bootstrap` output against the individual actions.
- **Gating parity (FR-003)**: bootstrap runs behind the same `doPost` identity + allowlist gate; `tasks` is scoped to the same actor `tasks.list` would scope to. No key exposes data an individual call would not have.
- **Read-only**: bootstrap writes nothing and appends no ActivityLog row (Principle VI is about state changes; this is a read).
- **Additive**: all individual `*.list` actions remain callable for refetch/invalidate (FR-006).

## Client cache keys (unchanged)

Bootstrap seeds these existing TanStack Query keys via `setQueryData`; no key is added or renamed:

`['events']`, `['tasks']`, `['recurring']`, `['recurringEvents']`, `['lists']`, `['listItems']`, `['templates']`, `['settings']`, `['dogWalks']` — and `['activity']` is **not** seeded (loaded lazily on More).

A new `['bootstrap']` query key exists only as the vehicle for the single fetch; it holds the aggregate transiently and is not consumed directly by views.

## Auth state (extended enum, not stored data)

`useAuth`'s in-memory `AuthStatus` gains one recoverable value:

```
restoring | signed-out | authenticating | signed-in | forbidden | error | restore-error(NEW)
```

`restore-error` is a transient-failure recovery state (session preserved; auto-retry exhausted; awaiting manual "Retry"). It is UI state only — nothing is persisted to the Sheet or to storage as a result of entering it. The persisted session token is **not** cleared when entering `restore-error` (that is the whole point — FR-007).

## No migrations, no seed changes

- No tab added, no header row changed, no column added.
- No `Seed.js`/`Config.js` change.
- Hand-editability of every tab is unchanged.
