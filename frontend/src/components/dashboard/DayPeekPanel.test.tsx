import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DayPeekPanel } from './DayPeekPanel'
import type { DogWalk, Event, Task } from '@/types/domain'

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

const walk: DogWalk = {
  id: 'w1',
  date: '2026-07-11',
  slot: 'primary',
  status: 'booked',
  windowStart: '2026-07-11T11:00:00-07:00',
  windowEnd: '2026-07-11T12:00:00-07:00',
  durationMin: 60,
  reason: null,
}

describe('DayPeekPanel', () => {
  it('renders a labelled region with the long day label', () => {
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[event]}
        tasks={[task]}
        walks={[]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
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
        walks={[]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
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
        walks={[]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
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
        walks={[]}
        timezone={TZ}
        onOpenCalendar={onOpenCalendar}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
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
        walks={[]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={onOpenTask}
        onOpenEvent={onOpenEvent}
        onOpenWalkPlanner={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Dentist'))
    expect(onOpenEvent).toHaveBeenCalledWith(event)
    fireEvent.click(screen.getByText('Buy milk'))
    expect(onOpenTask).toHaveBeenCalledWith(task)
  })

  it('renders a walk row with its time window', () => {
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[]}
        tasks={[]}
        walks={[walk]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
      />,
    )
    expect(screen.getByText('Dog walk')).toBeInTheDocument()
    expect(screen.getByText('11:00 AM–12:00 PM')).toBeInTheDocument()
  })

  it('shows a needs-decision affordance and no time window for a flagged walk', () => {
    const flagged: DogWalk = { ...walk, status: 'needs-decision', windowStart: null, windowEnd: null, reason: 'no-good-weather' }
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[]}
        tasks={[]}
        walks={[flagged]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
      />,
    )
    expect(screen.getByText(/needs a decision/)).toBeInTheDocument()
  })

  it('renders no walk row when there are none, without affecting events/tasks', () => {
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[event]}
        tasks={[task]}
        walks={[]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
      />,
    )
    expect(screen.queryByText('Dog walk')).not.toBeInTheDocument()
    expect(screen.getByText('Dentist')).toBeInTheDocument()
    expect(screen.getByText('Buy milk')).toBeInTheDocument()
  })

  it('calls onOpenWalkPlanner with the dateKey when the walk row is tapped (feature 031)', () => {
    const onOpenWalkPlanner = vi.fn()
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[]}
        tasks={[]}
        walks={[walk]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={onOpenWalkPlanner}
      />,
    )
    fireEvent.click(screen.getByText('Dog walk'))
    expect(onOpenWalkPlanner).toHaveBeenCalledWith('2026-07-11')
  })
})
