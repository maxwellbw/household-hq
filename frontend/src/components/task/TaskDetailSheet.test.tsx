import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskDetailSheet } from './TaskDetailSheet'
import type { Task } from '@/types/domain'

const unsnoozeMutate = vi.fn()
const snoozeMutate = vi.fn()
const deleteMutate = vi.fn((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
const acknowledgeMutate = vi.fn((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
const completeMutate = vi.fn()
const reopenMutate = vi.fn()
vi.mock('@/hooks/useMutations', () => ({
  useUnsnoozeTask: () => ({ mutate: unsnoozeMutate, isPending: false }),
  useUpdateTask: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useSnoozeTask: () => ({ mutate: snoozeMutate, isPending: false }),
  useDeleteTask: () => ({ mutate: deleteMutate, isPending: false }),
  useAcknowledgeTask: () => ({ mutate: acknowledgeMutate, isPending: false }),
  useCompleteTask: () => ({ mutate: completeMutate, isPending: false }),
  useReopenTask: () => ({ mutate: reopenMutate, isPending: false }),
}))

const showToast = vi.fn()
const showUndo = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: showToast, showUndo }),
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

// Viewer is 'max' (mocked useAuth session above).
const uncommittedForViewer: Task = {
  id: 't4',
  title: 'Pick up the dog',
  owner: 'max',
  status: 'open',
  dueDate: '2026-07-22',
} as Task

const uncommittedForOther: Task = {
  id: 't5',
  title: 'Book the vet',
  owner: 'jaz',
  status: 'open',
  dueDate: '2026-07-22',
} as Task

const acknowledgedTask: Task = {
  id: 't6',
  title: 'Renew registration',
  owner: 'max',
  status: 'open',
  dueDate: '2026-07-22',
  ackBy: 'max',
  ackAt: '2026-07-20T09:00',
} as Task

const taskWithNotes: Task = {
  id: 't7',
  title: 'Replace air filter',
  owner: 'both',
  status: 'open',
  notes: 'Buy: https://example.com/filter',
} as Task

const doneTask: Task = {
  id: 't8',
  title: 'Renew passport',
  owner: 'max',
  status: 'done',
  dueDate: '2026-07-15',
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

  it('renders notes with a tappable link', () => {
    render(<TaskDetailSheet task={taskWithNotes} onClose={vi.fn()} />)
    expect(screen.getByText('Buy:', { exact: false })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'https://example.com/filter' })
    expect(link).toHaveAttribute('href', 'https://example.com/filter')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('shows no notes section when the task has no notes', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    expect(screen.queryByText('Notes')).not.toBeInTheDocument()
  })

  it('shows only the "I\'ve got it" action (no redundant badge) when the viewer is the uncommitted assignee (028 R7)', () => {
    render(<TaskDetailSheet task={uncommittedForViewer} onClose={vi.fn()} />)
    expect(screen.queryByText('Not yet committed')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: "I've got it" })).toBeInTheDocument()
  })

  it('shows "Not yet committed" but no action when the viewer is the assigner, not the assignee', () => {
    render(<TaskDetailSheet task={uncommittedForOther} onClose={vi.fn()} />)
    expect(screen.getByText('Not yet committed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "I've got it" })).not.toBeInTheDocument()
  })

  it('tapping "I\'ve got it" calls the acknowledge mutation', () => {
    render(<TaskDetailSheet task={uncommittedForViewer} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: "I've got it" }))
    expect(acknowledgeMutate).toHaveBeenCalledWith('t4', expect.anything())
  })

  it('shows neither the badge nor the action once acknowledged', () => {
    render(<TaskDetailSheet task={acknowledgedTask} onClose={vi.fn()} />)
    expect(screen.queryByText('Not yet committed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "I've got it" })).not.toBeInTheDocument()
  })

  it('a "both"-owned task never shows the commitment badge or action', () => {
    render(<TaskDetailSheet task={recurringTask} onClose={vi.fn()} />)
    expect(screen.queryByText('Not yet committed')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "I've got it" })).not.toBeInTheDocument()
  })

  it('strikes the title of a done task (feature 029 US2)', () => {
    render(<TaskDetailSheet task={doneTask} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Renew passport' })).toHaveClass('line-through')
  })

  it('does not strike the title of an open task', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Water the plants' })).not.toHaveClass('line-through')
  })

  it('an open task shows a Mark done action (033 US1, FR-002)', () => {
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Mark Water the plants done' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reopen Water the plants' })).not.toBeInTheDocument()
  })

  it('a done task shows a Reopen action instead', () => {
    render(<TaskDetailSheet task={doneTask} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Reopen Renew passport' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark Renew passport done' })).not.toBeInTheDocument()
  })

  it('tapping Mark done commits immediately and shows an Undo toast (same reversibility as TaskRow)', () => {
    completeMutate.mockImplementationOnce((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Water the plants done' }))
    expect(completeMutate).toHaveBeenCalledWith('t1', expect.anything())
    expect(showUndo).toHaveBeenCalledWith('Done — Water the plants', expect.any(Function), undefined)
  })

  it('Undo re-invokes reopen with the task id', () => {
    completeMutate.mockImplementationOnce((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
    render(<TaskDetailSheet task={openTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Water the plants done' }))
    const onUndo = showUndo.mock.calls.at(-1)?.[1]
    onUndo?.()
    expect(reopenMutate).toHaveBeenCalledWith('t1')
  })

  it('tapping Reopen on a done task calls reopen directly, without an Undo toast', () => {
    render(<TaskDetailSheet task={doneTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reopen Renew passport' }))
    expect(reopenMutate).toHaveBeenCalledWith('t8')
    expect(showUndo).not.toHaveBeenCalled()
  })
})
