import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskDetailSheet } from './TaskDetailSheet'
import type { Task } from '@/types/domain'

const unsnoozeMutate = vi.fn()
const snoozeMutate = vi.fn()
const deleteMutate = vi.fn((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
vi.mock('@/hooks/useMutations', () => ({
  useUnsnoozeTask: () => ({ mutate: unsnoozeMutate, isPending: false }),
  useUpdateTask: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useSnoozeTask: () => ({ mutate: snoozeMutate, isPending: false }),
  useDeleteTask: () => ({ mutate: deleteMutate, isPending: false }),
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

const recurringTask: Task = {
  id: 't3',
  title: 'Take out trash',
  owner: 'both',
  status: 'open',
  dueDate: '2026-07-15',
  recurringId: 'r1',
} as Task

describe('TaskDetailSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('a dated open task shows a Snooze action', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeInTheDocument()
  })

  it('tapping Snooze opens the snooze dialog', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }))
    expect(screen.getByRole('dialog', { name: /Snooze Water the plants/ })).toBeInTheDocument()
  })

  it('an already-snoozed task shows both Snooze and Un-snooze', () => {
    render(<TaskDetailSheet task={snoozedTask} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Snooze' })).toBeInTheDocument()
    expect(screen.getByText('Un-snooze')).toBeInTheDocument()
  })

  it('tapping Delete opens a confirmation dialog', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))
    expect(screen.getByRole('dialog', { name: 'Delete task?' })).toBeInTheDocument()
  })

  it('a plain task delete confirmation has no recurring-rule note', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))
    expect(screen.queryByText(/recurring rule/)).not.toBeInTheDocument()
  })

  it('a recurring-generated task shows instance-only delete copy', () => {
    render(<TaskDetailSheet task={recurringTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))
    expect(screen.getByText(/deletes only this occurrence/)).toBeInTheDocument()
    expect(screen.getByText(/More → Recurring/)).toBeInTheDocument()
  })

  it('confirming delete calls the delete mutation and closes the sheet', () => {
    const onClose = vi.fn()
    render(<TaskDetailSheet task={openTask} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteMutate).toHaveBeenCalledWith('t1', expect.anything())
    expect(onClose).toHaveBeenCalled()
  })

  it('cancelling the delete confirmation deletes nothing', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteMutate).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Delete task?' })).not.toBeInTheDocument()
  })
})
