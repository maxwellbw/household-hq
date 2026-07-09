import { describe, expect, it } from 'vitest'
import { buildEventPayload, buildOneTimeTaskPayload, buildRecurringPayload } from './quickAdd'

describe('buildEventPayload', () => {
  it('includes all REQUIRED_ON_CREATE fields for Events (title, start, end, owner)', () => {
    const payload = buildEventPayload({ title: 'Dentist', start: '2026-07-20T14:30', owner: 'jaz' })
    expect(payload).toMatchObject({ title: 'Dentist', start: '2026-07-20T14:30', owner: 'jaz' })
    expect(payload.end).toBeTruthy()
  })

  it('defaults end to start + 1 hour when omitted', () => {
    const payload = buildEventPayload({ title: 'Dentist', start: '2026-07-20T14:30', owner: 'jaz' })
    expect(payload.end).toBe('2026-07-20T15:30')
  })

  it('respects an explicit end when provided', () => {
    const payload = buildEventPayload({
      title: 'Dentist',
      start: '2026-07-20T14:30',
      end: '2026-07-20T16:00',
      owner: 'jaz',
    })
    expect(payload.end).toBe('2026-07-20T16:00')
  })

  it('rolls over the hour at the day boundary', () => {
    const payload = buildEventPayload({ title: 'Late one', start: '2026-07-20T23:30', owner: 'max' })
    expect(payload.end).toBe('2026-07-20T00:30')
  })
})

describe('buildRecurringPayload', () => {
  it('includes all REQUIRED_ON_CREATE fields for Recurring (title, cadence, anchorDate, defaultOwner)', () => {
    const payload = buildRecurringPayload({
      title: 'Mow the lawn',
      cadence: 'weekly',
      anchorDate: '2026-07-20',
      defaultOwner: 'both',
    })
    expect(payload).toEqual({
      title: 'Mow the lawn',
      cadence: 'weekly',
      anchorDate: '2026-07-20',
      defaultOwner: 'both',
    })
  })
})

describe('buildOneTimeTaskPayload', () => {
  const TZ = 'America/Los_Angeles'

  it('includes REQUIRED_ON_CREATE fields for Tasks (title, owner) plus a dueDate', () => {
    const payload = buildOneTimeTaskPayload({ title: 'Buy milk', owner: 'max', dueDate: '2026-07-22' }, TZ)
    expect(payload).toEqual({ title: 'Buy milk', owner: 'max', dueDate: '2026-07-22' })
  })

  it('defaults dueDate to today in the household timezone when omitted', () => {
    const payload = buildOneTimeTaskPayload({ title: 'Buy milk', owner: 'max' }, TZ)
    expect(payload.dueDate).toBeTruthy()
    expect(typeof payload.dueDate).toBe('string')
  })
})
