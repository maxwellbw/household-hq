import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskDetailSheet } from './TaskDetailSheet'
import type { Task } from '@/types/domain'

const unsnoozeMutate = vi.fn()
vi.mock('@/hooks/useMutations', () => ({
  useUnsnoozeTask: () => ({ mutate: unsnoozeMutate, isPending: false }),
  useUpdateTask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

const openTask: Task = {
  id: 't1',
  title: 'Water the plants',
  owner: 'max',
  status: 'open',
  dueDate: '2026-07-22',
} as Task

const snoozedTask: Task = {
  id: 't2',
  title: 'Call the vet',
  owner: 'jaz',
  status: 'snoozed',
  dueDate: '2026-07-25',
  snoozeHistory: '2026-07-22→2026-07-25 @ 2026-07-20T10:00:00Z',
} as Task

describe('TaskDetailSheet', () => {
  it('opens read-only — no editable fields until Edit is tapped', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    expect(screen.queryByPlaceholderText('Task title')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit task' })).toBeInTheDocument()
  })

  it('tapping Edit reveals the edit form', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit task' }))
    expect(screen.getByPlaceholderText('Task title')).toBeInTheDocument()
  })

  it('opens directly in edit mode when initialEdit is true', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} initialEdit />)
    expect(screen.getByPlaceholderText('Task title')).toBeInTheDocument()
  })

  it('a successful save closes the edit form, returning to the read-only detail view', async () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit task' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('button', { name: 'Edit task' })
    expect(screen.queryByPlaceholderText('Task title')).not.toBeInTheDocument()
  })

  it('shows snooze history and Un-snooze for a snoozed task', () => {
    render(<TaskDetailSheet task={snoozedTask} onClose={vi.fn()} />)
    expect(screen.getByText('Un-snooze')).toBeInTheDocument()
    expect(screen.getByText(/2026-07-22/)).toBeInTheDocument()
  })
})
