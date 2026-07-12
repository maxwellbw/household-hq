import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RecurringEventsManager } from './RecurringEventsManager'
import type { RecurringEventRule, TaskTemplate } from '@/types/domain'

const birthdayRule: RecurringEventRule = {
  id: 'e1',
  title: "Mom's birthday",
  cadence: 'annually',
  anchorDate: '2026-08-01',
  defaultOwner: 'both',
  lastGenerated: '',
}

const checkupRule: RecurringEventRule = {
  id: 'e2',
  title: 'Annual checkup',
  cadence: 'annually',
  anchorDate: '2026-03-10',
  startTime: '09:30',
  durationMinutes: '60',
  defaultOwner: 'max',
  lastGenerated: '',
}

const birthdayTemplateStep: TaskTemplate = {
  id: 't1', eventType: 'birthday', taskTitle: 'Buy gift', offsetDays: -14, defaultOwner: 'both',
}

const createMock = vi.fn()
const updateMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/hooks/useRecurringEvents', () => ({
  useRecurringEvents: () => ({ data: [birthdayRule, checkupRule], isPending: false, isError: false }),
  useCreateRecurringEventRule: () => ({ mutateAsync: createMock, isPending: false }),
  useUpdateRecurringEventRule: () => ({ mutateAsync: updateMock, isPending: false }),
  useDeleteRecurringEventRule: () => ({ mutateAsync: deleteMock, isPending: false }),
}))

vi.mock('@/hooks/useTemplates', () => ({
  useTemplates: () => ({ data: [birthdayTemplateStep] }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

describe('RecurringEventsManager (feature 025)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists existing rules with all-day vs timed labels', () => {
    render(<RecurringEventsManager />)
    expect(screen.getByText(/mom's birthday/i)).toBeInTheDocument()
    expect(screen.getByText(/all-day/i)).toBeInTheDocument()
    expect(screen.getByText(/annual checkup/i)).toBeInTheDocument()
    expect(screen.getByText(/09:30/)).toBeInTheDocument()
  })

  it('creates an all-day rule with a prep template when no time is set', async () => {
    render(<RecurringEventsManager />)
    fireEvent.click(screen.getByRole('button', { name: /add recurring event/i }))

    fireEvent.change(screen.getByPlaceholderText(/mom's birthday/i), { target: { value: "Dad's birthday" } })
    fireEvent.change(screen.getByLabelText(/anchor date/i), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText(/prep checklist/i), { target: { value: 'birthday' } })

    fireEvent.click(screen.getByRole('button', { name: /^add recurring event$/i }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    const payload = createMock.mock.calls[0][0]
    expect(payload.title).toBe("Dad's birthday")
    expect(payload.templateId).toBe('birthday')
    expect(payload.startTime).toBeUndefined()
  })

  it('creates a timed rule when a time is set', async () => {
    render(<RecurringEventsManager />)
    fireEvent.click(screen.getByRole('button', { name: /add recurring event/i }))

    fireEvent.change(screen.getByPlaceholderText(/mom's birthday/i), { target: { value: 'Dentist' } })
    fireEvent.change(screen.getByLabelText(/anchor date/i), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '10:00' } })

    fireEvent.click(screen.getByRole('button', { name: /^add recurring event$/i }))

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    const payload = createMock.mock.calls[0][0]
    expect(payload.startTime).toBe('10:00')
    expect(payload.durationMinutes).toBe('60')
  })

  it('edits an existing rule', async () => {
    render(<RecurringEventsManager />)
    fireEvent.click(screen.getByRole('button', { name: /edit mom's birthday/i }))
    expect(screen.getByRole('heading', { name: /edit recurring event/i })).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue("Mom's birthday"), { target: { value: "Mom's bday (renamed)" } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock.mock.calls[0][0]).toMatchObject({ id: 'e1', title: "Mom's bday (renamed)" })
  })

  it('requires a confirm step before deleting a rule', async () => {
    render(<RecurringEventsManager />)
    fireEvent.click(screen.getByRole('button', { name: /delete mom's birthday/i }))
    expect(screen.getByText(/mom's birthday/i, { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
    expect(deleteMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('e1'))
  })

  it('shows a field error when the title is blank', () => {
    render(<RecurringEventsManager />)
    fireEvent.click(screen.getByRole('button', { name: /add recurring event/i }))
    fireEvent.click(screen.getByRole('button', { name: /^add recurring event$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/give it a title/i)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('shows a field error when only one season month is set', () => {
    render(<RecurringEventsManager />)
    fireEvent.click(screen.getByRole('button', { name: /add recurring event/i }))
    fireEvent.change(screen.getByPlaceholderText(/mom's birthday/i), { target: { value: 'Filter check' } })
    fireEvent.change(screen.getByLabelText(/anchor date/i), { target: { value: '2026-09-01' } })

    const seasonSelects = screen.getAllByRole('combobox').slice(-2)
    fireEvent.change(seasonSelects[0], { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: /^add recurring event$/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/set both season months or neither/i)
    expect(createMock).not.toHaveBeenCalled()
  })
})
