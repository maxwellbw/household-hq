import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { needsDecisionDays, upcomingWalks } from './dogwalks'
import type { DogWalk } from '@/types/domain'

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
