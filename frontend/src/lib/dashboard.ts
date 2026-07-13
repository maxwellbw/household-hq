import { Temporal } from 'temporal-polyfill'
import type { Cadence, Event, Owner, RecurringRule, Session, Task } from '@/types/domain'
import { dayKey, formatDate, inRange, nextNDaysRange, todayKey, weekendRange, type DayRange } from '@/lib/datetime'

// ── Smart Views (US1) ────────────────────────────────────────────────────────

export interface SmartViewsResult {
  today: { tasks: Task[]; events: Event[] }
  overdue: { tasks: Task[] }
  weekend: { tasks: Task[]; events: Event[] }
}

/**
 * Buckets tasks and events into Today / Overdue / This weekend.
 * Today and Overdue are disjoint. Weekend may overlap Today when opened on Fri–Sun.
 * Undated tasks and non-open tasks are excluded from all groups.
 */
export function smartViews(tasks: Task[], events: Event[], timezone: string): SmartViewsResult {
  const todayK = todayKey(timezone)
  const weekend = weekendRange(timezone)

  const todayTasks = tasks.filter(
    (t) => t.status === 'open' && !!t.dueDate && dayKey(t.dueDate, timezone) === todayK,
  )

  const todayEvents = events.filter((e) => {
    const startK = dayKey(e.start, timezone)
    const endK = dayKey(e.end, timezone)
    return startK <= todayK && endK >= todayK
  })

  const overdueTasks = tasks.filter(
    (t) => t.status === 'open' && !!t.dueDate && dayKey(t.dueDate, timezone) < todayK,
  )

  const weekendTasks = tasks.filter(
    (t) =>
      t.status === 'open' && !!t.dueDate && inRange(dayKey(t.dueDate, timezone), weekend),
  )

  const weekendEvents = events.filter((e) => {
    const startK = dayKey(e.start, timezone)
    const endK = dayKey(e.end, timezone)
    return startK <= weekend.endKey && endK >= weekend.startKey
  })

  return {
    today: { tasks: todayTasks, events: todayEvents },
    overdue: { tasks: overdueTasks },
    weekend: { tasks: weekendTasks, events: weekendEvents },
  }
}

// ── Load Balance (US2) — stub ─────────────────────────────────────────────────

export interface LoadBalanceResult {
  max: number
  jaz: number
  both: number
}

export function loadBalance(tasks: Task[], range: DayRange): LoadBalanceResult {
  const result: LoadBalanceResult = { max: 0, jaz: 0, both: 0 }
  for (const t of tasks) {
    if (t.status !== 'open') continue
    if (!t.dueDate) continue
    if (!inRange(dayKey(t.dueDate), range)) continue
    result[t.owner]++
  }
  return result
}

// ── Seven-day strip (US7) ────────────────────────────────────────────────────

export interface DayTileSummary {
  dateKey: string
  isToday: boolean
  countsByOwner: Record<Owner, number>
  total: number
}

/** True if event `e` spans day `k` (inclusive of multi-day events) — the single source of
 *  truth for "does this event belong to this day," shared by `sevenDayTiles` (counts) and
 *  `itemsForDay` (the day-peek panel's contents) so they cannot disagree (spec SC-006). */
function eventOnDay(e: Event, k: string, timezone: string): boolean {
  const startK = dayKey(e.start, timezone)
  const endK = dayKey(e.end, timezone)
  return k >= startK && k <= endK
}

/** True if task `t` is due on day `k` and open or snoozed (feature 028 US5: a snoozed
 *  task's `dueDate` holds its wake day, so it shows on the strip/panel that day like any
 *  other open task; `done` stays excluded) — shared by `sevenDayTiles` and `itemsForDay`. */
function taskOnDay(t: Task, k: string, timezone: string): boolean {
  if ((t.status !== 'open' && t.status !== 'snoozed') || !t.dueDate) return false
  return dayKey(t.dueDate, timezone) === k
}

/**
 * Seven day-tiles, today first, for the dashboard's rolling week strip
 * (feature 017 FR-015–018). Counts open dated tasks + spanning events by
 * owner per day; empty days are present with zeroed counts, never omitted.
 */
export function sevenDayTiles(tasks: Task[], events: Event[], timezone: string): DayTileSummary[] {
  const range = nextNDaysRange(7, timezone)
  const todayK = todayKey(timezone)
  const start = Temporal.PlainDate.from(range.startKey)
  const dateKeys = Array.from({ length: 7 }, (_, i) => start.add({ days: i }).toString())

  return dateKeys.map((k) => {
    const countsByOwner: Record<Owner, number> = { max: 0, jaz: 0, both: 0 }

    for (const e of events) {
      if (eventOnDay(e, k, timezone)) countsByOwner[e.owner]++
    }

    for (const t of tasks) {
      if (taskOnDay(t, k, timezone)) countsByOwner[t.owner]++
    }

    return {
      dateKey: k,
      isToday: k === todayK,
      countsByOwner,
      total: countsByOwner.max + countsByOwner.jaz + countsByOwner.both,
    }
  })
}

// ── Day peek panel (US4) ─────────────────────────────────────────────────────

export interface DayItems {
  events: Event[]
  tasks: Task[]
}

/**
 * The events + tasks that belong to `dateKey`, in the same membership rules as
 * `sevenDayTiles`'s counts (`eventOnDay`/`taskOnDay` above) so the strip's counts and the
 * day-peek panel's contents can never disagree (spec SC-006). Events first, then tasks;
 * events sorted by start so an all-day/early item leads.
 */
export function itemsForDay(tasks: Task[], events: Event[], dateKey: string, timezone: string): DayItems {
  return {
    events: events.filter((e) => eventOnDay(e, dateKey, timezone)).sort((a, b) => a.start.localeCompare(b.start)),
    tasks: tasks.filter((t) => taskOnDay(t, dateKey, timezone)),
  }
}

export function resolveViewer(session: Session | null): 'max' | 'jaz' | null {
  if (!session) return null
  if (session.actingPerson) return session.actingPerson
  const id = session.who.identity
  return id === 'max' || id === 'jaz' ? id : null
}

// ── Highlights (US3) ─────────────────────────────────────────────────────────

export interface Highlight {
  type: 'event' | 'rare-chore'
  label: string
  owner: Owner
}

const RARE_CADENCES = new Set<Cadence>(['quarterly', 'annually'])

/**
 * Returns ≤ 3 callouts: upcoming multi-day/weekend events (within ~7 days)
 * and open tasks linked to quarterly/annually rules due within ~14 days.
 * Returns [] when nothing qualifies — no filler.
 */
export function highlights(
  events: Event[],
  recurring: RecurringRule[],
  tasks: Task[],
  timezone: string,
): Highlight[] {
  const todayK = todayKey(timezone)
  const limit7K = Temporal.PlainDate.from(todayK).add({ days: 7 }).toString()
  const limit14K = Temporal.PlainDate.from(todayK).add({ days: 14 }).toString()
  const results: Highlight[] = []

  for (const e of events) {
    if (results.length >= 3) break
    const startK = dayKey(e.start, timezone)
    const endK = dayKey(e.end, timezone)
    if (startK < todayK || startK > limit7K) continue
    const isMultiDay = endK > startK
    const isWeekendStart = Temporal.PlainDate.from(startK).dayOfWeek >= 5
    if (!isMultiDay && !isWeekendStart) continue
    const startDay = formatDate(e.start, timezone, { weekday: 'short' })
    const label = isMultiDay
      ? `${e.title} ${startDay}–${formatDate(e.end, timezone, { weekday: 'short' })}`
      : `${e.title} on ${startDay}`
    results.push({ type: 'event', label, owner: e.owner })
  }

  if (results.length < 3) {
    const ruleById = new Map(recurring.map((r) => [r.id, r]))
    for (const t of tasks) {
      if (results.length >= 3) break
      if (t.status !== 'open' || !t.dueDate || !t.recurringId) continue
      const dueK = dayKey(t.dueDate, timezone)
      if (dueK < todayK || dueK > limit14K) continue
      const rule = ruleById.get(t.recurringId)
      if (!rule || !RARE_CADENCES.has(rule.cadence)) continue
      results.push({
        type: 'rare-chore',
        label: `Rare chore coming up: ${t.title}`,
        owner: t.owner,
      })
    }
  }

  return results
}
