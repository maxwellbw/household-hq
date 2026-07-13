import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DayPeekPanel } from './DayPeekPanel'
import type { Event, Task } from '@/types/domain'

const TZ = 'America/Los_Angeles'

const event: Event = {
  id: 'e1',
  title: 'Dentist',
  start: '2026-07-11T14:30',
  end: '2026-07-11T15:30',
  owner: 'jaz',
}

const task: Task = {
  id: 't1',
  title: 'Buy milk',
  owner: 'max',
  status: 'open',
  dueDate: '2026-07-11',
}

describe('DayPeekPanel', () => {
  it('renders a labelled region with the long day label', () => {
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[event]}
        tasks={[task]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
      />,
    )
    expect(screen.getByRole('region', { name: /Saturday, July 11/ })).toBeInTheDocument()
  })

  it('renders events and tasks for the day', () => {
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[event]}
        tasks={[task]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
      />,
    )
    expect(screen.getByText('Dentist')).toBeInTheDocument()
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
  })

  it('shows a friendly empty state when there are no items', () => {
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[]}
        tasks={[]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
      />,
    )
    expect(screen.getByText('Nothing on this day.')).toBeInTheDocument()
  })

  it('calls onOpenCalendar with the dateKey when the link is tapped', () => {
    const onOpenCalendar = vi.fn()
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[]}
        tasks={[]}
        timezone={TZ}
        onOpenCalendar={onOpenCalendar}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open in calendar' }))
    expect(onOpenCalendar).toHaveBeenCalledWith('2026-07-11')
  })

  it('calls onOpenEvent/onOpenTask when an item row is tapped', () => {
    const onOpenEvent = vi.fn()
    const onOpenTask = vi.fn()
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[event]}
        tasks={[task]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={onOpenTask}
        onOpenEvent={onOpenEvent}
      />,
    )
    fireEvent.click(screen.getByText('Dentist'))
    expect(onOpenEvent).toHaveBeenCalledWith(event)
    fireEvent.click(screen.getByText('Buy milk'))
    expect(onOpenTask).toHaveBeenCalledWith(task)
  })
})
