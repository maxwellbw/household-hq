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

  it('shows the day, a human-readable reason, and an Open in calendar link', () => {
    const flagged = notice({ date: '2026-07-14', reason: 'no-good-weather' })
    render(<DogWalkNotice notices={[flagged]} onOpenDate={vi.fn()} />)
    const label = formatDayLabel('2026-07-14', { weekday: 'short', month: 'short', day: 'numeric' })
    expect(statusWithText(`Dog walk — ${label}: No good-weather window todayOpen in calendar✕`)).toBeInTheDocument()
  })

  it('falls back to a generic label for an unrecognized reason', () => {
    const flagged = notice({ date: '2026-07-14', reason: 'something-new' })
    render(<DogWalkNotice notices={[flagged]} onOpenDate={vi.fn()} />)
    expect(screen.getByText(/Needs a decision/)).toBeInTheDocument()
  })

  it('calls onOpenDate with the day when "Open in calendar" is tapped', () => {
    const onOpenDate = vi.fn()
    const flagged = notice({ date: '2026-07-14' })
    render(<DogWalkNotice notices={[flagged]} onOpenDate={onOpenDate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open in calendar' }))
    expect(onOpenDate).toHaveBeenCalledWith('2026-07-14')
  })

  it('dismissing a notice removes it from view immediately', () => {
    const flagged = notice({ date: '2026-07-14' })
    render(<DogWalkNotice notices={[flagged]} onOpenDate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders multiple flagged days independently', () => {
    const a = notice({ date: '2026-07-14', reason: 'no-good-weather' })
    const b = notice({ date: '2026-07-15', reason: 'no-mutual-free' })
    render(<DogWalkNotice notices={[a, b]} onOpenDate={vi.fn()} />)
    expect(screen.getAllByRole('status')).toHaveLength(2)
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
})
