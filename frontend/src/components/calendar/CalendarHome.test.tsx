import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarHome } from './CalendarHome'
import { ALL_OWNERS } from '@/lib/owners'

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'America/Los_Angeles' }),
}))

vi.mock('@/hooks/useMutations', () => ({
  useCompleteTask: () => ({ mutate: vi.fn() }),
  useReopenTask: () => ({ mutate: vi.fn() }),
  useSnoozeTask: () => ({ mutate: vi.fn() }),
  useUnsnoozeTask: () => ({ mutate: vi.fn() }),
  useUpdateTask: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useDeleteTask: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteEvent: () => ({ mutate: vi.fn(), isPending: false }),
  useAcknowledgeTask: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateEvent: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: {
      token: 'tok',
      who: { identity: 'max', displayName: 'Max', email: 'max@test.com', needsActingPerson: false },
      actingPerson: undefined,
    },
  }),
}))

vi.mock('@/hooks/useEvents', () => ({
  useEvents: () => ({
    data: [
      {
        id: 'e1',
        title: 'Dentist',
        start: '2026-07-20T14:30',
        end: '2026-07-20T15:30',
        owner: 'jaz',
      },
      {
        id: 'e2',
        title: 'Family dinner',
        start: '2026-07-21T18:00',
        end: '2026-07-21T20:00',
        owner: 'both',
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    dataUpdatedAt: Date.now(),
  }),
}))

vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({
    data: [
      { id: 't1', title: 'Confirm appointment', owner: 'jaz', status: 'open', eventId: 'e1', dueDate: '2026-07-18' },
      { id: 't2', title: 'Water the plants', owner: 'max', status: 'open', dueDate: '2026-07-22' },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    dataUpdatedAt: Date.now(),
  }),
}))

describe('CalendarHome', () => {
  it('renders the Schedule-X calendar with fixture events without crashing', async () => {
    render(<CalendarHome visibleOwners={new Set(ALL_OWNERS)} />)
    expect(await screen.findByText('Dentist')).toBeInTheDocument()
    expect(await screen.findByText('Family dinner')).toBeInTheDocument()
  })

  it('shows a prep-count indicator on an event with tethered tasks', async () => {
    render(<CalendarHome visibleOwners={new Set(ALL_OWNERS)} />)
    // t1 is tethered to e1 (Dentist) via eventId — the tether should surface
    // as a "0/1 tasks" done/total badge on the event chip (EventContent).
    expect(await screen.findByText('0/1 tasks')).toBeInTheDocument()
  })

  it('renders a standalone task (no eventId) on its own date, not dropped', async () => {
    render(<CalendarHome visibleOwners={new Set(ALL_OWNERS)} />)
    expect(await screen.findByText('Water the plants')).toBeInTheDocument()
  })

  it('hides events and standalone tasks whose owner is filtered out', async () => {
    render(<CalendarHome visibleOwners={new Set(['both'])} />)
    // Only e2 (Family dinner, owner "both") should remain visible.
    expect(await screen.findByText('Family dinner')).toBeInTheDocument()
    expect(screen.queryByText('Dentist')).not.toBeInTheDocument()
    expect(screen.queryByText('Water the plants')).not.toBeInTheDocument()
  })

  it('tapping an event chip opens EventDetailSheet (US4, FR-013)', async () => {
    render(<CalendarHome visibleOwners={new Set(ALL_OWNERS)} />)
    fireEvent.click(await screen.findByText('Dentist'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'Dentist')
  })

  it('tapping a standalone task chip opens TaskDetailSheet, not ignored (US4, FR-014 — regression guard for the ignored-task-tap bug)', async () => {
    render(<CalendarHome visibleOwners={new Set(ALL_OWNERS)} />)
    fireEvent.click(await screen.findByText('Water the plants'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'Water the plants')
    // The task detail sheet (not the event sheet) is open — it has an Edit task button.
    expect(screen.getByRole('button', { name: 'Edit task' })).toBeInTheDocument()
  })
})
