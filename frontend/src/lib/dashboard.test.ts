import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { smartViews } from './dashboard'
import type { Event, Task } from '@/types/domain'

const TZ = 'America/Los_Angeles'
// 2026-07-10T18:00:00Z = 2026-07-10 (Friday) in America/Los_Angeles
const FIXED_NOW = '2026-07-10T18:00:00Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

function task(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: 'Test task',
    owner: 'jaz',
    status: 'open',
    ...overrides,
  }
}

function event(overrides: Partial<Event> & { id: string }): Event {
  return {
    title: 'Test event',
    start: '2026-07-10',
    end: '2026-07-10',
    owner: 'both',
    ...overrides,
  }
}

describe('smartViews — Today grouping', () => {
  it('puts an open task due today under Today', () => {
    const t = task({ id: 't1', dueDate: '2026-07-10' })
    const { today } = smartViews([t], [], TZ)
    expect(today.tasks).toContain(t)
  })

  it('puts an event today under Today', () => {
    const e = event({ id: 'e1', start: '2026-07-10', end: '2026-07-10' })
    const { today } = smartViews([], [e], TZ)
    expect(today.events).toContain(e)
  })

  it('puts a multi-day event spanning today under Today', () => {
    const e = event({ id: 'e2', start: '2026-07-09', end: '2026-07-11' })
    const { today } = smartViews([], [e], TZ)
    expect(today.events).toContain(e)
  })
})

describe('smartViews — Overdue grouping', () => {
  it('puts an open task due yesterday under Overdue', () => {
    const t = task({ id: 't2', dueDate: '2026-07-09' })
    const { overdue } = smartViews([t], [], TZ)
    expect(overdue.tasks).toContain(t)
  })

  it('does not put an overdue task under Today', () => {
    const t = task({ id: 't3', dueDate: '2026-07-08' })
    const { today, overdue } = smartViews([t], [], TZ)
    expect(overdue.tasks).toContain(t)
    expect(today.tasks).not.toContain(t)
  })

  it('Today and Overdue are disjoint across a mixed list', () => {
    const overdueTask = task({ id: 'overdue', dueDate: '2026-07-08' })
    const todayTask = task({ id: 'today-t', dueDate: '2026-07-10' })
    const { today, overdue } = smartViews([overdueTask, todayTask], [], TZ)
    expect(today.tasks.map((t) => t.id)).toEqual(['today-t'])
    expect(overdue.tasks.map((t) => t.id)).toEqual(['overdue'])
  })
})

describe('smartViews — Weekend grouping', () => {
  it('puts an open task due Saturday under Weekend', () => {
    const t = task({ id: 't4', dueDate: '2026-07-11' })  // Saturday
    const { weekend } = smartViews([t], [], TZ)
    expect(weekend.tasks).toContain(t)
  })

  it('puts a task due Sunday under Weekend', () => {
    const t = task({ id: 't5', dueDate: '2026-07-12' })  // Sunday
    const { weekend } = smartViews([t], [], TZ)
    expect(weekend.tasks).toContain(t)
  })

  it('puts a multi-day event spanning the weekend under Weekend', () => {
    const e = event({ id: 'e3', start: '2026-07-10', end: '2026-07-12' })
    const { weekend } = smartViews([], [e], TZ)
    expect(weekend.events).toContain(e)
  })

  it('a multi-day Fri–Sun event appears in both Today and Weekend when today is Friday', () => {
    const e = event({ id: 'e4', start: '2026-07-10', end: '2026-07-12' })
    const { today, weekend } = smartViews([], [e], TZ)
    expect(today.events).toContain(e)
    expect(weekend.events).toContain(e)
  })
})

describe('smartViews — exclusions', () => {
  it('excludes tasks with no dueDate from all groups', () => {
    const t = task({ id: 'no-due' })  // no dueDate
    const { today, overdue, weekend } = smartViews([t], [], TZ)
    expect(today.tasks).toHaveLength(0)
    expect(overdue.tasks).toHaveLength(0)
    expect(weekend.tasks).toHaveLength(0)
  })

  it('excludes done tasks from all groups', () => {
    const t = task({ id: 'done-t', status: 'done', dueDate: '2026-07-10' })
    const { today, overdue, weekend } = smartViews([t], [], TZ)
    expect(today.tasks).toHaveLength(0)
    expect(overdue.tasks).toHaveLength(0)
    expect(weekend.tasks).toHaveLength(0)
  })

  it('excludes snoozed tasks from all groups', () => {
    const t = task({ id: 'snoozed-t', status: 'snoozed', dueDate: '2026-07-10' })
    const { today, overdue } = smartViews([t], [], TZ)
    expect(today.tasks).toHaveLength(0)
    expect(overdue.tasks).toHaveLength(0)
  })

  it('excludes a future task (not this weekend) from Today, Overdue, and Weekend', () => {
    const t = task({ id: 'future', dueDate: '2026-07-20' })  // not today/weekend/overdue
    const { today, overdue, weekend } = smartViews([t], [], TZ)
    expect(today.tasks).toHaveLength(0)
    expect(overdue.tasks).toHaveLength(0)
    expect(weekend.tasks).toHaveLength(0)
  })
})
