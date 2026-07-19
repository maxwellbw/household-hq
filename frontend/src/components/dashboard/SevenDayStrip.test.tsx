import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SevenDayStrip } from './SevenDayStrip'
import type { DayTileSummary } from '@/lib/dashboard'

function tile(overrides: Partial<DayTileSummary> & { dateKey: string }): DayTileSummary {
  return {
    isToday: false,
    countsByOwner: { max: 0, jaz: 0, both: 0 },
    total: 0,
    hasDogWalk: false,
    needsDogWalkDecision: false,
    ...overrides,
  }
}

const tiles: DayTileSummary[] = [
  tile({ dateKey: '2026-07-10', isToday: true, countsByOwner: { max: 1, jaz: 0, both: 0 }, total: 1 }),
  tile({ dateKey: '2026-07-11' }),
  tile({ dateKey: '2026-07-12' }),
  tile({ dateKey: '2026-07-13' }),
  tile({ dateKey: '2026-07-14' }),
  tile({ dateKey: '2026-07-15' }),
  tile({ dateKey: '2026-07-16' }),
]

describe('SevenDayStrip', () => {
  it('renders exactly 7 tiles, today first', () => {
    render(<SevenDayStrip tiles={tiles} activeDateKey={null} onToggleDate={vi.fn()} />)
    const group = screen.getByRole('group', { name: 'Next 7 days' })
    expect(group.querySelectorAll('button')).toHaveLength(7)
  })

  it('shows an owner count on the tile with items', () => {
    render(<SevenDayStrip tiles={tiles} activeDateKey={null} onToggleDate={vi.fn()} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders an empty tile as present-but-empty with a quiet label, not a bare dash (FR-018, contract C5)', () => {
    render(<SevenDayStrip tiles={tiles} activeDateKey={null} onToggleDate={vi.fn()} />)
    expect(screen.queryByText('—')).not.toBeInTheDocument()
    const emptyTiles = screen.getAllByText('Free')
    expect(emptyTiles.length).toBe(6)
  })

  it('shows a 🐾 on a dog-walk day and a ⚠️ on a needs-decision day (feature 011)', () => {
    const walkTiles = [
      tile({ dateKey: '2026-07-10', isToday: true, hasDogWalk: true }),
      tile({ dateKey: '2026-07-11', needsDogWalkDecision: true }),
      ...tiles.slice(2),
    ]
    render(<SevenDayStrip tiles={walkTiles} activeDateKey={null} onToggleDate={vi.fn()} />)
    expect(screen.getByLabelText('Dog walk')).toBeInTheDocument()
    expect(screen.getByLabelText('Dog walk needs a decision')).toBeInTheDocument()
    // A needs-decision day shows the ⚠️ instead of the empty placeholder.
    expect(screen.getAllByText('Free').length).toBe(5)
  })

  it('calls onToggleDate with the tapped tile date', () => {
    const onToggleDate = vi.fn()
    render(<SevenDayStrip tiles={tiles} activeDateKey={null} onToggleDate={onToggleDate} />)
    fireEvent.click(screen.getByRole('button', { name: /July 12/ }))
    expect(onToggleDate).toHaveBeenCalledWith('2026-07-12')
  })

  it('marks the active tile aria-expanded=true and others false (US4)', () => {
    render(<SevenDayStrip tiles={tiles} activeDateKey="2026-07-12" onToggleDate={vi.fn()} />)
    const activeButton = screen.getByRole('button', { name: /July 12/ })
    expect(activeButton).toHaveAttribute('aria-expanded', 'true')
    const otherButton = screen.getByRole('button', { name: /July 13/ })
    expect(otherButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('gives the active tile a selected style distinct from today', () => {
    render(<SevenDayStrip tiles={tiles} activeDateKey="2026-07-12" onToggleDate={vi.fn()} />)
    const activeButton = screen.getByRole('button', { name: /July 12/ })
    const todayButton = screen.getByRole('button', { name: /July 10/ })
    expect(activeButton.className).not.toBe(todayButton.className)
  })
})
