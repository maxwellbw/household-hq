import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DogWalkNotice } from './DogWalkNotice'
import { formatDayLabel } from '@/lib/datetime'
import type { DogWalk } from '@/types/domain'

beforeEach(() => {
  localStorage.clear()
})

function day(overrides: Partial<DogWalk> & { id: string; date: string }): DogWalk {
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
    const { container } = render(<DogWalkNotice days={[]} onOpenDate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the day, a human-readable reason, and an Open in calendar link', () => {
    const flagged = day({ id: 'a', date: '2026-07-14', reason: 'no-good-weather' })
    render(<DogWalkNotice days={[flagged]} onOpenDate={vi.fn()} />)
    const label = formatDayLabel('2026-07-14', { weekday: 'short', month: 'short', day: 'numeric' })
    expect(statusWithText(`Dog walk — ${label}: No good-weather window todayOpen in calendar✕`)).toBeInTheDocument()
  })

  it('falls back to a generic label for an unrecognized reason', () => {
    const flagged = day({ id: 'a', date: '2026-07-14', reason: 'something-new' })
    render(<DogWalkNotice days={[flagged]} onOpenDate={vi.fn()} />)
    expect(screen.getByText(/Needs a decision/)).toBeInTheDocument()
  })

  it('calls onOpenDate with the day when "Open in calendar" is tapped', () => {
    const onOpenDate = vi.fn()
    const flagged = day({ id: 'a', date: '2026-07-14' })
    render(<DogWalkNotice days={[flagged]} onOpenDate={onOpenDate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open in calendar' }))
    expect(onOpenDate).toHaveBeenCalledWith('2026-07-14')
  })

  it('dismissing a notice removes it from view', () => {
    const flagged = day({ id: 'a', date: '2026-07-14' })
    render(<DogWalkNotice days={[flagged]} onOpenDate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders multiple flagged days independently', () => {
    const a = day({ id: 'a', date: '2026-07-14', reason: 'no-good-weather' })
    const b = day({ id: 'b', date: '2026-07-15', reason: 'no-mutual-free' })
    render(<DogWalkNotice days={[a, b]} onOpenDate={vi.fn()} />)
    expect(screen.getAllByRole('status')).toHaveLength(2)
  })
})
