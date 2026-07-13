import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { DashboardHome } from './DashboardHome'
import { todayKey } from '@/lib/datetime'

const TZ = 'America/Los_Angeles'

// Stub all data hooks — DashboardHome is tested for section structure and
// empty states, not for data-fetching logic (covered in dashboard.test.ts).

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'America/Los_Angeles', data: { settings: { timezone: 'America/Los_Angeles' } } }),
}))

vi.mock('@/hooks/useLists', () => ({
  useListItems: () => ({ data: [], isPending: false, isError: false }),
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

const mockUseEvents = vi.fn(
  (): { data: unknown[] | undefined; isPending: boolean; isError: boolean } => ({
    data: [],
    isPending: false,
    isError: false,
  }),
)
vi.mock('@/hooks/useEvents', () => ({ useEvents: () => mockUseEvents() }))

vi.mock('@/hooks/useRecurring', () => ({
  useRecurring: () => ({ data: [], isPending: false, isError: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
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
    // The notice text is split across nested <span>s for owner-color styling (feature 028 R7).
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Max has it:')
    expect(status).toHaveTextContent('Pick up the dog')
  })

  describe('day-peek panel (US4/US28)', () => {
    it('opens the panel on tap, switches to a different day, and closes on a repeat tap', () => {
      render(<DashboardHome onOpenDate={vi.fn()} />)
      const group = screen.getByRole('group', { name: 'Next 7 days' })
      const [firstTile, secondTile] = group.querySelectorAll('button')

      expect(screen.queryByRole('region', { name: /,/ })).not.toBeInTheDocument()

      fireEvent.click(firstTile)
      expect(screen.getByRole('region', { name: /,/ })).toBeInTheDocument()

      fireEvent.click(secondTile)
      expect(screen.getAllByRole('region', { name: /,/ })).toHaveLength(1)

      fireEvent.click(secondTile)
      expect(screen.queryByRole('region', { name: /,/ })).not.toBeInTheDocument()
    })

    it('passes the tapped day through to the "Open in calendar" callback', () => {
      const onOpenDate = vi.fn()
      render(<DashboardHome onOpenDate={onOpenDate} />)
      const group = screen.getByRole('group', { name: 'Next 7 days' })
      const [firstTile] = group.querySelectorAll('button')
      fireEvent.click(firstTile)

      fireEvent.click(screen.getByRole('button', { name: 'Open in calendar' }))
      expect(onOpenDate).toHaveBeenCalledWith(todayKey(TZ))
    })

    it("surfaces today's tasks and events inside the panel (SC-006: matches the strip)", () => {
      // mockReturnValue (not -Once): the state update from the click below re-renders
      // DashboardHome, which calls useTasks()/useEvents() again.
      mockUseTasks.mockReturnValue({
        data: [{ id: 't1', title: 'Water the plants', owner: 'jaz', status: 'open', dueDate: todayKey(TZ) }],
        isPending: false,
        isError: false,
      })
      mockUseEvents.mockReturnValue({
        data: [{ id: 'e1', title: 'Team standup', owner: 'max', start: todayKey(TZ), end: todayKey(TZ) }],
        isPending: false,
        isError: false,
      })
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
      render(
        <QueryClientProvider client={queryClient}>
          <DashboardHome onOpenDate={vi.fn()} />
        </QueryClientProvider>,
      )
      const group = screen.getByRole('group', { name: 'Next 7 days' })
      const [firstTile] = group.querySelectorAll('button')
      fireEvent.click(firstTile)

      const region = screen.getByRole('region', { name: /,/ })
      expect(region).toHaveTextContent('Water the plants')
      expect(region).toHaveTextContent('Team standup')

      // Restore defaults so this mock doesn't leak into other test files' shared module state.
      mockUseTasks.mockReturnValue({ data: [], isPending: false, isError: false })
      mockUseEvents.mockReturnValue({ data: [], isPending: false, isError: false })
    })
  })
})
