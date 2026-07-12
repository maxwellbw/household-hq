import { describe, expect, it } from 'vitest'
import { groupTasks, parseSnoozeHistory, formatSnoozeHistory, isUncommitted, canAcknowledge } from './tasks'
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

  it('undated tasks come last in the open group', () => {
    const tasks = [
      task({ id: 'undated' }),
      task({ id: 'dated', dueDate: '2026-07-15' }),
      task({ id: 'overdue', dueDate: '2026-07-01' }),
    ]
    const { open } = groupTasks(tasks)
    expect(open[open.length - 1].id).toBe('undated')
    expect(open[0].id).toBe('overdue')
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

  it('multiple undated open tasks are all placed at the end', () => {
    const tasks = [
      task({ id: 'u1' }),
      task({ id: 'dated', dueDate: '2026-07-10' }),
      task({ id: 'u2' }),
    ]
    const { open } = groupTasks(tasks)
    expect(open[0].id).toBe('dated')
    const tail = open.slice(1).map((t) => t.id)
    expect(tail).toContain('u1')
    expect(tail).toContain('u2')
  })

  it('partitions open and done correctly in a mixed list', () => {

    const tasks = [
      task({ id: 'open1', status: 'open', dueDate: '2026-07-15' }),
      task({ id: 'done1', status: 'done', completedAt: '2026-07-09T10:00' }),
      task({ id: 'snoozed1', status: 'snoozed', dueDate: '2026-07-20' }),
    ]
    const { open, done } = groupTasks(tasks)
    expect(open.map((t) => t.id)).toEqual(['open1', 'snoozed1'])
    expect(done.map((t) => t.id)).toEqual(['done1'])
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
