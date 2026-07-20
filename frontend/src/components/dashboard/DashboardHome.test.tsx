import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { DashboardHome } from './DashboardHome'
import { todayKey } from '@/lib/datetime'

const TZ = 'America/Los_Angeles'

function renderDashboard(props: Partial<Parameters<typeof DashboardHome>[0]> = {}) {
  return render(
    <DashboardHome
      onOpenDate={vi.fn()}
      onNavigateTasks={vi.fn()}
      onNavigateGroceries={vi.fn()}
      onNavigateFeed={vi.fn()}
      onOpenWalkPlanner={vi.fn()}
      {...props}
    />,
  )
}

// Stub all data hooks — DashboardHome is tested for section structure and
// empty states, not for data-fetching logic (covered in dashboard.test.ts).

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'America/Los_Angeles', data: { settings: { timezone: 'America/Los_Angeles' } } }),
}))

vi.mock('@/hooks/useLists', () => ({
  useListItems: () => ({ data: [], isPending: false, isError: false }),
}))

vi.mock('@/hooks/useDogWalks', () => ({
  useDogWalks: () => ({ data: [], isPending: false, isError: false }),
}))

vi.mock('@/hooks/useActivity', () => ({
  useActivity: () => ({ data: [], isPending: false, isError: false }),
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

vi.mock('@/hooks/useMutations', () => ({
  useCompleteTask: () => ({ mutate: vi.fn() }),
  useReopenTask: () => ({ mutate: vi.fn() }),
  useAcknowledgeTask: () => ({ mutate: vi.fn(), isPending: false }),
}))

describe('DashboardHome', () => {
  it('renders the quiet-week section headings on load', () => {
    renderDashboard()
    expect(screen.getByText('This weekend')).toBeInTheDocument()
    expect(screen.getByText('Load balance')).toBeInTheDocument()
    expect(screen.getByText('Coming up')).toBeInTheDocument()
    // Overdue only renders when non-empty (contract C7) — absent in the quiet-week state.
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
  })

  it('quiet week — all sections show calm empty states, no errors and no blank panels', () => {
    renderDashboard()
    // Merged Overdue+Today empty line (FR-008) — exactly one line for the region.
    expect(screen.getByText('Nothing due and nothing overdue — enjoy the quiet.')).toBeInTheDocument()
    expect(screen.getByText('Nothing lined up this weekend.')).toBeInTheDocument()
    // Highlights empty state
    expect(screen.getByText('All quiet — nothing unusual ahead.')).toBeInTheDocument()
    // Load-balance collapses an all-zero period to one quiet line (FR-011)
    expect(screen.getByText('Nothing tracked this week.')).toBeInTheDocument()
    expect(screen.getByText('Nothing tracked this month.')).toBeInTheDocument()
    // No error banner, no loading skeletons
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Loading dashboard')).not.toBeInTheDocument()
  })

  it('shows loading skeletons while data is pending', () => {
    mockUseTasks.mockReturnValueOnce({ data: undefined, isPending: true, isError: false })
    renderDashboard()
    expect(screen.getByLabelText('Loading dashboard')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Next 7 days' })).not.toBeInTheDocument()
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
    renderDashboard()
    // The notice text is split across nested <span>s for owner-color styling (feature 028 R7).
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Max has it:')
    expect(status).toHaveTextContent('Pick up the dog')
  })

  describe('Overdue section (feature 032 US2, contract C7)', () => {
    it('shows the Overdue heading above the strip when overdue tasks exist, capped at 5', () => {
      mockUseTasks.mockReturnValueOnce({
        data: Array.from({ length: 7 }, (_, i) => ({
          id: `o${i}`, title: `Overdue ${i}`, owner: 'max', status: 'open', dueDate: '2000-01-01',
        })),
        isPending: false,
        isError: false,
      })
      renderDashboard()
      expect(screen.getByText('Overdue')).toBeInTheDocument()
      expect(screen.getByText('View all 7 in Tasks')).toBeInTheDocument()
    })

    it('navigates to Tasks via the "view all" link', () => {
      const onNavigateTasks = vi.fn()
      mockUseTasks.mockReturnValueOnce({
        data: [{ id: 'o1', title: 'Overdue thing', owner: 'max', status: 'open', dueDate: '2000-01-01' }],
        isPending: false,
        isError: false,
      })
      renderDashboard({ onNavigateTasks })
      fireEvent.click(screen.getByRole('button', { name: /View all/ }))
      expect(onNavigateTasks).toHaveBeenCalledTimes(1)
    })
  })

  describe('day-peek panel (US4/US28/US2-032)', () => {
    it("pre-selects today's card on mount (contract C7)", () => {
      renderDashboard()
      expect(screen.getByRole('region', { name: /,/ })).toBeInTheDocument()
    })

    it('closes on a repeat tap of the pre-selected today tile, and opens a different day on tap', () => {
      renderDashboard()
      const group = screen.getByRole('group', { name: 'Next 7 days' })
      const [firstTile, secondTile] = group.querySelectorAll('button')

      fireEvent.click(firstTile)
      expect(screen.queryByRole('region', { name: /,/ })).not.toBeInTheDocument()

      fireEvent.click(secondTile)
      expect(screen.getAllByRole('region', { name: /,/ })).toHaveLength(1)

      fireEvent.click(secondTile)
      expect(screen.queryByRole('region', { name: /,/ })).not.toBeInTheDocument()
    })

    it('passes the tapped day through to the "Open in calendar" callback', () => {
      const onOpenDate = vi.fn()
      renderDashboard({ onOpenDate })
      fireEvent.click(screen.getByRole('button', { name: 'Open in calendar' }))
      expect(onOpenDate).toHaveBeenCalledWith(todayKey(TZ))
    })

    it("surfaces today's tasks and events inside the panel by default (SC-006: matches the strip)", () => {
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
          <DashboardHome
            onOpenDate={vi.fn()}
            onNavigateTasks={vi.fn()}
            onNavigateGroceries={vi.fn()}
            onNavigateFeed={vi.fn()}
            onOpenWalkPlanner={vi.fn()}
          />
        </QueryClientProvider>,
      )

      const region = screen.getByRole('region', { name: /,/ })
      expect(region).toHaveTextContent('Water the plants')
      expect(region).toHaveTextContent('Team standup')

      // Restore defaults so this mock doesn't leak into other test files' shared module state.
      mockUseTasks.mockReturnValue({ data: [], isPending: false, isError: false })
      mockUseEvents.mockReturnValue({ data: [], isPending: false, isError: false })
    })
  })
})
