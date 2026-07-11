import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventContent } from './EventContent'
import type { EventWithTasks } from '@/lib/tether'
import type { Event, Task } from '@/types/domain'

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
})
