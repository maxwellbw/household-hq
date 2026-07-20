import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventContent } from './EventContent'
import type { EventWithTasks } from '@/lib/tether'
import type { DogWalk, Event, Task } from '@/types/domain'

const baseEvent: Event = {
  id: 'e1',
  title: 'Dentist',
  start: '2026-07-20T14:30',
  end: '2026-07-20T15:30',
  owner: 'jaz',
}

const withTasks = (doneTaskCount: number, totalTaskCount: number): EventWithTasks => ({
  ...baseEvent,
  tasks: [],
  openTaskCount: totalTaskCount - doneTaskCount,
  doneTaskCount,
  totalTaskCount,
})

const overdueTask: Task = { id: 't1', title: 'Water plants', owner: 'max', status: 'open', dueDate: '2026-07-01' }
const doneTask: Task = { id: 't2', title: 'Water plants', owner: 'max', status: 'done', dueDate: '2026-07-20' }

describe('EventContent', () => {
  it('shows "M/N tasks" when the event has prep tasks', () => {
    render(
      <EventContent
        calendarEvent={{ id: 'e1', title: 'Dentist', owner: 'jaz', _raw: withTasks(2, 5), _kind: 'event' }}
      />,
    )
    expect(screen.getByText('2/5 tasks')).toBeInTheDocument()
  })

  it('shows no progress indicator when the event has no prep tasks', () => {
    render(
      <EventContent
        calendarEvent={{ id: 'e1', title: 'Dentist', owner: 'jaz', _raw: withTasks(0, 0), _kind: 'event' }}
      />,
    )
    expect(screen.queryByText(/tasks$/)).not.toBeInTheDocument()
  })

  it('shows "N/N tasks" when all prep tasks are complete', () => {
    render(
      <EventContent
        calendarEvent={{ id: 'e1', title: 'Dentist', owner: 'jaz', _raw: withTasks(3, 3), _kind: 'event' }}
      />,
    )
    expect(screen.getByText('3/3 tasks')).toBeInTheDocument()
  })

  it('renders an Overdue badge on a task chip flagged _overdue', () => {
    render(
      <EventContent
        calendarEvent={{
          id: 't1',
          title: 'Water plants',
          owner: 'max',
          _raw: overdueTask,
          _kind: 'task',
          _overdue: true,
        }}
      />,
    )
    expect(screen.getByText('Overdue')).toBeInTheDocument()
  })

  it('does not render an Overdue badge for a non-overdue task', () => {
    render(
      <EventContent
        calendarEvent={{ id: 't1', title: 'Water plants', owner: 'max', _raw: overdueTask, _kind: 'task' }}
      />,
    )
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
    expect(screen.getByText('Task')).toBeInTheDocument()
  })

  it('renders a needs-decision dog-walk marker with a plain-English reason (feature 011)', () => {
    render(
      <EventContent
        calendarEvent={{ id: 'dogwalk-flag-1', title: 'Dog walk — needs a decision', _kind: 'dogwalk-flag', _reason: 'no-good-weather' }}
      />,
    )
    expect(screen.getByText('Dog walk')).toBeInTheDocument()
    expect(screen.getByText(/weather/)).toBeInTheDocument()
  })

  it('falls back to a generic reason for an unknown needs-decision reason (feature 011)', () => {
    render(
      <EventContent
        calendarEvent={{ id: 'dogwalk-flag-2', title: 'Dog walk — needs a decision', _kind: 'dogwalk-flag', _reason: 'something-else' }}
      />,
    )
    expect(screen.getByText(/needs a decision/)).toBeInTheDocument()
  })

  it('strikes a done task chip title (feature 029 US2)', () => {
    render(
      <EventContent
        calendarEvent={{ id: 't2', title: 'Water plants', owner: 'max', _raw: doneTask, _kind: 'task' }}
      />,
    )
    expect(screen.getByText('Water plants')).toHaveClass('line-through')
  })

  it('does not strike an open or overdue task chip title', () => {
    render(
      <EventContent
        calendarEvent={{ id: 't1', title: 'Water plants', owner: 'max', _raw: overdueTask, _kind: 'task', _overdue: true }}
      />,
    )
    expect(screen.getByText('Water plants')).not.toHaveClass('line-through')
  })

  describe('title-priority layout (feature 033 US7, T029 — badge yields before title reads zero chars)', () => {
    it('gives the Task badge a much higher shrink factor than the title so it yields first', () => {
      render(
        <EventContent
          calendarEvent={{ id: 't1', title: 'Water plants', owner: 'max', _raw: overdueTask, _kind: 'task' }}
        />,
      )
      expect(screen.getByText('Task')).toHaveClass('shrink-[9999]')
      expect(screen.getByText('Water plants')).toHaveClass('min-w-0')
    })

    it('gives the Overdue badge a much higher shrink factor than the title so it yields first', () => {
      render(
        <EventContent
          calendarEvent={{ id: 't1', title: 'Water plants', owner: 'max', _raw: overdueTask, _kind: 'task', _overdue: true }}
        />,
      )
      expect(screen.getByText('Overdue')).toHaveClass('shrink-[9999]')
    })

    it('gives the dog-walk time badge a much higher shrink factor than the title so it yields first', () => {
      const walk: DogWalk = { id: 'w1', date: '2026-07-20', slot: 'primary', status: 'booked', windowStart: '2026-07-20T08:00:00-07:00', windowEnd: '2026-07-20T08:30:00-07:00', durationMin: 30, reason: null }
      render(
        <EventContent
          calendarEvent={{ id: 'dogwalk-w1', title: 'Dog walk', _raw: walk, _kind: 'dogwalk' }}
        />,
      )
      expect(screen.getByText('8:00 AM–8:30 AM')).toHaveClass('shrink-[9999]')
      expect(screen.getByText('Dog walk')).toHaveClass('min-w-0')
    })
  })
})
