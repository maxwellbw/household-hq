# Data Model: Weather-Aware Dog-Walk Window Finder (011)

## New Sheet tab: `DogWalks`

The idempotency ledger, the never-double-book guard, the needs-decision surface, and the frontend data source — one row per (date, slot). Hand-editable and hand-deletable like every tab (constitution II). `id` column ⇒ added to `ID_TABS` for UUID handling.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | `Utilities.getUuid()`; row identity (never row position). Also written to the gcal event as `hhqId`. |
| `date` | `YYYY-MM-DD` | The weekday this walk belongs to (household tz). |
| `slot` | enum | `primary` \| `second`. One row per (date, slot); (date, slot) is the natural dedupe key. |
| `status` | enum | `booked` \| `suggested` \| `needs-decision` \| `deferred`. (No `cancelled` — walks are never auto-cancelled.) |
| `windowStart` | ISO 8601 | Start of the chosen/suggested window (with tz offset). Empty for `needs-decision` when nothing was placeable. |
| `windowEnd` | ISO 8601 | End of the window. |
| `durationMin` | int | 60 / 45 / 30. |
| `maxGcalEventId` | string | Id of Max's single-guest invite event on the household account's own calendar (empty for `suggested`/`needs-decision`, or if `maxWorkEmail` unset). Mirrors 007's pointer pattern. |
| `jazGcalEventId` | string | Id of Jaz's single-guest invite event. Empty when not booked or `jazWorkEmail` unset. |
| `reason` | string | For `needs-decision`: `no-mutual-free` \| `no-good-weather` \| `forecast-turned-bad` \| `calendar-unreadable`. Empty otherwise. |
| `notifiedAt` | ISO 8601 | When the last change-push for this row was sent; guards against re-pushing the same needs-decision/move every run. |
| `updatedAt` | ISO 8601 | Last time the engine wrote this row. |

**State transitions** (engine-driven; see research R10):

```
(none) ──in-range, eligible window──▶ booked        (auto-book on; invite sent, silent)
(none) ──in-range, eligible, suggest-only──▶ suggested   (no invite)
(none) ──in-range, no eligible window──▶ needs-decision   (reason set; push once)
booked ──window still eligible──▶ booked            (no-op, no notify)
booked ──window bad, other window exists──▶ booked  (moved: gcal time updated; push "moved")
booked ──window bad, none left──▶ needs-decision    (walk left in place; push once; NEVER cancelled)
any future ──date slides past forecast edge stays deferred; past-start rows are frozen (no edits)
```

**Idempotency**: before creating, the engine looks up the (date, slot) row. If present with live invite event ids (`maxGcalEventId`/`jazGcalEventId`), it reconciles rather than re-creates. All writes wrapped in `withLock_`.

## Google Calendar events (the booking = two single-guest invites)

Created on the household account's **own (primary) calendar** — `CalendarApp.getDefaultCalendar()` — one per person, reusing `CalendarSync` tag helpers. Not on the shared Household calendar and not an Events-tab row, so 007's `syncCalendar()` never touches them (research R1) and the shared calendar shows no duplicates.

- Per person with a configured work email:
  `getDefaultCalendar().createEvent(title, start, end, { guests: <person work email>, sendInvites: true })`
- `title` = Settings `dogWalkTitle` (default `Booked`) — cosmetic only; identical on both.
- Tags (via `tagEntry_`, extended): `hhqKind='dogwalk'`, `hhqId=<DogWalks.id>`, `hhqPerson='max'|'jaz'` — the hidden marker on the **organizer** copy (FR-012/FR-013). Note: tags do **not** propagate to the guest's copy on the work calendar, so own-walk exclusion during re-planning uses the ledger window, not the tag (research R2/R3).
- Move = for each stored id, `getEventById(id).setTime(newStart, newEnd)` (keeps the single guest + tag).
- The app shows **one** walk (the single DogWalks row); the two events are backend-only.

## Settings keys (Config.js `SETTINGS_SEED`)

Reconciled from the existing 011 placeholders + new (research R7). `seedSettings_` adds only missing keys; never overwrites a hand-set value.

| Key | Default | Purpose |
|-----|---------|---------|
| `dogWalkAutoBook` | `TRUE` | On = send invites; off = suggest-only (compute + show, no invite). |
| `householdLat` | `` (existing) | Forecast latitude. |
| `householdLon` | `` (existing) | Forecast longitude. |
| `maxWorkCalId` | `` | Max's work calendar id in the household account — Google-native, or an Outlook/Exchange ICS subscribed via Google Calendar "From URL" (research R4). |
| `jazWorkCalId` | `` | Jaz's work calendar id in the household account (Google-native, or a subscribed ICS like `maxWorkCalId`). |
| `maxWorkEmail` | `` | Guest email invited for Max's work calendar. |
| `jazWorkEmail` | `` | Guest email invited for Jaz's work calendar. |
| `dogWalkIgnoreList` | `Focus time; Block; Hold` | `;`-delimited, case-insensitive titles that count as free. **"Busy" deliberately excluded** — a free/busy-only shared calendar surfaces real meetings titled "Busy" (research R4), so ignoring it would book over them. |
| `dogWalkTitle` | `Booked` | Visible title on the invite. |
| `dogWalkEarliestStart` | `08:00` | Earliest walk start (HH:MM, household tz). |
| `dogWalkLatestStart` | `16:00` | Latest walk start. |
| `dogWalkDurationsMin` | `60,45,30` | Preference order (longest first). |
| `dogWalkMiddayBandStart` | `09:00` | Preferred band start (window-selection R9). |
| `dogWalkMiddayBandEnd` | `12:00` | Preferred band end. |
| `dogWalkSecondTriggerBefore` | `09:00` | If the primary starts before this, attempt a second walk. |
| `dogWalkSecondAfter` | `13:00` | Earliest start for the second (afternoon) walk. |
| `dogWalkSecondDurationMin` | `30` | Fixed duration of the second walk. |
| `dogWalkReliableDays` | `14` | Firm auto-book horizon (days from today). |
| `dogWalkOuterDays` | `21` | Outer sliding horizon ("3 weeks"). |
| `weatherHeatF` | `80` (existing) | Heat ceiling °F (hour fails if above). |
| `weatherColdFloorF` | `20` (was 25) | Cold floor °F (hour fails if below). |
| `weatherPrecipPct` | `50` (was 40) | Precip-probability ceiling % (hour fails at/above). |

**Dropped**: `weatherMorningCutoff` — superseded by per-hour weather gates (research R5).

## ActivityLog verbs (constitution VI)

Actor is `system` (trigger-driven). New action verbs appended to the human-readable map in Config.js:

| Action | Meaning | targetId |
|--------|---------|----------|
| `dogwalk-book` | A walk was booked (invite sent). | DogWalks.id |
| `dogwalk-move` | An existing walk was moved to a new window. | DogWalks.id |
| `dogwalk-suggest` | A window was suggested (suggest-only mode). | DogWalks.id |
| `dogwalk-needs-decision` | A day was flagged for manual decision (with reason). | DogWalks.id |

## Frontend types (mirrors `dogwalks.list` response)

```ts
type DogWalkStatus = 'booked' | 'suggested' | 'needs-decision' | 'deferred';
interface DogWalk {
  id: string;
  date: string;            // YYYY-MM-DD
  slot: 'primary' | 'second';
  status: DogWalkStatus;
  windowStart: string | null; // ISO
  windowEnd: string | null;   // ISO
  durationMin: number | null;
  reason: string | null;   // for needs-decision
}
```

Selectors (`lib/dogwalks.ts`): `upcomingWalks(rows)` (booked/suggested, today-forward, sorted) and `needsDecisionDays(rows)` (for the dashboard notice).
