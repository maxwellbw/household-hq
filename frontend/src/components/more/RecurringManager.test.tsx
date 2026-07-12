import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecurringManager } from './RecurringManager'
import type { RecurringRule } from '@/types/domain'

const groomingRule: RecurringRule = {
  id: 'r1',
  title: 'Grooming',
  cadence: 'eightweekly',
  anchorDate: '2026-07-10',
  defaultOwner: 'both',
  lastGenerated: '',
}

vi.mock('@/hooks/useRecurring', () => ({
  useRecurring: () => ({ data: [groomingRule], isPending: false, isError: false }),
  useCreateRecurringRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecurringRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRecurringRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

describe('RecurringManager cadence support (feature 023)', () => {
  it('displays the "every eight weeks" label for a rule seeded with the eightweekly cadence', () => {
    render(<RecurringManager />)
    expect(screen.getByText(/every eight weeks/i)).toBeInTheDocument()
  })

  it('offers "every six weeks" and "every eight weeks" as selectable cadences in the rule form', () => {
    render(<RecurringManager />)
    fireEvent.click(screen.getByRole('button', { name: /add recurring rule/i }))

    // Cadence is the first <select> in the form (before the two season-month selects).
    const cadenceSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement
    const optionLabels = Array.from(cadenceSelect.options).map((o) => o.textContent)
    expect(optionLabels).toContain('Every six weeks')
    expect(optionLabels).toContain('Every eight weeks')
  })
})
