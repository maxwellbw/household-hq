// The signature interaction: prep tasks render attached to their event
// (data-model.md "Derived: EventWithTasks & the tether"). Pure grouping
// over Event[] + Task[] — no backend change, client-side derivation only.

import type { Event, Task } from '@/types/domain'

export interface EventWithTasks extends Event {
  tasks: Task[]
  openTaskCount: number
}

export interface CalendarModel {
  events: EventWithTasks[]
  standaloneTasks: Task[]
}

/**
 * Group tasks under their parent event by `eventId`. A task whose eventId
 * doesn't match any known event degrades to standalone rather than being
 * dropped or crashing (FR-013 — no dangling tether).
 */
export function buildCalendarModel(events: Event[], tasks: Task[]): CalendarModel {
  const eventIds = new Set(events.map((e) => e.id))
  const tasksByEvent = new Map<string, Task[]>()
  const standaloneTasks: Task[] = []

  for (const task of tasks) {
    if (task.eventId && eventIds.has(task.eventId)) {
      const list = tasksByEvent.get(task.eventId) ?? []
      list.push(task)
      tasksByEvent.set(task.eventId, list)
    } else {
      standaloneTasks.push(task)
    }
  }

  const dueDateSort = (a: Task, b: Task) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')

  const eventsWithTasks: EventWithTasks[] = events.map((event) => {
    const eventTasks = (tasksByEvent.get(event.id) ?? []).slice().sort(dueDateSort)
    return {
      ...event,
      tasks: eventTasks,
      openTaskCount: eventTasks.filter((t) => t.status === 'open').length,
    }
  })

  return { events: eventsWithTasks, standaloneTasks: standaloneTasks.slice().sort(dueDateSort) }
}
