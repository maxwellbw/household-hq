import { beforeEach, describe, expect, it } from 'vitest'
import { ackNoticeKey, dismiss, isDismissed } from './ackDismissals'

beforeEach(() => {
  localStorage.clear()
})

describe('ackNoticeKey', () => {
  it('combines taskId and ackAt', () => {
    expect(ackNoticeKey('t1', '2026-07-11T09:00')).toBe('t1:2026-07-11T09:00')
  })
})

describe('isDismissed / dismiss', () => {
  it('a key is not dismissed until dismissed', () => {
    expect(isDismissed('t1:2026-07-11T09:00')).toBe(false)
  })

  it('dismiss persists across reads', () => {
    dismiss('t1:2026-07-11T09:00')
    expect(isDismissed('t1:2026-07-11T09:00')).toBe(true)
  })

  it('dismissing one key does not affect another', () => {
    dismiss('t1:2026-07-11T09:00')
    expect(isDismissed('t2:2026-07-11T09:00')).toBe(false)
  })

  it('a re-acknowledgement (new ackAt) produces a fresh, undismissed key', () => {
    dismiss('t1:2026-07-11T09:00')
    expect(isDismissed('t1:2026-07-12T10:00')).toBe(false)
  })

  it('tolerates corrupted localStorage without throwing', () => {
    localStorage.setItem('hq.ackDismissed', 'not json')
    expect(() => isDismissed('t1:2026-07-11T09:00')).not.toThrow()
    expect(isDismissed('t1:2026-07-11T09:00')).toBe(false)
  })
})
