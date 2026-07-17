import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuickAddSheet } from './QuickAddSheet'

const createEventMutate = vi.fn()
const createTaskMutate = vi.fn()
const createRecurringMutateAsync = vi.fn()

vi.mock('@/hooks/useMutations', () => ({
  useCreateEvent: () => ({ mutate: createEventMutate, isPending: false }),
  useCreateOneTimeTask: () => ({ mutate: createTaskMutate, isPending: false }),
  useCreateRecurring: () => ({ mutateAsync: createRecurringMutateAsync, isPending: false }),
}))

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'America/Los_Angeles' }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ session: { who: { identity: 'max' } } }),
}))

vi.mock('@/hooks/useTemplates', () => ({
  useTemplates: () => ({
    data: [
      { id: 't1', eventType: 'Trip', taskTitle: 'Pack bags', offsetDays: -1, defaultOwner: 'both' },
      { id: 't2', eventType: 'Party', taskTitle: 'Buy snacks', offsetDays: -2, defaultOwner: 'both' },
    ],
  }),
}))

describe('QuickAddSheet (fire-and-close save, R2/US2)', () => {
  it('closes immediately on a one-time task save without waiting for the mutation to resolve', () => {
    // A mutate that never resolves — proves the sheet doesn't await it.
    createTaskMutate.mockReset()
    const onClose = vi.fn()
    render(<QuickAddSheet onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'One-time task' }))
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Buy milk' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(createTaskMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Buy milk' }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('closes immediately on an event save without waiting for the mutation to resolve', () => {
    createEventMutate.mockReset()
    const onClose = vi.fn()
    render(<QuickAddSheet onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Dentist' } })
    const [dateInput] = screen.getAllByDisplayValue('')
    fireEvent.change(dateInput, { target: { value: '2026-07-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(createEventMutate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dentist' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('QuickAddSheet prep-template picker (feature 029 US5)', () => {
  it('lists the distinct event types from templates, plus a None option', () => {
    render(<QuickAddSheet onClose={vi.fn()} />)
    const select = screen.getByLabelText('Prep checklist (optional)')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toEqual(['None', 'Party', 'Trip'])
  })

  it('sends the selected template as templateId on the create payload', () => {
    createEventMutate.mockReset()
    const onClose = vi.fn()
    render(<QuickAddSheet onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Dentist' } })
    const [dateInput] = screen.getAllByDisplayValue('')
    fireEvent.change(dateInput, { target: { value: '2026-07-20' } })
    fireEvent.change(screen.getByLabelText('Prep checklist (optional)'), { target: { value: 'Trip' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(createEventMutate).toHaveBeenCalledWith(expect.objectContaining({ templateId: 'Trip' }))
  })

  it('omits templateId when None is left selected', () => {
    createEventMutate.mockReset()
    render(<QuickAddSheet onClose={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Dentist' } })
    const [dateInput] = screen.getAllByDisplayValue('')
    fireEvent.change(dateInput, { target: { value: '2026-07-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(createEventMutate).toHaveBeenCalledWith(expect.objectContaining({ templateId: undefined }))
  })
})
