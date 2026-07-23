import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TasksView } from './TasksView'
import { ALL_OWNERS } from '@/lib/owners'
import type { Task } from '@/types/domain'

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'America/Los_Angeles' }),
}))

vi.mock('@/hooks/useOwnerFilter', () => ({
  useOwnerFilter: () => ({ visibleOwners: new Set(ALL_OWNERS), toggle: vi.fn() }),
}))

vi.mock('@/hooks/useMutations', () => ({
  useCompleteTask: () => ({ mutate: vi.fn() }),
  useReopenTask: () => ({ mutate: vi.fn() }),
  useSnoozeTask: () => ({ mutate: vi.fn() }),
  useUnsnoozeTask: () => ({ mutate: vi.fn() }),
  useUpdateTask: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useDeleteTask: () => ({ mutate: vi.fn(), isPending: false }),
  useAcknowledgeTask: () => ({ mutate: vi.fn(), isPending: false }),
  useRankTasks: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
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

const tasks: Task[] = [
  { id: 't1', title: 'Water the plants', owner: 'max', status: 'open', dueDate: '2026-07-22' } as Task,
]

let mockTasks: Task[] = tasks

vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({ data: mockTasks, isPending: false, isError: false }),
}))

describe('TasksView — Edit due', () => {
  it('selecting Edit due from the overflow menu opens the detail sheet already in edit mode', () => {
    render(<TasksView />)
    fireEvent.click(screen.getByRole('button', { name: 'More options for Water the plants' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit due' }))
    expect(screen.getByPlaceholderText('Task title')).toBeInTheDocument()
  })

  it('tapping the title opens the detail sheet read-only (not edit mode)', () => {
    render(<TasksView />)
    fireEvent.click(screen.getByText('Water the plants'))
    expect(screen.queryByPlaceholderText('Task title')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit task' })).toBeInTheDocument()
  })
})

describe('TasksView — collapsible Open section (022 US3)', () => {
  it('Open is expanded by default, showing its count and tasks', () => {
    render(<TasksView />)
    const header = screen.getByRole('button', { name: /Open \(1\)/ })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Water the plants')).toBeInTheDocument()
  })

  it('collapsing Open hides its tasks while the header/count stays visible', () => {
    render(<TasksView />)
    fireEvent.click(screen.getByRole('button', { name: /Open \(1\)/ }))
    expect(screen.getByRole('button', { name: /Open \(1\)/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Water the plants')).not.toBeInTheDocument()
  })

  it('expanding Open again shows its tasks', () => {
    render(<TasksView />)
    const header = screen.getByRole('button', { name: /Open \(1\)/ })
    fireEvent.click(header)
    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Water the plants')).toBeInTheDocument()
  })
})

describe('TasksView — Someday section (021 US1)', () => {
  afterEach(() => {
    mockTasks = tasks
  })

  it('splits a standalone undated task into Someday, separate from Open', () => {
    mockTasks = [
      ...tasks,
      { id: 's1', title: 'Air-duct cleaning', owner: 'max', status: 'open' } as Task,
    ]
    render(<TasksView />)
    const openSection = screen.getByRole('button', { name: /Open \(1\)/ })
    const somedaySection = screen.getByRole('button', { name: /Someday \(1\)/ })
    expect(openSection).toBeInTheDocument()
    expect(somedaySection).toBeInTheDocument()
    expect(screen.getByText('Air-duct cleaning')).toBeInTheDocument()
  })

  it('Someday is expanded by default', () => {
    mockTasks = [{ id: 's1', title: 'Air-duct cleaning', owner: 'max', status: 'open' } as Task]
    render(<TasksView />)
    expect(screen.getByRole('button', { name: /Someday \(1\)/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Air-duct cleaning')).toBeInTheDocument()
  })

  it('collapsing Someday hides its tasks while the header/count stays visible', () => {
    mockTasks = [{ id: 's1', title: 'Air-duct cleaning', owner: 'max', status: 'open' } as Task]
    render(<TasksView />)
    fireEvent.click(screen.getByRole('button', { name: /Someday \(1\)/ }))
    expect(screen.getByRole('button', { name: /Someday \(1\)/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Air-duct cleaning')).not.toBeInTheDocument()
  })

  it('shows a calm empty state when there are no someday tasks', () => {
    mockTasks = []
    render(<TasksView />)
    expect(screen.getByRole('button', { name: /Someday \(0\)/ })).toBeInTheDocument()
    expect(screen.getByText(/Nothing parked for later/)).toBeInTheDocument()
  })

  it('an event-attached undated task is excluded from Someday (stays visible in Open)', () => {
    mockTasks = [
      { id: 'e1', title: 'Event prep', owner: 'max', status: 'open', eventId: 'evt-1' } as Task,
    ]
    render(<TasksView />)
    expect(screen.getByRole('button', { name: /Someday \(0\)/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open \(1\)/ })).toBeInTheDocument()
    expect(screen.getByText('Event prep')).toBeInTheDocument()
  })

  // 034 US2: a someday row now behaves like every other task row — the title opens the
  // detail sheet (not the schedule dialog); scheduling moved to a real menu item.
  it('tapping a someday task title opens the detail sheet, not the schedule dialog', () => {
    mockTasks = [{ id: 's1', title: 'Air-duct cleaning', owner: 'max', status: 'open' } as Task]
    const onScheduleSomeday = vi.fn()
    render(<TasksView onScheduleSomeday={onScheduleSomeday} />)
    fireEvent.click(screen.getByText('Air-duct cleaning'))
    expect(screen.getByRole('button', { name: 'Edit task' })).toBeInTheDocument()
    expect(onScheduleSomeday).not.toHaveBeenCalled()
  })

  it('selecting Schedule from a someday row menu calls onScheduleSomeday with its id', () => {
    mockTasks = [{ id: 's1', title: 'Air-duct cleaning', owner: 'max', status: 'open' } as Task]
    const onScheduleSomeday = vi.fn()
    render(<TasksView onScheduleSomeday={onScheduleSomeday} />)
    fireEvent.click(screen.getByRole('button', { name: 'More options for Air-duct cleaning' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Schedule' }))
    expect(onScheduleSomeday).toHaveBeenCalledWith('s1')
  })

  it('the Force-rank action is unavailable with zero someday tasks (FR-014, calm no-op)', () => {
    mockTasks = []
    render(<TasksView />)
    expect(screen.queryByRole('button', { name: 'Force-rank' })).not.toBeInTheDocument()
  })

  it('the Force-rank action is unavailable with exactly one someday task (nothing to compare)', () => {
    mockTasks = [{ id: 's1', title: 'Air-duct cleaning', owner: 'max', status: 'open' } as Task]
    render(<TasksView />)
    expect(screen.queryByRole('button', { name: 'Force-rank' })).not.toBeInTheDocument()
  })

  it('the Force-rank action appears once two or more someday tasks exist', () => {
    mockTasks = [
      { id: 's1', title: 'Air-duct cleaning', owner: 'max', status: 'open' } as Task,
      { id: 's2', title: 'Carpet cleaning', owner: 'jaz', status: 'open' } as Task,
    ]
    render(<TasksView />)
    expect(screen.getByRole('button', { name: 'Force-rank' })).toBeInTheDocument()
  })
})

describe('TasksView — horizon grouping within Open (feature 032 US5, FR-017)', () => {
  afterEach(() => {
    mockTasks = tasks
    vi.useRealTimers()
  })

  it('groups open tasks under This week / Next week / Later headings with counts', () => {
    vi.useFakeTimers()
    // Friday 2026-07-10 LA — household week is 07-05..07-11.
    vi.setSystemTime(new Date('2026-07-10T18:00:00Z'))
    mockTasks = [
      { id: 'a', title: 'Overdue thing', owner: 'max', status: 'open', dueDate: '2026-07-01' } as Task,
      { id: 'b', title: 'Next week thing', owner: 'max', status: 'open', dueDate: '2026-07-14' } as Task,
      { id: 'c', title: 'Later thing', owner: 'max', status: 'open', dueDate: '2026-08-01' } as Task,
    ]
    render(<TasksView />)
    expect(screen.getByText('This week (1)')).toBeInTheDocument()
    expect(screen.getByText('Next week (1)')).toBeInTheDocument()
    expect(screen.getByText('Later (1)')).toBeInTheDocument()
    expect(screen.getByText('Overdue thing')).toBeInTheDocument()
    expect(screen.getByText('Next week thing')).toBeInTheDocument()
    expect(screen.getByText('Later thing')).toBeInTheDocument()
  })

  it('hides empty horizon groups', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T18:00:00Z'))
    mockTasks = [
      { id: 'a', title: 'This week only', owner: 'max', status: 'open', dueDate: '2026-07-11' } as Task,
    ]
    render(<TasksView />)
    expect(screen.getByText('This week (1)')).toBeInTheDocument()
    expect(screen.queryByText(/Next week/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Later/)).not.toBeInTheDocument()
  })
})
