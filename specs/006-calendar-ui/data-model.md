# Phase 1 Data Model — Calendar UI (006)

Frontend **view model**. The Google Sheet is the source of truth (constitution II); these
are read-only TypeScript shapes the app deserializes from backend responses, plus the
derived structures the UI renders. Field names mirror the backend `HEADERS`
(`backend/Config.js`) so the client maps by name, never position.

## Owner (identity)

```ts
type Owner = 'max' | 'jaz' | 'both';   // backend OWNERS enum
```

Rendered via `lib/owners.ts` → `{ color, softColor, label, initial }` from DESIGN.md tokens:
- `max` → pine teal (`--owner-max` / `--owner-max-soft`), label "Max", initial "M".
- `jaz` → berry/plum (`--owner-jaz` / `--owner-jaz-soft`), label "Jaz", initial "J".
- `both` → terracotta accent (`--owner-both` / `--owner-both-soft`), label "Both", initials "MJ".

**Rule**: color is never the only signal — every owner rendering carries the initial/label (FR-014).

## Event

Source: `events.list` → `{ events: Event[] }`. Backend columns: `id,title,start,end,owner,type,templateId,notes,gcalEventId,prepGeneratedFor`.

```ts
interface Event {
  id: string;
  title: string;
  start: string;        // ISO 8601 datetime (household tz semantics)
  end: string;          // ISO 8601 datetime
  owner: Owner;
  type?: string;        // event type (drives prep templates in 005); free text
  notes?: string;
  // templateId, gcalEventId, prepGeneratedFor: present but unused by this UI
}
```

Display: owner-colored 3px left edge + soft owner tint (DESIGN); title; time (or all-day when
start==end or no time component); prep-count badge when it has tethered tasks (FR-007, FR-011).

## Task

Source: `tasks.list` (household slice) → `{ tasks: Task[] }`. Backend columns:
`id,title,dueDate,owner,status,eventId,recurringId,completedBy,completedAt,snoozeHistory,listItems`.

```ts
type TaskStatus = 'open' | 'done' | 'snoozed';   // backend STATUSES

interface Task {
  id: string;
  title: string;
  dueDate?: string;       // ISO date; may be '' for undated
  owner: Owner;
  status: TaskStatus;
  eventId?: string;       // ← the tether: links to Event.id when this is prep for an event
  recurringId?: string;   // links to a Recurring rule instance (informational)
  completedBy?: Owner;
  completedAt?: string;   // ISO datetime
  // snoozeHistory, listItems: present; listItems may render as sub-checklist later, not required in 006
}
```

Display: checkbox · title · owner chip (color+initial) · relative-due label · (in event context) T−N label.
State transition surfaced by this UI: `open ⇄ done` via `tasks.complete` / `tasks.reopen` (FR-019).
`snoozed` is displayed but not created/changed here (snooze is out of scope for 006).

## Settings (subset)

Source: `settings.list` → `{ settings: { [key]: value } }`. Only `timezone` is consumed
(default `America/Los_Angeles`); all date formatting is pinned to it (R7, FR-017).

## Identity / session

Source: `auth.whoami` → below; produced by GIS sign-in (R3).

```ts
interface WhoAmI {
  identity: 'max' | 'jaz' | 'shared';
  displayName: string;
  email: string;
  needsActingPerson: boolean;   // true only for the shared account
}

interface Session {
  token: string;                // Google ID token (JWT), memory-only
  who: WhoAmI;
  actingPerson?: 'max' | 'jaz'; // chosen when identity==='shared'; sent on writes
}
```

## Derived: EventWithTasks & the tether (`lib/tether.ts`)

Pure grouping over `Event[]` + `Task[]` (R5). Not a backend shape.

```ts
interface EventWithTasks extends Event {
  tasks: Task[];              // tasks where task.eventId === event.id, sorted by dueDate
  openTaskCount: number;      // for the prep-count badge
}

interface CalendarModel {
  events: EventWithTasks[];
  standaloneTasks: Task[];    // tasks with empty/unknown eventId → placed on their own dueDate
}
```

**Rules**:
- A task with an `eventId` matching no known event degrades to `standaloneTasks` (no crash, no dangling tether — FR-013, Edge Cases).
- Owner-filter (independent chips) applies to the union: an event/task is visible iff its `owner` is in the enabled set (FR-015). Filtering an event does not orphan its tasks — tasks inherit visibility from their own owner.

## Quick-add inputs (write, R6)

Client-only form shapes; each maps to a create action's required fields (`REQUIRED_ON_CREATE`).

```ts
interface NewEventInput      { title: string; start: string; end?: string; owner: Owner; type?: string; }
interface NewRecurringInput  { title: string; cadence: Cadence; anchorDate: string; defaultOwner: Owner; }
interface NewOneTimeTaskInput{ title: string; dueDate?: string; owner: Owner; }

type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'; // backend CADENCES
```

Defaults applied client-side so the fast path is minimal (FR-023): event `end` → `start`+1h if omitted;
one-time task `dueDate` → today if omitted; owner defaults to the acting person.

## Enumerations (mirror backend, single source in `types/domain.ts`)

- `Owner`: `max | jaz | both`
- `TaskStatus`: `open | done | snoozed`
- `Cadence`: `weekly | biweekly | monthly | quarterly | annually`
