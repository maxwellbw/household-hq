import { render, screen, fireEvent, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventDetailSheet } from './EventDetailSheet'
import type { EventWithTasks } from '@/lib/tether'
import type { Task } from '@/types/domain'

const deleteMutate = vi.fn((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
vi.mock('@/hooks/useMutations', () => ({
  useDeleteEvent: () => ({ mutate: deleteMutate, isPending: false }),
  useCompleteTask: () => ({ mutate: vi.fn() }),
  useReopenTask: () => ({ mutate: vi.fn() }),
  useUpdateEvent: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

const prepTask: Task = {
  id: 't1',
  title: 'Buy gift',
  owner: 'max',
  status: 'open',
  eventId: 'e1',
  dueDate: '2026-07-18',
} as Task

function makeEvent(tasks: Task[]): EventWithTasks {
  return {
    id: 'e1',
    title: 'Birthday party',
    start: '2026-07-20T14:00',
    end: '2026-07-20T16:00',
    owner: 'both',
    tasks,
    openTaskCount: tasks.filter((t) => t.status === 'open').length,
    totalTaskCount: tasks.length,
    doneTaskCount: tasks.filter((t) => t.status === 'done').length,
  }
}

describe('EventDetailSheet — delete (022 US2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tapping Delete opens a confirmation dialog', () => {
    render(<EventDetailSheet event={makeEvent([])} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }))
    expect(screen.getByRole('dialog', { name: 'Delete event?' })).toBeInTheDocument()
  })

  it('shows the exact prep-task count when the event has prep tasks', () => {
    render(<EventDetailSheet event={makeEvent([prepTask])} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }))
    expect(screen.getByText('Its 1 prep task will also be removed.')).toBeInTheDocument()
  })

  it('pluralizes the prep-task count for more than one', () => {
    const second = { ...prepTask, id: 't2', title: 'Book venue' }
    render(<EventDetailSheet event={makeEvent([prepTask, second])} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }))
    expect(screen.getByText('Its 2 prep tasks will also be removed.')).toBeInTheDocument()
  })

  it('omits the prep-task clause when the event has no prep tasks', () => {
    render(<EventDetailSheet event={makeEvent([])} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete event?' })
    expect(within(dialog).queryByText(/prep task/)).not.toBeInTheDocument()
  })

  it('confirming delete calls the delete mutation and closes the sheet', () => {
    const onClose = vi.fn()
    render(<EventDetailSheet event={makeEvent([])} timezone="America/Los_Angeles" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteMutate).toHaveBeenCalledWith('e1', expect.anything())
    expect(onClose).toHaveBeenCalled()
  })

  it('cancelling the delete confirmation deletes nothing', () => {
    render(<EventDetailSheet event={makeEvent([])} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete event' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteMutate).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Delete event?' })).not.toBeInTheDocument()
  })
})
