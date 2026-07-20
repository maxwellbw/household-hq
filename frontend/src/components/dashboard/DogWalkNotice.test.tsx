import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DogWalkNotice } from './DogWalkNotice'
import { dogWalkNotices, type DogWalkNoticeItem } from '@/lib/dogwalks'
import { dogWalkNoticeKey } from '@/lib/dogWalkDismissals'
import { formatDayLabel } from '@/lib/datetime'
import type { DogWalk } from '@/types/domain'

beforeEach(() => {
  localStorage.clear()
})

function notice(overrides: Partial<DogWalkNoticeItem> & { date: string }): DogWalkNoticeItem {
  const slot = overrides.slot ?? 'primary'
  const reason = overrides.reason ?? 'no-good-weather'
  return {
    slot,
    reason,
    key: dogWalkNoticeKey(overrides.date, slot, reason ?? ''),
    tier: 'urgent',
    dayPhrase: 'today',
    ...overrides,
  }
}

function walk(overrides: Partial<DogWalk> & { id: string; date: string }): DogWalk {
  return {
    slot: 'primary',
    status: 'needs-decision',
    windowStart: null,
    windowEnd: null,
    durationMin: null,
    reason: 'no-good-weather',
    ...overrides,
  }
}

function statusWithText(text: string) {
  return screen.getByText((_content, el) => el?.tagName === 'DIV' && el.textContent === text, {
    selector: '[role="status"]',
  })
}

describe('DogWalkNotice', () => {
  it('renders nothing when there are no flagged days', () => {
    const { container } = render(<DogWalkNotice notices={[]} onOpenDate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the day, a human-readable reason, and an Open planner action', () => {
    const flagged = notice({ date: '2026-07-14', reason: 'no-good-weather', tier: 'urgent', dayPhrase: 'today' })
    render(<DogWalkNotice notices={[flagged]} onOpenDate={vi.fn()} />)
    const label = formatDayLabel('2026-07-14', { weekday: 'short', month: 'short', day: 'numeric' })
    expect(statusWithText(`Dog walk — ${label}: No good-weather window todayOpen planner✕`)).toBeInTheDocument()
  })

  it('falls back to a generic label for an unrecognized reason', () => {
    const flagged = notice({ date: '2026-07-14', reason: 'something-new' })
    render(<DogWalkNotice notices={[flagged]} onOpenDate={vi.fn()} />)
    expect(screen.getByText(/Needs a decision/)).toBeInTheDocument()
  })

  it('calls onOpenDate with the day when "Open planner" is tapped', () => {
    const onOpenDate = vi.fn()
    const flagged = notice({ date: '2026-07-14' })
    render(<DogWalkNotice notices={[flagged]} onOpenDate={onOpenDate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open planner' }))
    expect(onOpenDate).toHaveBeenCalledWith('2026-07-14')
  })

  it('dismissing a notice removes it from view immediately', () => {
    const flagged = notice({ date: '2026-07-14' })
    render(<DogWalkNotice notices={[flagged]} onOpenDate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders a single quiet notice standalone, not collapsed', () => {
    const a = notice({ date: '2026-07-14', reason: 'no-good-weather', tier: 'quiet', dayPhrase: 'on Tue' })
    render(<DogWalkNotice notices={[a]} onOpenDate={vi.fn()} />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.queryByText(/upcoming walks need a decision/)).not.toBeInTheDocument()
  })

  it('a dismissed notice stays hidden after a simulated remount/refetch with no underlying change (feature 029 US3)', () => {
    const TZ = 'America/Los_Angeles'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T18:00:00Z'))
    const rows = [walk({ id: 'a', date: '2026-07-14', reason: 'no-good-weather' })]

    const { unmount } = render(<DogWalkNotice notices={dogWalkNotices(rows, TZ)} onOpenDate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    unmount()

    // Simulate the dashboard recomputing notices fresh after a remount/refetch of unchanged data.
    render(<DogWalkNotice notices={dogWalkNotices(rows, TZ)} onOpenDate={vi.fn()} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('a new reason for the same day re-shows a notice after dismissal', () => {
    const TZ = 'America/Los_Angeles'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T18:00:00Z'))
    const rows = [walk({ id: 'a', date: '2026-07-14', reason: 'no-good-weather' })]

    const { unmount } = render(<DogWalkNotice notices={dogWalkNotices(rows, TZ)} onOpenDate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    unmount()

    const changedReason = [walk({ id: 'a', date: '2026-07-14', reason: 'forecast-turned-bad' })]
    render(<DogWalkNotice notices={dogWalkNotices(changedReason, TZ)} onOpenDate={vi.fn()} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    vi.useRealTimers()
  })

  describe('urgency tiering & collapse (feature 033 US6, T028)', () => {
    it('never shows "today" for a notice several days out (wrong-copy regression, FR-019)', () => {
      const farOut = notice({ date: '2026-07-20', reason: 'no-good-weather', tier: 'quiet', dayPhrase: 'on Mon' })
      render(<DogWalkNotice notices={[farOut]} onOpenDate={vi.fn()} />)
      expect(screen.getByRole('status').textContent).not.toMatch(/today/i)
      expect(screen.getByText(/No good-weather window on Mon/)).toBeInTheDocument()
    })

    it('renders an urgent (today/tomorrow) notice with the alarm border, not the calm one', () => {
      const urgent = notice({ date: '2026-07-14', tier: 'urgent', dayPhrase: 'today' })
      render(<DogWalkNotice notices={[urgent]} onOpenDate={vi.fn()} />)
      expect(screen.getByRole('status')).toHaveClass('border-2', 'border-owner-both')
    })

    it('renders a quiet notice without alarm styling', () => {
      const quiet = notice({ date: '2026-07-20', tier: 'quiet', dayPhrase: 'on Mon' })
      render(<DogWalkNotice notices={[quiet]} onOpenDate={vi.fn()} />)
      const row = screen.getByRole('status')
      expect(row).not.toHaveClass('border-2')
      expect(row).toHaveClass('border-border')
    })

    it('collapses 2+ quiet notices into one summary row', () => {
      const a = notice({ date: '2026-07-20', reason: 'no-good-weather', tier: 'quiet', dayPhrase: 'on Mon' })
      const b = notice({ date: '2026-07-25', reason: 'no-mutual-free', tier: 'quiet', dayPhrase: 'on Sat' })
      render(<DogWalkNotice notices={[a, b]} onOpenDate={vi.fn()} />)
      expect(screen.getByText('2 upcoming walks need a decision')).toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('expands the collapsed summary in place to show each quiet notice', () => {
      const a = notice({ date: '2026-07-20', reason: 'no-good-weather', tier: 'quiet', dayPhrase: 'on Mon' })
      const b = notice({ date: '2026-07-25', reason: 'no-mutual-free', tier: 'quiet', dayPhrase: 'on Sat' })
      render(<DogWalkNotice notices={[a, b]} onOpenDate={vi.fn()} />)
      const toggle = screen.getByRole('button', { name: '2 upcoming walks need a decisionShow' })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getAllByRole('status')).toHaveLength(2)
      expect(screen.getByText(/No good-weather window on Mon/)).toBeInTheDocument()
      expect(screen.getByText(/No mutual-free window on Sat/)).toBeInTheDocument()
    })

    it('does not collapse an urgent notice alongside quiet ones — urgent always shows standalone', () => {
      const urgent = notice({ date: '2026-07-14', tier: 'urgent', dayPhrase: 'today' })
      const quietA = notice({ date: '2026-07-20', tier: 'quiet', dayPhrase: 'on Mon' })
      const quietB = notice({ date: '2026-07-25', tier: 'quiet', dayPhrase: 'on Sat' })
      render(<DogWalkNotice notices={[urgent, quietA, quietB]} onOpenDate={vi.fn()} />)
      expect(screen.getAllByRole('status')).toHaveLength(1)
      expect(screen.getByText(/No good-weather window today/)).toBeInTheDocument()
      expect(screen.getByText('2 upcoming walks need a decision')).toBeInTheDocument()
    })
  })
})
