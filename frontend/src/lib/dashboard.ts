import type { Event, RecurringRule, Session, Task } from '@/types/domain'
import { dayKey, inRange, todayKey, weekendRange, type DayRange } from '@/lib/datetime'

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function loadBalance(_tasks: Task[], _range: DayRange): LoadBalanceResult {
  return { max: 0, jaz: 0, both: 0 }
}

export function resolveViewer(session: Session | null): 'max' | 'jaz' | null {
  if (!session) return null
  if (session.actingPerson) return session.actingPerson
  const id = session.who.identity
  return id === 'max' || id === 'jaz' ? id : null
}

// ── Highlights (US3) — stub ───────────────────────────────────────────────────

export interface Highlight {
  type: 'event' | 'rare-chore'
  label: string
}

export function highlights(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _events: Event[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _recurring: RecurringRule[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tasks: Task[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _timezone: string,
): Highlight[] {
  return []
}
