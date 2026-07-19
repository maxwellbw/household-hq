import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LatelyStrip } from './LatelyStrip'

const mockUseActivity = vi.fn()
vi.mock('@/hooks/useActivity', () => ({ useActivity: () => mockUseActivity() }))

describe('LatelyStrip', () => {
  it('renders nothing while pending', () => {
    mockUseActivity.mockReturnValue({ data: undefined, isPending: true, isError: false })
    const { container } = render(<LatelyStrip onSeeAll={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing on error (a secondary surface never shows an error, FR-009)', () => {
    mockUseActivity.mockReturnValue({ data: undefined, isPending: false, isError: true })
    const { container } = render(<LatelyStrip onSeeAll={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when there is no activity', () => {
    mockUseActivity.mockReturnValue({ data: [], isPending: false, isError: false })
    const { container } = render(<LatelyStrip onSeeAll={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders up to 4 plain-sentence entries and a See all link', () => {
    mockUseActivity.mockReturnValue({
      data: Array.from({ length: 6 }, (_, i) => ({
        id: `a${i}`,
        timestamp: '2026-07-11T09:00',
        actor: i % 2 === 0 ? 'max' : 'jaz',
        action: 'task.complete',
        summary: `Did thing ${i}`,
      })),
      isPending: false,
      isError: false,
    })
    render(<LatelyStrip onSeeAll={vi.fn()} />)
    expect(screen.getByText('Lately')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByText('Did thing 0')).toBeInTheDocument()
    expect(screen.queryByText('Did thing 4')).not.toBeInTheDocument()
  })

  it('filters out system-authored entries so human completions surface (live-data deviation, spec.md)', () => {
    mockUseActivity.mockReturnValue({
      data: [
        { id: 's1', timestamp: '2026-07-11T09:05', actor: 'system', action: 'digest-weekly', summary: 'System emailed the week ahead' },
        { id: 's2', timestamp: '2026-07-11T09:04', actor: 'system', action: 'push-notify', summary: 'System sent a push notification' },
        { id: 'a1', timestamp: '2026-07-11T09:00', actor: 'max', action: 'task.complete', summary: 'Max completed Mow lawn' },
      ],
      isPending: false,
      isError: false,
    })
    render(<LatelyStrip onSeeAll={vi.fn()} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Max completed Mow lawn')).toBeInTheDocument()
  })

  it('renders nothing when every entry is system-authored', () => {
    mockUseActivity.mockReturnValue({
      data: [{ id: 's1', timestamp: '2026-07-11T09:05', actor: 'system', action: 'digest-weekly', summary: 'System emailed the week ahead' }],
      isPending: false,
      isError: false,
    })
    const { container } = render(<LatelyStrip onSeeAll={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('calls onSeeAll when tapped', () => {
    const onSeeAll = vi.fn()
    mockUseActivity.mockReturnValue({
      data: [{ id: 'a1', timestamp: '2026-07-11T09:00', actor: 'max', action: 'task.complete', summary: 'Did a thing' }],
      isPending: false,
      isError: false,
    })
    render(<LatelyStrip onSeeAll={onSeeAll} />)
    fireEvent.click(screen.getByRole('button', { name: 'See all' }))
    expect(onSeeAll).toHaveBeenCalledTimes(1)
  })
})
