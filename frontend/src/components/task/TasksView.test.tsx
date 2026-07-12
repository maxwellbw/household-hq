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
  useUpdateTask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
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

  it('tapping a someday task title calls onScheduleSomeday with its id', () => {
    mockTasks = [{ id: 's1', title: 'Air-duct cleaning', owner: 'max', status: 'open' } as Task]
    const onScheduleSomeday = vi.fn()
    render(<TasksView onScheduleSomeday={onScheduleSomeday} />)
    fireEvent.click(screen.getByText('Air-duct cleaning'))
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
