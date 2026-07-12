import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskEditSheet } from './TaskEditSheet'
import type { Task } from '@/types/domain'

const mutateAsync = vi.fn()
vi.mock('@/hooks/useMutations', () => ({
  useUpdateTask: () => ({ mutateAsync, isPending: false }),
}))

const baseTask: Task = {
  id: 't1',
  title: 'Water the plants',
  owner: 'max',
  status: 'open',
  dueDate: '2026-07-22',
} as Task

describe('TaskEditSheet', () => {
  it('blocks submit and shows an error on an empty title, without mutating', async () => {
    mutateAsync.mockClear()
    render(<TaskEditSheet task={baseTask} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Task title'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Give it a title.')
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('saves the new owner when changed', async () => {
    mutateAsync.mockClear()
    mutateAsync.mockResolvedValueOnce({})
    const onClose = vi.fn()
    render(<TaskEditSheet task={baseTask} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /Jaz/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        id: 't1', title: 'Water the plants', owner: 'jaz', dueDate: '2026-07-22', notes: '',
      }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('sends dueDate: "" when Clear date is used', async () => {
    mutateAsync.mockClear()
    mutateAsync.mockResolvedValueOnce({})
    render(<TaskEditSheet task={baseTask} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        id: 't1', title: 'Water the plants', owner: 'max', dueDate: '', notes: '',
      }),
    )
  })

  it('seeds the notes field from the task and submits an edited value', async () => {
    mutateAsync.mockClear()
    mutateAsync.mockResolvedValueOnce({})
    const taskWithNotes = { ...baseTask, notes: 'https://example.com' }
    render(<TaskEditSheet task={taskWithNotes} onClose={vi.fn()} />)
    const textarea = screen.getByPlaceholderText('Add a note — links are tappable')
    expect(textarea).toHaveValue('https://example.com')
    fireEvent.change(textarea, { target: { value: 'https://example.com updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        id: 't1', title: 'Water the plants', owner: 'max', dueDate: '2026-07-22',
        notes: 'https://example.com updated',
      }),
    )
  })

  it('fires no mutation on Cancel/close', () => {
    mutateAsync.mockClear()
    const onClose = vi.fn()
    render(<TaskEditSheet task={baseTask} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(mutateAsync).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
