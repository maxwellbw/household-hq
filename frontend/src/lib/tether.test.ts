import { describe, expect, it } from 'vitest'
import { buildCalendarModel, somedayTasks } from './tether'
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

describe('somedayTasks', () => {
  const all = new Set<'max' | 'jaz' | 'both'>(['max', 'jaz', 'both'])

  it('returns open undated standalone tasks sorted by title', () => {
    const model = buildCalendarModel([], [
      task('t1', { title: 'Zebra', owner: 'max' }),
      task('t2', { title: 'Apple', owner: 'jaz' }),
    ])
    const result = somedayTasks(model, all)
    expect(result.map((t) => t.title)).toEqual(['Apple', 'Zebra'])
  })

  it('excludes tasks that have a dueDate (dated tasks belong on the calendar)', () => {
    const model = buildCalendarModel([], [
      task('t1', { dueDate: '2026-08-01', owner: 'max' }),
      task('t2', { owner: 'jaz' }),
    ])
    const result = somedayTasks(model, all)
    expect(result.map((t) => t.id)).toEqual(['t2'])
  })

  it('excludes done tasks', () => {
    const model = buildCalendarModel([], [
      task('t1', { status: 'done', owner: 'max' }),
      task('t2', { owner: 'max' }),
    ])
    const result = somedayTasks(model, all)
    expect(result.map((t) => t.id)).toEqual(['t2'])
  })

  it('excludes snoozed tasks (they carry a dueDate, belt-and-suspenders)', () => {
    const model = buildCalendarModel([], [
      task('t1', { status: 'snoozed', dueDate: '2026-09-01', owner: 'max' }),
      task('t2', { owner: 'max' }),
    ])
    const result = somedayTasks(model, all)
    expect(result.map((t) => t.id)).toEqual(['t2'])
  })

  it('excludes event-attached tasks (they are not in standaloneTasks)', () => {
    const model = buildCalendarModel(
      [{ id: 'e1', title: 'Event', start: '2026-07-20T10:00', end: '2026-07-20T11:00', owner: 'both' }],
      [
        task('t1', { eventId: 'e1', owner: 'max' }),
        task('t2', { owner: 'max' }),
      ],
    )
    const result = somedayTasks(model, all)
    expect(result.map((t) => t.id)).toEqual(['t2'])
  })

  it('respects the owner filter', () => {
    const model = buildCalendarModel([], [
      task('t1', { owner: 'max', title: 'Max task' }),
      task('t2', { owner: 'jaz', title: 'Jaz task' }),
      task('t3', { owner: 'both', title: 'Both task' }),
    ])
    const maxOnly = somedayTasks(model, new Set(['max']))
    expect(maxOnly.map((t) => t.id)).toEqual(['t1'])
    const jazOnly = somedayTasks(model, new Set(['jaz']))
    expect(jazOnly.map((t) => t.id)).toEqual(['t2'])
  })

  it('is disjoint from dated standaloneTasks (FR-004)', () => {
    const tasks = [
      task('t1', { dueDate: '2026-08-01', owner: 'max' }),
      task('t2', { owner: 'jaz' }),
    ]
    const model = buildCalendarModel([], tasks)
    const someday = somedayTasks(model, all)
    const dated = model.standaloneTasks.filter((t) => !!t.dueDate)
    const somedayIds = new Set(someday.map((t) => t.id))
    const datedIds = new Set(dated.map((t) => t.id))
    const intersection = [...somedayIds].filter((id) => datedIds.has(id))
    expect(intersection).toHaveLength(0)
  })
})
