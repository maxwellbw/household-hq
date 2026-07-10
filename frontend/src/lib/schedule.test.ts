import { describe, expect, it } from 'vitest'
import { canConfirm, buildSchedulePayload } from './schedule'
import type { ScheduleDraft } from './schedule'

const base: ScheduleDraft = { taskId: 'task-1', date: '', owner: null }

describe('canConfirm', () => {
  it('returns false when date is empty and owner is null', () => {
    expect(canConfirm(base)).toBe(false)
  })

  it('returns false when date is set but owner is null', () => {
    expect(canConfirm({ ...base, date: '2026-08-01' })).toBe(false)
  })

  it('returns false when owner is set but date is empty', () => {
    expect(canConfirm({ ...base, owner: 'max' })).toBe(false)
  })

  it('returns true only when both date and owner are set', () => {
    expect(canConfirm({ ...base, date: '2026-08-01', owner: 'max' })).toBe(true)
    expect(canConfirm({ ...base, date: '2026-08-01', owner: 'jaz' })).toBe(true)
    expect(canConfirm({ ...base, date: '2026-08-01', owner: 'both' })).toBe(true)
  })
})

describe('buildSchedulePayload', () => {
  it('returns id, dueDate, and owner from the draft', () => {
    const draft: ScheduleDraft = { taskId: 'task-abc', date: '2026-09-15', owner: 'jaz' }
    expect(buildSchedulePayload(draft)).toEqual({
      id: 'task-abc',
      dueDate: '2026-09-15',
      owner: 'jaz',
    })
  })
})
