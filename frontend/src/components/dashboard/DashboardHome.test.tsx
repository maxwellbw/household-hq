import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DashboardHome } from './DashboardHome'

// Stub all data hooks — DashboardHome is tested for section structure and
// empty states, not for data-fetching logic (covered in dashboard.test.ts).

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'America/Los_Angeles' }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: {
      token: 'tok',
      who: { identity: 'jaz', displayName: 'Jaz', email: 'jaz@test.com', needsActingPerson: false },
      actingPerson: undefined,
    },
  }),
}))

const mockUseTasks = vi.fn(
  (): { data: unknown[] | undefined; isPending: boolean; isError: boolean } => ({
    data: [],
    isPending: false,
    isError: false,
  }),
)
vi.mock('@/hooks/useTasks', () => ({ useTasks: () => mockUseTasks() }))

vi.mock('@/hooks/useEvents', () => ({
  useEvents: () => ({ data: [], isPending: false, isError: false }),
}))

vi.mock('@/hooks/useRecurring', () => ({
  useRecurring: () => ({ data: [], isPending: false, isError: false }),
}))

describe('DashboardHome', () => {
  it('renders all five section headings on load', () => {
    render(<DashboardHome onOpenDate={vi.fn()} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('This weekend')).toBeInTheDocument()
    expect(screen.getByText('Load balance')).toBeInTheDocument()
    expect(screen.getByText('Coming up')).toBeInTheDocument()
  })

  it('quiet week — all sections show calm empty states, no errors and no blank panels', () => {
    render(<DashboardHome onOpenDate={vi.fn()} />)
    // SmartViews empty states
    expect(screen.getByText('Nothing due today — enjoy the quiet.')).toBeInTheDocument()
    expect(screen.getByText('All caught up — nothing overdue.')).toBeInTheDocument()
    expect(screen.getByText('Nothing lined up this weekend.')).toBeInTheDocument()
    // Highlights empty state
    expect(screen.getByText('All quiet — nothing unusual ahead.')).toBeInTheDocument()
    // Load-balance rows always show both owners (viewer=jaz → "You"; other=Max)
    expect(screen.getAllByText('You').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Max').length).toBeGreaterThan(0)
    // No error banner, no loading skeletons
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Loading dashboard')).not.toBeInTheDocument()
  })

  it('shows loading skeletons while data is pending', () => {
    mockUseTasks.mockReturnValueOnce({ data: undefined, isPending: true, isError: false })
    render(<DashboardHome onOpenDate={vi.fn()} />)
    expect(screen.getByLabelText('Loading dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
  })

  it('shows an acknowledge notice when the other person committed to a task the viewer assigned (019 US2)', () => {
    mockUseTasks.mockReturnValueOnce({
      data: [
        {
          id: 't1', title: 'Pick up the dog', owner: 'max', status: 'open',
          ackBy: 'max', ackAt: '2026-07-11T09:00',
        },
      ],
      isPending: false,
      isError: false,
    })
    render(<DashboardHome onOpenDate={vi.fn()} />)
    expect(screen.getByText('Max has it: Pick up the dog')).toBeInTheDocument()
  })
})
