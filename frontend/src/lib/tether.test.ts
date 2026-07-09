import { describe, expect, it } from 'vitest'
import { buildCalendarModel } from './tether'
import type { Event, Task } from '@/types/domain'

const event = (id: string, title = 'Event'): Event => ({
  id,
  title,
  start: '2026-07-20T10:00',
  end: '2026-07-20T11:00',
  owner: 'both',
})

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  title: `Task ${id}`,
  owner: 'max',
  status: 'open',
  ...overrides,
})

describe('buildCalendarModel', () => {
  it('groups tasks under their parent event by eventId', () => {
    const events = [event('e1')]
    const tasks = [task('t1', { eventId: 'e1' }), task('t2', { eventId: 'e1' })]
    const model = buildCalendarModel(events, tasks)
    expect(model.events).toHaveLength(1)
    expect(model.events[0].tasks.map((t) => t.id)).toEqual(['t1', 't2'])
    expect(model.standaloneTasks).toHaveLength(0)
  })

  it('sorts an event\'s tasks by dueDate', () => {
    const events = [event('e1')]
    const tasks = [
      task('t1', { eventId: 'e1', dueDate: '2026-07-22' }),
      task('t2', { eventId: 'e1', dueDate: '2026-07-18' }),
    ]
    const model = buildCalendarModel(events, tasks)
    expect(model.events[0].tasks.map((t) => t.id)).toEqual(['t2', 't1'])
  })

  it('computes openTaskCount excluding done/snoozed tasks', () => {
    const events = [event('e1')]
    const tasks = [
      task('t1', { eventId: 'e1', status: 'open' }),
      task('t2', { eventId: 'e1', status: 'done' }),
      task('t3', { eventId: 'e1', status: 'snoozed' }),
    ]
    const model = buildCalendarModel(events, tasks)
    expect(model.events[0].openTaskCount).toBe(1)
  })

  it('places a task with no eventId into standaloneTasks', () => {
    const events = [event('e1')]
    const tasks = [task('t1')]
    const model = buildCalendarModel(events, tasks)
    expect(model.events[0].tasks).toHaveLength(0)
    expect(model.standaloneTasks.map((t) => t.id)).toEqual(['t1'])
  })

  it('degrades a task with a dangling eventId to standalone instead of dropping or crashing it', () => {
    const events = [event('e1')]
    const tasks = [task('t1', { eventId: 'does-not-exist' })]
    const model = buildCalendarModel(events, tasks)
    expect(model.events[0].tasks).toHaveLength(0)
    expect(model.standaloneTasks.map((t) => t.id)).toEqual(['t1'])
  })
})
