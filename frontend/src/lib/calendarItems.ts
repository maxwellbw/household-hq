// Shared day-bucketing for the bespoke week/next-7/day list views (feature 017).
// Reuses the same in-memory model CalendarHome already builds from
// buildCalendarModel — no new fetch, no backend change.

import type { Owner, Task } from '@/types/domain'
import type { EventWithTasks } from '@/lib/tether'
import { dayKey, isOverdue } from '@/lib/datetime'

export interface CalendarItem {
  id: string
  title: string
  owner: Owner
  kind: 'event' | 'task'
  overdue?: boolean
  raw: EventWithTasks | Task
}

export interface DayBucket {
  dateKey: string
  items: CalendarItem[]
}

/**
 * Display-only day for a standalone task (feature 017 FR-012/013): an open
 * task past its real dueDate displays on `todayKeyValue` instead — never
 * persisted, never on both days at once. Non-overdue tasks (and tasks with
 * no dueDate) keep their real date.
 */
export function taskDisplayDateKey(task: Task, timezone: string, todayKeyValue: string): string | undefined {
  if (!task.dueDate) return undefined
  return isOverdue(task, todayKeyValue) ? todayKeyValue : dayKey(task.dueDate, timezone)
}

/**
 * Buckets events + dated standalone tasks into the given `dateKeys`. A
 * multi-day event appears in every day it spans (matches lib/dashboard.ts's
 * smartViews convention). Tasks bucket by their display date, which remaps
 * overdue open tasks onto today (see `taskDisplayDateKey`).
 */
export function bucketByDay(
  events: EventWithTasks[],
  standaloneTasks: Task[],
  dateKeys: string[],
  timezone: string,
  todayKeyValue: string,
): DayBucket[] {
  const buckets = new Map<string, CalendarItem[]>()
  for (const k of dateKeys) buckets.set(k, [])
  const keySet = new Set(dateKeys)

  for (const event of events) {
    const startK = dayKey(event.start, timezone)
    const endK = dayKey(event.end, timezone)
    for (const k of dateKeys) {
      if (k >= startK && k <= endK) {
        buckets.get(k)?.push({ id: event.id, title: event.title, owner: event.owner, kind: 'event', raw: event })
      }
    }
  }

  for (const task of standaloneTasks) {
    const displayKey = taskDisplayDateKey(task, timezone, todayKeyValue)
    if (displayKey && keySet.has(displayKey)) {
      buckets.get(displayKey)?.push({
        id: task.id,
        title: task.title,
        owner: task.owner,
        kind: 'task',
        overdue: isOverdue(task, todayKeyValue),
        raw: task,
      })
    }
  }

  return dateKeys.map((k) => ({ dateKey: k, items: buckets.get(k) ?? [] }))
}
