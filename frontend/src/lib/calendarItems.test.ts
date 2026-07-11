import { describe, expect, it } from 'vitest'
import { bucketByDay, taskDisplayDateKey } from './calendarItems'
import type { Task } from '@/types/domain'

const TZ = 'America/Los_Angeles'
const TODAY = '2026-07-10'

describe('taskDisplayDateKey', () => {
  it('returns the real dueDate for a non-overdue open task', () => {
    const task: Task = { id: 't1', title: 'X', owner: 'max', status: 'open', dueDate: '2026-07-12' }
    expect(taskDisplayDateKey(task, TZ, TODAY)).toBe('2026-07-12')
  })

  it('remaps an overdue open task to today', () => {
    const task: Task = { id: 't1', title: 'X', owner: 'max', status: 'open', dueDate: '2026-07-05' }
    expect(taskDisplayDateKey(task, TZ, TODAY)).toBe(TODAY)
  })

  it('does not remap a done task even if its dueDate is past', () => {
    const task: Task = { id: 't1', title: 'X', owner: 'max', status: 'done', dueDate: '2026-07-05' }
    expect(taskDisplayDateKey(task, TZ, TODAY)).toBe('2026-07-05')
  })

  it('returns undefined for a task with no dueDate', () => {
    const task: Task = { id: 't1', title: 'X', owner: 'max', status: 'open' }
    expect(taskDisplayDateKey(task, TZ, TODAY)).toBeUndefined()
  })
})

describe('bucketByDay — overdue placement', () => {
  it('places an overdue open task on today only, not on its original past date', () => {
    const task: Task = { id: 't1', title: 'Overdue task', owner: 'max', status: 'open', dueDate: '2026-07-05' }
    const dateKeys = ['2026-07-05', '2026-07-09', TODAY, '2026-07-11']
    const buckets = bucketByDay([], [task], dateKeys, TZ, TODAY)

    const originalBucket = buckets.find((b) => b.dateKey === '2026-07-05')
    const todayBucket = buckets.find((b) => b.dateKey === TODAY)

    expect(originalBucket?.items).toHaveLength(0)
    expect(todayBucket?.items).toHaveLength(1)
    expect(todayBucket?.items[0]).toMatchObject({ id: 't1', overdue: true })
    // The source task object itself is untouched — display-only remap.
    expect(task.dueDate).toBe('2026-07-05')
  })

  it('leaves a non-overdue task on its real date with overdue: false', () => {
    const task: Task = { id: 't2', title: 'Future task', owner: 'jaz', status: 'open', dueDate: '2026-07-11' }
    const buckets = bucketByDay([], [task], [TODAY, '2026-07-11'], TZ, TODAY)
    const bucket = buckets.find((b) => b.dateKey === '2026-07-11')
    expect(bucket?.items[0]).toMatchObject({ id: 't2', overdue: false })
  })
})
