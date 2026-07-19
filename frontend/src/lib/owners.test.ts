import { describe, expect, it } from 'vitest'
import { ALL_OWNERS, activityActorStyle, ownerStyle } from './owners'

describe('ownerStyle', () => {
  it('maps max to pine-teal token, label, and initial', () => {
    const s = ownerStyle('max')
    expect(s.color).toBe('owner-max')
    expect(s.softColor).toBe('owner-max-soft')
    expect(s.label).toBe('Max')
    expect(s.initial).toBe('M')
  })

  it('maps jaz to berry/plum token, label, and initial', () => {
    const s = ownerStyle('jaz')
    expect(s.color).toBe('owner-jaz')
    expect(s.softColor).toBe('owner-jaz-soft')
    expect(s.label).toBe('Jaz')
    expect(s.initial).toBe('J')
  })

  it('maps both to the accent token with a combined initial', () => {
    const s = ownerStyle('both')
    expect(s.color).toBe('owner-both')
    expect(s.softColor).toBe('owner-both-soft')
    expect(s.label).toBe('Both')
    expect(s.initial).toBe('MJ')
  })

  it('every owner carries a non-color signal (label and initial are never empty)', () => {
    for (const owner of ALL_OWNERS) {
      const s = ownerStyle(owner)
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.initial.length).toBeGreaterThan(0)
    }
  })
})

describe('activityActorStyle (feature 032 US2/US3, audit F-09)', () => {
  it('maps max/jaz to their owner badges', () => {
    expect(activityActorStyle('max')).toMatchObject({ bgClass: 'bg-owner-max', label: 'Max', initial: 'M' })
    expect(activityActorStyle('jaz')).toMatchObject({ bgClass: 'bg-owner-jaz', label: 'Jaz', initial: 'J' })
  })

  it('falls back to a neutral badge for any non-human actor instead of crashing — live data included both "system" and "selftest"', () => {
    expect(activityActorStyle('system')).toMatchObject({ label: 'System' })
    expect(activityActorStyle('selftest')).toMatchObject({ label: 'System' })
    expect(activityActorStyle('some-future-actor')).toMatchObject({ label: 'System' })
  })
})
