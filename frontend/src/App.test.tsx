import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// App-level deep-link routing (feature 033 US4, T004/T006, contracts/deeplink-urls.md).
// Every view App renders — including the two lazy-loaded ones — is stubbed here so this
// test exercises only App's own routing/hosting logic, not each view's internals (those
// have their own test files).

function setUrl(search: string) {
  window.history.replaceState(null, '', `/${search}`)
}

vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({}) }))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'signed-in',
    session: {
      token: 'tok',
      who: { identity: 'max', displayName: 'Max', email: 'max@test.com', needsActingPerson: false },
      actingPerson: undefined,
    },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/useBootstrap', () => ({ useBootstrap: () => ({ isLoading: false }) }))

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'America/Los_Angeles', data: { settings: { timezone: 'America/Los_Angeles' } } }),
}))

vi.mock('@/hooks/useOwnerFilter', () => ({
  useOwnerFilter: () => ({ visibleOwners: new Set(['max', 'jaz', 'both']), toggle: vi.fn() }),
}))

vi.mock('@/components/dashboard/DashboardHome', () => ({
  DashboardHome: () => <div>Dashboard stub</div>,
}))

vi.mock('@/components/task/TasksView', () => ({
  TasksView: () => <div>Tasks stub</div>,
}))

vi.mock('@/components/lists/ListsView', () => ({
  ListsView: () => <div>Lists stub</div>,
}))

vi.mock('@/components/calendar/CalendarHome', () => ({
  CalendarHome: () => <div>Calendar stub</div>,
}))

vi.mock('@/components/more/MoreView', () => ({
  MoreView: () => <div>More stub</div>,
}))

vi.mock('@/components/dashboard/DogWalkPlanner', () => ({
  DogWalkPlanner: ({ dateKey, onClose }: { dateKey: string; onClose: () => void }) => (
    <div role="dialog" aria-label="Dog-walk planner">
      Planner for {dateKey}
      <button type="button" onClick={onClose}>
        Close planner
      </button>
    </div>
  ),
}))

vi.mock('@/components/task/ScheduleTaskDialog', () => ({
  ScheduleTaskDialog: () => null,
}))

describe('App deep-link routing (feature 033 US4)', () => {
  afterEach(() => {
    setUrl('')
  })

  it('?task=<id> lands on the Tasks tab', async () => {
    setUrl('?task=t1')
    render(<App />)
    expect(await screen.findByText('Tasks stub')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard stub')).not.toBeInTheDocument()
  })

  it('?walk=<date> opens the planner for that date, landing on Home behind it (contract: active tab is Home)', async () => {
    setUrl('?walk=2026-07-20')
    render(<App />)
    expect(await screen.findByText('Dashboard stub')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Dog-walk planner' })).toHaveTextContent('Planner for 2026-07-20')
  })

  it('?overdue=1 lands on Home with no planner sheet', async () => {
    setUrl('?overdue=1')
    render(<App />)
    expect(await screen.findByText('Dashboard stub')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Dog-walk planner' })).not.toBeInTheDocument()
  })

  it('an unparseable ?walk= date falls through to Home with no planner sheet', async () => {
    setUrl('?walk=not-a-date')
    render(<App />)
    expect(await screen.findByText('Dashboard stub')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Dog-walk planner' })).not.toBeInTheDocument()
  })

  it('no deep-link param defaults to Home with no planner sheet', async () => {
    render(<App />)
    expect(await screen.findByText('Dashboard stub')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Dog-walk planner' })).not.toBeInTheDocument()
  })

  it('strips the deep-link param from the URL after consuming it', async () => {
    setUrl('?walk=2026-07-20')
    render(<App />)
    await screen.findByRole('dialog', { name: 'Dog-walk planner' })
    expect(window.location.search).toBe('')
  })
})
