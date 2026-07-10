import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dayKey, endBeforeStart, formatTime, inRange, isAllDay, monthRange, relativeDue, toZonedDateTime, weekendRange, weekRange } from './datetime'

const TZ = 'America/Los_Angeles'

// Fix "now" to a known instant so relative-due tests are deterministic
// regardless of when the suite runs. 2026-07-10T18:00:00Z is 2026-07-10
// 11:00 in America/Los_Angeles (PDT, UTC-7) — comfortably mid-day, no
// midnight-boundary ambiguity.
const FIXED_NOW = '2026-07-10T18:00:00Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isAllDay', () => {
  it('treats a date-only string as all-day', () => {
    expect(isAllDay('2026-07-10')).toBe(true)
  })
  it('treats start===end as all-day', () => {
    expect(isAllDay('2026-07-10T09:00:00', '2026-07-10T09:00:00')).toBe(true)
  })
  it('treats a timed event as not all-day', () => {
    expect(isAllDay('2026-07-10T09:00:00', '2026-07-10T10:00:00')).toBe(false)
  })
})

describe('dayKey', () => {
  it('buckets a UTC-late-night instant to the correct household-tz day', () => {
    // 2026-07-10T06:30:00Z is 2026-07-09 23:30 in America/Los_Angeles (PDT, UTC-7)
    expect(dayKey('2026-07-10T06:30:00Z', TZ)).toBe('2026-07-09')
  })

  it('takes a naive household-local string at face value (no conversion)', () => {
    expect(dayKey('2026-07-20T14:30', TZ)).toBe('2026-07-20')
  })
})

describe('household-timezone interpretation is independent of device timezone', () => {
  // Backend datetimes are naive wall-clock strings ("no Z, no offset") meant
  // to be read directly as household-local time. new Date(naiveString) would
  // wrongly parse it in the *browser's* zone — these guard against that.
  it('toZonedDateTime reads a naive string as household-local, not device-local', () => {
    const zdt = toZonedDateTime('2026-07-20T14:30', TZ)
    expect(zdt.hour).toBe(14)
    expect(zdt.minute).toBe(30)
    expect(zdt.timeZoneId).toBe(TZ)
  })

  it('formatTime renders the household-local wall-clock time regardless of device tz', () => {
    expect(formatTime('2026-07-20T14:30', TZ)).toBe('2:30 PM')
  })

  it('formatTime reproduces the same wall-clock time under any household timezone setting', () => {
    // A naive string always displays as its own wall-clock time, whichever
    // timezone is configured as "household" — the point is that neither the
    // *device's* zone nor a fixed-instant conversion ever leaks in.
    const pacific = formatTime('2026-07-20T14:30', 'America/Los_Angeles')
    const eastern = formatTime('2026-07-20T14:30', 'America/New_York')
    expect(pacific).toBe('2:30 PM')
    expect(eastern).toBe('2:30 PM')
  })
})

describe('endBeforeStart', () => {
  it('returns true when end date is before start date', () => {
    expect(endBeforeStart('2026-07-10T09:00', '2026-07-09T09:00')).toBe(true)
  })

  it('returns true when end time is before start time on same day', () => {
    expect(endBeforeStart('2026-07-10T09:00', '2026-07-10T08:00')).toBe(true)
  })

  it('returns false when end == start (allowed)', () => {
    expect(endBeforeStart('2026-07-10T09:00', '2026-07-10T09:00')).toBe(false)
  })

  it('returns false when end is after start', () => {
    expect(endBeforeStart('2026-07-10T09:00', '2026-07-11T09:00')).toBe(false)
  })

  it('returns false for date-only end on same day as timed start (multi-day allowed)', () => {
    expect(endBeforeStart('2026-07-10T09:00', '2026-07-10')).toBe(false)
  })

  it('returns true when date-only end is before date-only start', () => {
    expect(endBeforeStart('2026-07-10', '2026-07-09')).toBe(true)
  })

  it('returns false when date-only end equals date-only start', () => {
    expect(endBeforeStart('2026-07-10', '2026-07-10')).toBe(false)
  })

  it('returns false for multi-day range (date-only end after timed start)', () => {
    expect(endBeforeStart('2026-07-10T09:00', '2026-07-12')).toBe(false)
  })
})

// Fixed clock: 2026-07-10 (Friday) in America/Los_Angeles
describe('weekendRange', () => {
  it('starts on today when today is Friday', () => {
    // 2026-07-10 is Friday; current weekend = Fri 10 – Sun 12
    expect(weekendRange('America/Los_Angeles')).toEqual({ startKey: '2026-07-10', endKey: '2026-07-12' })
  })

  it('includes the preceding Friday when today is Saturday', () => {
    vi.setSystemTime(new Date('2026-07-11T18:00:00Z')) // Saturday LA
    expect(weekendRange('America/Los_Angeles')).toEqual({ startKey: '2026-07-10', endKey: '2026-07-12' })
  })

  it('includes the preceding Friday when today is Sunday', () => {
    vi.setSystemTime(new Date('2026-07-12T18:00:00Z')) // Sunday LA
    expect(weekendRange('America/Los_Angeles')).toEqual({ startKey: '2026-07-10', endKey: '2026-07-12' })
  })

  it('points to the next Friday–Sunday when today is Monday', () => {
    vi.setSystemTime(new Date('2026-07-13T18:00:00Z')) // Monday LA
    expect(weekendRange('America/Los_Angeles')).toEqual({ startKey: '2026-07-17', endKey: '2026-07-19' })
  })
})

describe('weekRange', () => {
  it('starts on the most recent Sunday and ends on Saturday (today is Friday)', () => {
    // Today = Fri 2026-07-10; week started Sun 2026-07-05, ends Sat 2026-07-11
    expect(weekRange('America/Los_Angeles')).toEqual({ startKey: '2026-07-05', endKey: '2026-07-11' })
  })

  it('starts today when today is Sunday', () => {
    vi.setSystemTime(new Date('2026-07-12T18:00:00Z')) // Sunday LA
    expect(weekRange('America/Los_Angeles')).toEqual({ startKey: '2026-07-12', endKey: '2026-07-18' })
  })
})

describe('monthRange', () => {
  it('returns first and last day of the current month', () => {
    // Today = 2026-07-10; month = Jul 1–31
    expect(monthRange('America/Los_Angeles')).toEqual({ startKey: '2026-07-01', endKey: '2026-07-31' })
  })

  it('returns correct last day for a month with 30 days', () => {
    vi.setSystemTime(new Date('2026-06-15T18:00:00Z')) // June
    expect(monthRange('America/Los_Angeles')).toEqual({ startKey: '2026-06-01', endKey: '2026-06-30' })
  })
})

describe('inRange', () => {
  const range = { startKey: '2026-07-10', endKey: '2026-07-12' }

  it('returns true for startKey (inclusive)', () => {
    expect(inRange('2026-07-10', range)).toBe(true)
  })

  it('returns true for endKey (inclusive)', () => {
    expect(inRange('2026-07-12', range)).toBe(true)
  })

  it('returns true for a key within the range', () => {
    expect(inRange('2026-07-11', range)).toBe(true)
  })

  it('returns false for a key before startKey', () => {
    expect(inRange('2026-07-09', range)).toBe(false)
  })

  it('returns false for a key after endKey', () => {
    expect(inRange('2026-07-13', range)).toBe(false)
  })
})

describe('relativeDue', () => {
  // "Today" in household tz, under the fixed clock above, is 2026-07-10.
  it('labels today as "Today"', () => {
    expect(relativeDue('2026-07-10', TZ)).toBe('Today')
  })

  it('labels tomorrow as "Tomorrow"', () => {
    expect(relativeDue('2026-07-11', TZ)).toBe('Tomorrow')
  })

  it('labels an overdue date as "N days overdue"', () => {
    expect(relativeDue('2026-07-08', TZ)).toBe('2 days overdue')
  })

  it('labels a future date as "In N days"', () => {
    expect(relativeDue('2026-07-13', TZ)).toBe('In 3 days')
  })

  it('produces a T−N label relative to an event start', () => {
    expect(relativeDue('2026-07-08', TZ, '2026-07-10')).toBe('T−2 days')
  })

  it('returns empty string when there is no due date', () => {
    expect(relativeDue(undefined, TZ)).toBe('')
  })
})
