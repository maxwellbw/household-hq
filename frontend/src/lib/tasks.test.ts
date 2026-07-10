import { describe, expect, it } from 'vitest'
import { groupTasks } from './tasks'
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
