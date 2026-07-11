import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

const tasks: Task[] = [
  { id: 't1', title: 'Water the plants', owner: 'max', status: 'open', dueDate: '2026-07-22' } as Task,
]

vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({ data: tasks, isPending: false, isError: false }),
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
