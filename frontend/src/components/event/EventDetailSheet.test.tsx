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
  useUpdateEvent: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useAcknowledgeTask: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
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

describe('EventDetailSheet — notes and location (019 US3/US4)', () => {
  it('renders notes with a tappable link', () => {
    const event = { ...makeEvent([]), notes: 'Reservation: https://example.com/res' }
    render(<EventDetailSheet event={event} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: 'https://example.com/res' })
    expect(link).toHaveAttribute('href', 'https://example.com/res')
  })

  it('shows no notes paragraph when the event has no notes', () => {
    render(<EventDetailSheet event={makeEvent([])} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('displays the location when set', () => {
    const event = { ...makeEvent([]), location: '123 Main St' }
    render(<EventDetailSheet event={event} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
  })

  it('shows no location line when unset', () => {
    render(<EventDetailSheet event={makeEvent([])} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    expect(screen.queryByText('123 Main St')).not.toBeInTheDocument()
  })
})

describe('EventDetailSheet — location link and Delete separation (feature 033 US7, T032/FR-024)', () => {
  it('renders a URL location as a labeled "Open map ↗" link, not the raw URL', () => {
    const event = { ...makeEvent([]), location: 'https://maps.example.com/?q=123+Main+St' }
    render(<EventDetailSheet event={event} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: /Open map/ })
    expect(link).toHaveAttribute('href', 'https://maps.example.com/?q=123+Main+St')
    expect(screen.queryByText('https://maps.example.com/?q=123+Main+St')).not.toBeInTheDocument()
  })

  it('keeps a plain-text location as plain text (no link)', () => {
    const event = { ...makeEvent([]), location: '123 Main St' }
    render(<EventDetailSheet event={event} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open map/ })).not.toBeInTheDocument()
  })

  it('keeps Delete out of the header, in its own separated section from Edit', () => {
    render(<EventDetailSheet event={makeEvent([])} timezone="America/Los_Angeles" onClose={vi.fn()} />)
    const editButton = screen.getByRole('button', { name: 'Edit event' })
    const deleteButton = screen.getByRole('button', { name: 'Delete event' })
    // Not siblings: Delete lives in a later section of the sheet, not the header button
    // cluster Edit/Close share (guards against a regression back into one tight row).
    expect(editButton.parentElement).not.toBe(deleteButton.parentElement)
  })
})
