import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MonthAgendaDateDots } from './MonthAgendaDateDots'

describe('MonthAgendaDateDots (feature 033 US7, T030 — F-12/FR-022)', () => {
  it('renders nothing for a day with no events', () => {
    const { container } = render(<MonthAgendaDateDots events={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one dot per distinct owner present, in max/jaz/both order', () => {
    render(<MonthAgendaDateDots events={[{ owner: 'jaz' }, { owner: 'max' }, { owner: 'jaz' }]} />)
    const dots = document.querySelectorAll('.rounded-full')
    expect(dots).toHaveLength(2)
    expect(dots[0]).toHaveClass('bg-owner-max')
    expect(dots[1]).toHaveClass('bg-owner-jaz')
  })

  it('shows all three owner colors when max, jaz, and both are all present that day', () => {
    render(<MonthAgendaDateDots events={[{ owner: 'both' }, { owner: 'max' }, { owner: 'jaz' }]} />)
    const dots = document.querySelectorAll('.rounded-full')
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveClass('bg-owner-max')
    expect(dots[1]).toHaveClass('bg-owner-jaz')
    expect(dots[2]).toHaveClass('bg-owner-both')
  })

  it('dedupes multiple events from the same owner into a single dot', () => {
    render(<MonthAgendaDateDots events={[{ owner: 'max' }, { owner: 'max' }, { owner: 'max' }]} />)
    expect(document.querySelectorAll('.rounded-full')).toHaveLength(1)
  })

  it('ignores events with no owner (defensive — dogwalk/dogwalk-flag items always carry one)', () => {
    render(<MonthAgendaDateDots events={[{}, { owner: 'max' }]} />)
    expect(document.querySelectorAll('.rounded-full')).toHaveLength(1)
  })

  it('never renders more than 3 dots — inherent to the 3-member Owner type, not a slice', () => {
    render(<MonthAgendaDateDots events={[{ owner: 'max' }, { owner: 'jaz' }, { owner: 'both' }]} />)
    expect(document.querySelectorAll('.rounded-full')).toHaveLength(3)
  })
})
