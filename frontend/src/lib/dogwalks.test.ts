import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dogWalkNotices, needsDecisionDays, upcomingWalks, walksForDay } from './dogwalks'
import { dismiss, dogWalkNoticeKey } from '@/lib/dogWalkDismissals'
import type { DogWalk } from '@/types/domain'

const TZ = 'America/Los_Angeles'
// 2026-07-10T18:00:00Z = 2026-07-10 (Friday) in America/Los_Angeles
const FIXED_NOW = '2026-07-10T18:00:00Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_NOW))
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

function walk(overrides: Partial<DogWalk> & { id: string; date: string }): DogWalk {
  return {
    slot: 'primary',
    status: 'booked',
    windowStart: `${overrides.date}T11:00:00-07:00`,
    windowEnd: `${overrides.date}T12:00:00-07:00`,
    durationMin: 60,
    reason: null,
    ...overrides,
  }
}

describe('upcomingWalks', () => {
  it('includes booked and suggested walks from today forward, sorted by date then slot', () => {
    const rows = [
      walk({ id: 'a', date: '2026-07-12', status: 'booked' }),
      walk({ id: 'b', date: '2026-07-10', status: 'suggested', slot: 'second' }),
      walk({ id: 'c', date: '2026-07-10', status: 'booked', slot: 'primary' }),
    ]
    const result = upcomingWalks(rows, TZ)
    expect(result.map((w) => w.id)).toEqual(['c', 'b', 'a'])
  })

  it('excludes past days, needs-decision, and deferred rows', () => {
    const rows = [
      walk({ id: 'past', date: '2026-07-09' }),
      walk({ id: 'flagged', date: '2026-07-11', status: 'needs-decision', windowStart: null, windowEnd: null }),
      walk({ id: 'deferred', date: '2026-07-15', status: 'deferred', windowStart: null, windowEnd: null }),
      walk({ id: 'keep', date: '2026-07-11' }),
    ]
    expect(upcomingWalks(rows, TZ).map((w) => w.id)).toEqual(['keep'])
  })
})

describe('needsDecisionDays', () => {
  it('returns only in-range needs-decision rows, earliest first', () => {
    const rows = [
      walk({ id: 'a', date: '2026-07-14', status: 'needs-decision', reason: 'no-good-weather' }),
      walk({ id: 'b', date: '2026-07-10', status: 'needs-decision', reason: 'no-mutual-free' }),
      walk({ id: 'c', date: '2026-07-10', status: 'booked' }),
      walk({ id: 'd', date: '2026-07-09', status: 'needs-decision', reason: 'no-mutual-free' }),
    ]
    expect(needsDecisionDays(rows, TZ).map((w) => w.id)).toEqual(['b', 'a'])
  })

  it('returns an empty array when nothing needs a decision', () => {
    expect(needsDecisionDays([walk({ id: 'a', date: '2026-07-14' })], TZ)).toEqual([])
  })
})

describe('walksForDay', () => {
  it('returns booked/suggested walks matching the day, sorted by slot', () => {
    const rows = [
      walk({ id: 'second', date: '2026-07-12', slot: 'second', status: 'suggested' }),
      walk({ id: 'primary', date: '2026-07-12', slot: 'primary', status: 'booked' }),
      walk({ id: 'other-day', date: '2026-07-13' }),
    ]
    expect(walksForDay(rows, '2026-07-12').map((w) => w.id)).toEqual(['primary', 'second'])
  })

  it('includes needs-decision walks for the day', () => {
    const rows = [walk({ id: 'flagged', date: '2026-07-12', status: 'needs-decision', windowStart: null, windowEnd: null, reason: 'no-good-weather' })]
    expect(walksForDay(rows, '2026-07-12').map((w) => w.id)).toEqual(['flagged'])
  })

  it('excludes deferred walks and walks on other days', () => {
    const rows = [
      walk({ id: 'deferred', date: '2026-07-12', status: 'deferred', windowStart: null, windowEnd: null }),
      walk({ id: 'other-day', date: '2026-07-13' }),
    ]
    expect(walksForDay(rows, '2026-07-12')).toEqual([])
  })

  it('returns an empty array for a day with no walks', () => {
    expect(walksForDay([], '2026-07-12')).toEqual([])
  })
})

describe('dogWalkNotices', () => {
  it('maps needs-decision rows to notice items, earliest first', () => {
    const rows = [
      walk({ id: 'a', date: '2026-07-14', status: 'needs-decision', reason: 'no-good-weather' }),
      walk({ id: 'b', date: '2026-07-10', status: 'needs-decision', reason: 'no-mutual-free' }),
    ]
    const result = dogWalkNotices(rows, TZ)
    expect(result).toEqual([
      {
        key: dogWalkNoticeKey('2026-07-10', 'primary', 'no-mutual-free'),
        date: '2026-07-10',
        slot: 'primary',
        reason: 'no-mutual-free',
        tier: 'urgent',
        dayPhrase: 'today',
      },
      {
        key: dogWalkNoticeKey('2026-07-14', 'primary', 'no-good-weather'),
        date: '2026-07-14',
        slot: 'primary',
        reason: 'no-good-weather',
        tier: 'quiet',
        dayPhrase: 'on Tue',
      },
    ])
  })

  it('excludes a notice whose key is already persisted-dismissed', () => {
    const rows = [walk({ id: 'a', date: '2026-07-14', status: 'needs-decision', reason: 'no-good-weather' })]
    dismiss(dogWalkNoticeKey('2026-07-14', 'primary', 'no-good-weather'))
    expect(dogWalkNotices(rows, TZ)).toEqual([])
  })

  it('re-shows a notice when the underlying reason changes, even if the old key was dismissed', () => {
    dismiss(dogWalkNoticeKey('2026-07-14', 'primary', 'no-good-weather'))
    const rows = [walk({ id: 'a', date: '2026-07-14', status: 'needs-decision', reason: 'forecast-turned-bad' })]
    expect(dogWalkNotices(rows, TZ)).toEqual([
      {
        key: dogWalkNoticeKey('2026-07-14', 'primary', 'forecast-turned-bad'),
        date: '2026-07-14',
        slot: 'primary',
        reason: 'forecast-turned-bad',
        tier: 'quiet',
        dayPhrase: 'on Tue',
      },
    ])
  })

  describe('urgency tiering (feature 033 US6, T027)', () => {
    it('tiers today as urgent with dayPhrase "today"', () => {
      const rows = [walk({ id: 'a', date: '2026-07-10', status: 'needs-decision' })]
      expect(dogWalkNotices(rows, TZ)).toEqual([expect.objectContaining({ tier: 'urgent', dayPhrase: 'today' })])
    })

    it('tiers tomorrow as urgent with dayPhrase "tomorrow"', () => {
      const rows = [walk({ id: 'a', date: '2026-07-11', status: 'needs-decision' })]
      expect(dogWalkNotices(rows, TZ)).toEqual([expect.objectContaining({ tier: 'urgent', dayPhrase: 'tomorrow' })])
    })

    it('tiers 2+ days out as quiet with a formatted weekday dayPhrase', () => {
      const rows = [walk({ id: 'a', date: '2026-07-15', status: 'needs-decision' })]
      expect(dogWalkNotices(rows, TZ)).toEqual([expect.objectContaining({ tier: 'quiet', dayPhrase: 'on Wed' })])
    })
  })
})
