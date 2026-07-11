import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarViewSwitcher } from './CalendarViewSwitcher'

describe('CalendarViewSwitcher', () => {
  it('renders Month, Week, and Next 7 days options', () => {
    render(<CalendarViewSwitcher mode="month" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next 7 days' })).toBeInTheDocument()
  })

  it('marks the active mode with aria-pressed', () => {
    render(<CalendarViewSwitcher mode="week" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the selected mode', () => {
    const onChange = vi.fn()
    render(<CalendarViewSwitcher mode="month" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next 7 days' }))
    expect(onChange).toHaveBeenCalledWith('next7')
  })
})
