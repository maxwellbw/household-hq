import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadBalance, resolveViewer, smartViews } from './dashboard'
import { monthRange, weekRange } from './datetime'
import type { Event, Session, Task } from '@/types/domain'

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

// 2026-07-10 (Friday) week = Sun 2026-07-05 – Sat 2026-07-11
// month = 2026-07-01 – 2026-07-31

describe('loadBalance — Scenario D', () => {
  it('counts viewer=4, other=5 for the week (max and jaz separately)', () => {
    const tasks = [
      ...Array.from({ length: 4 }, (_, i) => task({ id: `max${i}`, owner: 'max', dueDate: '2026-07-10' })),
      ...Array.from({ length: 5 }, (_, i) => task({ id: `jaz${i}`, owner: 'jaz', dueDate: '2026-07-10' })),
    ]
    const result = loadBalance(tasks, weekRange(TZ))
    expect(result.max).toBe(4)
    expect(result.jaz).toBe(5)
  })

  it('both is its own standalone figure — never folded into max or jaz', () => {
    const tasks = [
      task({ id: 'b1', owner: 'both', dueDate: '2026-07-10' }),
      task({ id: 'b2', owner: 'both', dueDate: '2026-07-10' }),
      task({ id: 'm1', owner: 'max', dueDate: '2026-07-10' }),
    ]
    const result = loadBalance(tasks, weekRange(TZ))
    expect(result.both).toBe(2)
    expect(result.max).toBe(1)
    expect(result.jaz).toBe(0)
  })

  it('excludes completed tasks from the count', () => {
    const tasks = [
      task({ id: 'done', owner: 'max', dueDate: '2026-07-10', status: 'done' }),
      task({ id: 'open', owner: 'max', dueDate: '2026-07-10' }),
    ]
    const result = loadBalance(tasks, weekRange(TZ))
    expect(result.max).toBe(1)
  })

  it('excludes undated tasks', () => {
    const tasks = [task({ id: 'undated', owner: 'jaz' })]  // no dueDate
    const result = loadBalance(tasks, weekRange(TZ))
    expect(result.jaz).toBe(0)
  })

  it('month counts >= week counts for the same data (month is a superset of week)', () => {
    const tasks = [
      task({ id: 'w1', owner: 'max', dueDate: '2026-07-10' }),  // in week and month
      task({ id: 'm1', owner: 'max', dueDate: '2026-07-20' }),  // only in month
    ]
    const weekResult = loadBalance(tasks, weekRange(TZ))
    const monthResult = loadBalance(tasks, monthRange(TZ))
    expect(monthResult.max).toBeGreaterThanOrEqual(weekResult.max)
    expect(monthResult.max).toBe(2)
    expect(weekResult.max).toBe(1)
  })

  it('excludes tasks outside the range entirely', () => {
    const tasks = [
      task({ id: 'past', owner: 'jaz', dueDate: '2026-06-30' }),   // before month
      task({ id: 'future', owner: 'jaz', dueDate: '2026-08-01' }), // after month
    ]
    const result = loadBalance(tasks, monthRange(TZ))
    expect(result.jaz).toBe(0)
  })
})

describe('resolveViewer — shared account has no "you"', () => {
  it('returns null for no session (FR-009)', () => {
    expect(resolveViewer(null)).toBeNull()
  })

  it('returns "max" when signed in as max', () => {
    const session: Session = {
      token: 't',
      who: { identity: 'max', displayName: 'Max', email: 'm@example.com', needsActingPerson: false },
    }
    expect(resolveViewer(session)).toBe('max')
  })

  it('returns "jaz" when signed in as jaz', () => {
    const session: Session = {
      token: 't',
      who: { identity: 'jaz', displayName: 'Jaz', email: 'j@example.com', needsActingPerson: false },
    }
    expect(resolveViewer(session)).toBe('jaz')
  })

  it('returns null for shared account with no acting person — shared is never an owner (FR-009)', () => {
    const session: Session = {
      token: 't',
      who: { identity: 'shared', displayName: 'Household', email: 's@example.com', needsActingPerson: true },
    }
    expect(resolveViewer(session)).toBeNull()
  })

  it('returns actingPerson when shared account has selected who they are acting as', () => {
    const session: Session = {
      token: 't',
      who: { identity: 'shared', displayName: 'Household', email: 's@example.com', needsActingPerson: false },
      actingPerson: 'jaz',
    }
    expect(resolveViewer(session)).toBe('jaz')
  })
})
