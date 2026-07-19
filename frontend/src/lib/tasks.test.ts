import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { groupTasks, groupTasksByHorizon, somedaySort, parseSnoozeHistory, formatSnoozeHistory, isUncommitted, canAcknowledge } from './tasks'
import type { Task } from '@/types/domain'

function task(overrides: Partial<Task> & { id: string }): Task {
  return { title: 'Task', owner: 'both', status: 'open', ...overrides }
}

describe('groupTasks', () => {
  it('returns empty groups for an empty array', () => {
    const { open, done } = groupTasks([])
    expect(open).toHaveLength(0)
    expect(done).toHaveLength(0)
  })

  it('all-done input: open is empty, done has all tasks', () => {
    const tasks = [
      task({ id: 'a', status: 'done', completedAt: '2026-07-09T10:00' }),
      task({ id: 'b', status: 'done', completedAt: '2026-07-08T10:00' }),
    ]
    const { open, done } = groupTasks(tasks)
    expect(open).toHaveLength(0)
    expect(done.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('overdue tasks sort before future tasks (ascending dueDate)', () => {
    const tasks = [
      task({ id: 'future', dueDate: '2026-07-20' }),
      task({ id: 'overdue', dueDate: '2026-07-01' }),
    ]
    const { open } = groupTasks(tasks)
    expect(open.map((t) => t.id)).toEqual(['overdue', 'future'])
  })

  it('standalone undated tasks are routed to someday, not open', () => {
    const tasks = [
      task({ id: 'undated' }),
      task({ id: 'dated', dueDate: '2026-07-15' }),
      task({ id: 'overdue', dueDate: '2026-07-01' }),
    ]
    const { open, someday } = groupTasks(tasks)
    expect(open.map((t) => t.id)).toEqual(['overdue', 'dated'])
    expect(someday.map((t) => t.id)).toEqual(['undated'])
  })

  it('an undated task still attached to an event stays in open, sunk to the bottom', () => {
    const tasks = [
      task({ id: 'event-undated', eventId: 'evt-1' }),
      task({ id: 'dated', dueDate: '2026-07-15' }),
      task({ id: 'overdue', dueDate: '2026-07-01' }),
    ]
    const { open, someday } = groupTasks(tasks)
    expect(open.map((t) => t.id)).toEqual(['overdue', 'dated', 'event-undated'])
    expect(someday).toHaveLength(0)
  })

  it('snoozed task stays in the open group (status !== "done")', () => {
    const tasks = [
      task({ id: 'snoozed', status: 'snoozed', dueDate: '2026-07-14' }),
      task({ id: 'open', status: 'open', dueDate: '2026-07-10' }),
    ]
    const { open, done } = groupTasks(tasks)
    expect(open).toHaveLength(2)
    expect(done).toHaveLength(0)
    expect(open[0].id).toBe('open')
    expect(open[1].id).toBe('snoozed')
  })

  it('done group sorts by completedAt descending (newest first)', () => {
    const tasks = [
      task({ id: 'old', status: 'done', completedAt: '2026-07-01T08:00' }),
      task({ id: 'new', status: 'done', completedAt: '2026-07-09T10:00' }),
      task({ id: 'mid', status: 'done', completedAt: '2026-07-05T12:00' }),
    ]
    const { done } = groupTasks(tasks)
    expect(done.map((t) => t.id)).toEqual(['new', 'mid', 'old'])
  })

  it('done tasks without completedAt sort after those with one', () => {
    const tasks = [
      task({ id: 'no-date', status: 'done' }),
      task({ id: 'dated', status: 'done', completedAt: '2026-07-09T10:00' }),
    ]
    const { done } = groupTasks(tasks)
    expect(done[0].id).toBe('dated')
  })

  it('multiple standalone undated tasks all land in someday', () => {
    const tasks = [
      task({ id: 'u1' }),
      task({ id: 'dated', dueDate: '2026-07-10' }),
      task({ id: 'u2' }),
    ]
    const { open, someday } = groupTasks(tasks)
    expect(open.map((t) => t.id)).toEqual(['dated'])
    expect(someday.map((t) => t.id).sort()).toEqual(['u1', 'u2'])
  })

  it('partitions open, done, and someday correctly in a mixed list', () => {
    const tasks = [
      task({ id: 'open1', status: 'open', dueDate: '2026-07-15' }),
      task({ id: 'done1', status: 'done', completedAt: '2026-07-09T10:00' }),
      task({ id: 'snoozed1', status: 'snoozed', dueDate: '2026-07-20' }),
      task({ id: 'someday1', status: 'open' }),
    ]
    const { open, done, someday } = groupTasks(tasks)
    expect(open.map((t) => t.id)).toEqual(['open1', 'snoozed1'])
    expect(done.map((t) => t.id)).toEqual(['done1'])
    expect(someday.map((t) => t.id)).toEqual(['someday1'])
  })

  it('a snoozed standalone task with a future dueDate is not someday (has a date)', () => {
    const tasks = [task({ id: 'snoozed', status: 'snoozed', dueDate: '2026-08-01' })]
    const { open, someday } = groupTasks(tasks)
    expect(open.map((t) => t.id)).toEqual(['snoozed'])
    expect(someday).toHaveLength(0)
  })

  it('someday tasks sort by somedayRank ascending, unranked tasks after ranked ones by title', () => {
    const tasks = [
      task({ id: 'unranked-b', title: 'Zebra' }),
      task({ id: 'rank-2', title: 'Second', somedayRank: '2' }),
      task({ id: 'unranked-a', title: 'Alpha' }),
      task({ id: 'rank-1', title: 'First', somedayRank: '1' }),
    ]
    const { someday } = groupTasks(tasks)
    expect(someday.map((t) => t.id)).toEqual(['rank-1', 'rank-2', 'unranked-a', 'unranked-b'])
  })

  describe('change resilience (feature 021 US3)', () => {
    it('a newly-added blank-rank task appends at the bottom without reordering ranked tasks (FR-017/018)', () => {
      const before = [
        task({ id: 'r1', title: 'First', somedayRank: '1' }),
        task({ id: 'r2', title: 'Second', somedayRank: '2' }),
      ]
      const beforeOrder = groupTasks(before).someday.map((t) => t.id)

      const after = [...before, task({ id: 'new', title: 'Brand new' })]
      const afterOrder = groupTasks(after).someday.map((t) => t.id)

      expect(beforeOrder).toEqual(['r1', 'r2'])
      expect(afterOrder).toEqual(['r1', 'r2', 'new'])
    })

    it('removing a ranked task (scheduled/completed away) leaves the survivors relative order unchanged (FR-019)', () => {
      const full = [
        task({ id: 'r1', title: 'First', somedayRank: '1' }),
        task({ id: 'r2', title: 'Second', somedayRank: '2' }),
        task({ id: 'r3', title: 'Third', somedayRank: '3' }),
      ]
      // 'r2' scheduled away: it now has a dueDate, so it drops out of someday entirely,
      // regardless of its stale somedayRank still being '2' on the row.
      const withR2Scheduled = [
        task({ id: 'r1', title: 'First', somedayRank: '1' }),
        task({ id: 'r2', title: 'Second', somedayRank: '2', dueDate: '2026-08-01' }),
        task({ id: 'r3', title: 'Third', somedayRank: '3' }),
      ]
      expect(groupTasks(full).someday.map((t) => t.id)).toEqual(['r1', 'r2', 'r3'])
      expect(groupTasks(withR2Scheduled).someday.map((t) => t.id)).toEqual(['r1', 'r3'])
    })

    it('a task returning to someday reappears at its preserved somedayRank, not lost or appended (FR-020)', () => {
      // 'r2' comes back (dueDate cleared) with its old somedayRank intact — it should
      // slot back between rank 1 and rank 3, not fall to the unranked bottom.
      const returned = [
        task({ id: 'r1', title: 'First', somedayRank: '1' }),
        task({ id: 'r3', title: 'Third', somedayRank: '3' }),
        task({ id: 'r2', title: 'Second', somedayRank: '2' }),
      ]
      expect(groupTasks(returned).someday.map((t) => t.id)).toEqual(['r1', 'r2', 'r3'])
    })

    it('completing a ranked task drops it from someday without touching the other ranks', () => {
      const tasks = [
        task({ id: 'r1', title: 'First', somedayRank: '1' }),
        task({ id: 'r2', title: 'Second', somedayRank: '2', status: 'done', completedAt: '2026-07-10T09:00' }),
        task({ id: 'r3', title: 'Third', somedayRank: '3' }),
      ]
      const { someday, done } = groupTasks(tasks)
      expect(someday.map((t) => t.id)).toEqual(['r1', 'r3'])
      expect(done.map((t) => t.id)).toEqual(['r2'])
    })
  })
})

describe('somedaySort', () => {
  it('orders ranked tasks numerically ascending', () => {
    const a = task({ id: 'a', somedayRank: '3' })
    const b = task({ id: 'b', somedayRank: '1' })
    expect(somedaySort(a, b)).toBeGreaterThan(0)
    expect(somedaySort(b, a)).toBeLessThan(0)
  })

  it('ranked tasks always sort before unranked tasks', () => {
    const ranked = task({ id: 'r', title: 'Zzz', somedayRank: '1' })
    const unranked = task({ id: 'u', title: 'Aaa' })
    expect(somedaySort(ranked, unranked)).toBeLessThan(0)
  })

  it('unranked tasks fall back to title comparison', () => {
    const a = task({ id: 'a', title: 'Beta' })
    const b = task({ id: 'b', title: 'Alpha' })
    expect(somedaySort(a, b)).toBeGreaterThan(0)
  })

  it('treats a blank somedayRank the same as absent', () => {
    const a = task({ id: 'a', title: 'Beta', somedayRank: '' })
    const b = task({ id: 'b', title: 'Alpha' })
    expect(somedaySort(a, b)).toBeGreaterThan(0)
  })
})

describe('parseSnoozeHistory', () => {
  it('returns empty array for empty/null/undefined input', () => {
    expect(parseSnoozeHistory('')).toEqual([])
    expect(parseSnoozeHistory(null)).toEqual([])
    expect(parseSnoozeHistory(undefined)).toEqual([])
    expect(parseSnoozeHistory('   ')).toEqual([])
  })

  it('parses a single entry correctly', () => {
    const rows = parseSnoozeHistory('2026-07-09→2026-07-14 @ 2026-07-09T08:12')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ fromDue: '2026-07-09', newDue: '2026-07-14', at: '2026-07-09T08:12' })
  })

  it('parses ∅ fromDue as null (task had no dueDate before snooze)', () => {
    const rows = parseSnoozeHistory('∅→2026-07-14 @ 2026-07-09T08:12')
    expect(rows).toHaveLength(1)
    expect(rows[0].fromDue).toBeNull()
  })

  it('parses multiple entries separated by " | "', () => {
    const raw =
      '2026-07-09→2026-07-14 @ 2026-07-09T08:12 | 2026-07-14→2026-07-20 @ 2026-07-14T07:03'
    const rows = parseSnoozeHistory(raw)
    expect(rows).toHaveLength(2)
    expect(rows[0].newDue).toBe('2026-07-14')
    expect(rows[1].newDue).toBe('2026-07-20')
    expect(rows[1].fromDue).toBe('2026-07-14')
  })

  it('skips malformed entries without throwing', () => {
    const raw = 'garbage | 2026-07-09→2026-07-14 @ 2026-07-09T08:12 | also:bad'
    const rows = parseSnoozeHistory(raw)
    expect(rows).toHaveLength(1)
    expect(rows[0].newDue).toBe('2026-07-14')
  })

  it('all-malformed input returns empty array', () => {
    expect(parseSnoozeHistory('no-arrow-here @ time')).toEqual([])
    expect(parseSnoozeHistory('→ @ ')).toEqual([]) // newDue and at are blank
  })
})

describe('formatSnoozeHistory', () => {
  it('round-trips a parsed history back to the original string', () => {
    const raw =
      '2026-07-09→2026-07-14 @ 2026-07-09T08:12 | 2026-07-14→2026-07-20 @ 2026-07-14T07:03'
    expect(formatSnoozeHistory(parseSnoozeHistory(raw))).toBe(raw)
  })

  it('encodes null fromDue as ∅', () => {
    const result = formatSnoozeHistory([{ fromDue: null, newDue: '2026-07-14', at: '2026-07-09T08:12' }])
    expect(result).toBe('∅→2026-07-14 @ 2026-07-09T08:12')
  })

  it('returns empty string for empty array', () => {
    expect(formatSnoozeHistory([])).toBe('')
  })
})

describe('isUncommitted', () => {
  it('true for an open task assigned to a single person with no matching ackBy', () => {
    expect(isUncommitted(task({ id: 't', owner: 'max', status: 'open' }))).toBe(true)
  })

  it('true for a snoozed task assigned to a single person with no matching ackBy', () => {
    expect(isUncommitted(task({ id: 't', owner: 'jaz', status: 'snoozed' }))).toBe(true)
  })

  it('false once ackBy matches the owner', () => {
    expect(isUncommitted(task({ id: 't', owner: 'max', status: 'open', ackBy: 'max' }))).toBe(false)
  })

  it('false for owner "both" regardless of status', () => {
    expect(isUncommitted(task({ id: 't', owner: 'both', status: 'open' }))).toBe(false)
  })

  it('false for a done task even without acknowledgement', () => {
    expect(isUncommitted(task({ id: 't', owner: 'max', status: 'done' }))).toBe(false)
  })

  it('false when ackBy is stale (belongs to the previous, different owner)', () => {
    expect(isUncommitted(task({ id: 't', owner: 'jaz', status: 'open', ackBy: 'max' }))).toBe(true)
  })
})

describe('canAcknowledge', () => {
  it('true when the viewer is the uncommitted task\'s owner', () => {
    expect(canAcknowledge(task({ id: 't', owner: 'max', status: 'open' }), 'max')).toBe(true)
  })

  it('false when the viewer is not the owner (they are the assigner)', () => {
    expect(canAcknowledge(task({ id: 't', owner: 'max', status: 'open' }), 'jaz')).toBe(false)
  })

  it('false when already acknowledged', () => {
    expect(canAcknowledge(task({ id: 't', owner: 'max', status: 'open', ackBy: 'max' }), 'max')).toBe(false)
  })

  it('false for owner "both" even if viewer matches nothing meaningful', () => {
    expect(canAcknowledge(task({ id: 't', owner: 'both', status: 'open' }), 'max')).toBe(false)
  })

  it('false when viewer is undefined', () => {
    expect(canAcknowledge(task({ id: 't', owner: 'max', status: 'open' }), undefined)).toBe(false)
  })
})

describe('groupTasksByHorizon (feature 032 US5, FR-017)', () => {
  const TZ = 'America/Los_Angeles'

  // Friday 2026-07-10 11:00 LA — household week (Sun–Sat) is 07-05..07-11,
  // so nextWeekEnd (thisWeekEnd + 7) is 07-18.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T18:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty groups for an empty input', () => {
    expect(groupTasksByHorizon([], TZ)).toEqual({ thisWeek: [], nextWeek: [], later: [] })
  })

  it('an overdue task (due before today) still lands in This week', () => {
    const t = task({ id: 'overdue', dueDate: '2026-07-01' })
    const { thisWeek, nextWeek, later } = groupTasksByHorizon([t], TZ)
    expect(thisWeek.map((x) => x.id)).toEqual(['overdue'])
    expect(nextWeek).toHaveLength(0)
    expect(later).toHaveLength(0)
  })

  it('a due date exactly at the end of the household week is This week', () => {
    const t = task({ id: 'sat', dueDate: '2026-07-11' })
    expect(groupTasksByHorizon([t], TZ).thisWeek.map((x) => x.id)).toEqual(['sat'])
  })

  it('the day after this week ends is Next week', () => {
    const t = task({ id: 'sun', dueDate: '2026-07-12' })
    expect(groupTasksByHorizon([t], TZ).nextWeek.map((x) => x.id)).toEqual(['sun'])
  })

  it('a due date exactly at the end of next week is still Next week', () => {
    const t = task({ id: 'boundary', dueDate: '2026-07-18' })
    expect(groupTasksByHorizon([t], TZ).nextWeek.map((x) => x.id)).toEqual(['boundary'])
  })

  it('anything past next week is Later', () => {
    const t = task({ id: 'far', dueDate: '2026-08-01' })
    expect(groupTasksByHorizon([t], TZ).later.map((x) => x.id)).toEqual(['far'])
  })

  it('preserves input order (soonest-first) within each horizon', () => {
    const tasks = [
      task({ id: 'a', dueDate: '2026-07-02' }),
      task({ id: 'b', dueDate: '2026-07-09' }),
      task({ id: 'c', dueDate: '2026-07-14' }),
      task({ id: 'd', dueDate: '2026-07-16' }),
    ]
    const { thisWeek, nextWeek } = groupTasksByHorizon(tasks, TZ)
    expect(thisWeek.map((x) => x.id)).toEqual(['a', 'b'])
    expect(nextWeek.map((x) => x.id)).toEqual(['c', 'd'])
  })
})
