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

  it('includes notes and location when provided', () => {
    const payload = buildEventPayload({
      title: 'Dinner',
      start: '2026-07-20T18:00',
      owner: 'both',
      notes: 'Reservation: https://example.com/res',
      location: '123 Main St',
    })
    expect(payload.notes).toBe('Reservation: https://example.com/res')
    expect(payload.location).toBe('123 Main St')
  })

  it('omits notes and location when not provided', () => {
    const payload = buildEventPayload({ title: 'Dentist', start: '2026-07-20T14:30', owner: 'jaz' })
    expect('notes' in payload).toBe(false)
    expect('location' in payload).toBe(false)
  })

  it('passes a client-minted id through when provided', () => {
    const payload = buildEventPayload({
      id: 'abc-123',
      title: 'Dentist',
      start: '2026-07-20T14:30',
      owner: 'jaz',
    })
    expect(payload.id).toBe('abc-123')
  })

  it('omits id when not provided', () => {
    const payload = buildEventPayload({ title: 'Dentist', start: '2026-07-20T14:30', owner: 'jaz' })
    expect('id' in payload).toBe(false)
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

  it('omits dueDate (stays undated, lands in Someday) when the input has no date', () => {
    const payload = buildOneTimeTaskPayload({ title: 'Buy milk', owner: 'max' }, TZ)
    expect(payload).toEqual({ title: 'Buy milk', owner: 'max' })
    expect('dueDate' in payload).toBe(false)
  })

  it('passes a provided dueDate through unchanged', () => {
    const payload = buildOneTimeTaskPayload({ title: 'Buy milk', owner: 'max', dueDate: '2026-07-22' }, TZ)
    expect(payload.dueDate).toBe('2026-07-22')
  })

  it('includes notes when provided, omits when not', () => {
    const withNotes = buildOneTimeTaskPayload({ title: 'Buy filter', owner: 'max', notes: 'https://ex.com' }, TZ)
    expect(withNotes.notes).toBe('https://ex.com')
    const withoutNotes = buildOneTimeTaskPayload({ title: 'Buy filter', owner: 'max' }, TZ)
    expect('notes' in withoutNotes).toBe(false)
  })

  it('passes a client-minted id through when provided, omits when not', () => {
    const withId = buildOneTimeTaskPayload({ id: 'abc-123', title: 'Buy milk', owner: 'max' }, TZ)
    expect(withId.id).toBe('abc-123')
    const withoutId = buildOneTimeTaskPayload({ title: 'Buy milk', owner: 'max' }, TZ)
    expect('id' in withoutId).toBe(false)
  })
})
