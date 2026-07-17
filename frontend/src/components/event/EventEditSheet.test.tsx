import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EventEditSheet } from './EventEditSheet'
import type { Event } from '@/types/domain'

const mutate = vi.fn()
vi.mock('@/hooks/useMutations', () => ({
  useUpdateEvent: () => ({ mutate, isPending: false }),
}))

vi.mock('@/hooks/useTemplates', () => ({
  useTemplates: () => ({
    data: [
      { id: 't1', eventType: 'Trip', taskTitle: 'Pack bags', offsetDays: -1, defaultOwner: 'both' },
      { id: 't2', eventType: 'Party', taskTitle: 'Buy snacks', offsetDays: -2, defaultOwner: 'both' },
    ],
  }),
}))

const baseEvent: Event = {
  id: 'e1',
  title: 'Dentist',
  start: '2026-07-20T14:30',
  end: '2026-07-20T15:30',
  owner: 'jaz',
}

describe('EventEditSheet prep-template picker (feature 029 US5)', () => {
  it('lists the distinct event types from templates, plus a None option', () => {
    render(<EventEditSheet event={baseEvent} onClose={vi.fn()} />)
    const select = screen.getByLabelText('Prep checklist (optional)')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toEqual(['None', 'Party', 'Trip'])
  })

  it('initializes the picker from the event\'s current templateId', () => {
    render(<EventEditSheet event={{ ...baseEvent, templateId: 'Party' }} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Prep checklist (optional)')).toHaveValue('Party')
  })

  it('sends the newly selected templateId on save', () => {
    mutate.mockClear()
    render(<EventEditSheet event={baseEvent} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Prep checklist (optional)'), { target: { value: 'Trip' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1', templateId: 'Trip' }))
  })

  it('sends an empty templateId when switched back to None', () => {
    mutate.mockClear()
    render(<EventEditSheet event={{ ...baseEvent, templateId: 'Party' }} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Prep checklist (optional)'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1', templateId: '' }))
  })
})
