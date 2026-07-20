import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DayPeekPanel } from './DayPeekPanel'
import type { DogWalk, Event, Task } from '@/types/domain'

const completeMutate = vi.fn()
const reopenMutate = vi.fn()
vi.mock('@/hooks/useMutations', () => ({
  useCompleteTask: () => ({ mutate: completeMutate }),
  useReopenTask: () => ({ mutate: reopenMutate }),
}))

const showToast = vi.fn()
const showUndo = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: showToast, showUndo }),
}))

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('styles a needs-decision walk as urgent, not a quiet muted note (feature 033 US4/T019, FR-012)', () => {
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
    expect(screen.getByLabelText('Needs a decision')).toHaveClass('text-warning')
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

  it('tapping the task toggle completes it without opening the detail sheet (033 US1)', () => {
    const onOpenTask = vi.fn()
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[]}
        tasks={[task]}
        walks={[]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={onOpenTask}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mark Buy milk done' }))
    expect(completeMutate).toHaveBeenCalledWith('t1', expect.anything())
    expect(onOpenTask).not.toHaveBeenCalled()
  })

  it('the row tap (title) still opens the detail sheet, unaffected by the toggle', () => {
    const onOpenTask = vi.fn()
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[]}
        tasks={[task]}
        walks={[]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={onOpenTask}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Buy milk'))
    expect(onOpenTask).toHaveBeenCalledWith(task)
    expect(completeMutate).not.toHaveBeenCalled()
  })

  it('a done task shows Reopen on its toggle and reopens directly, no undo toast', () => {
    const doneTask: Task = { ...task, status: 'done' }
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[]}
        tasks={[doneTask]}
        walks={[]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reopen Buy milk' }))
    expect(reopenMutate).toHaveBeenCalledWith('t1')
    expect(showUndo).not.toHaveBeenCalled()
  })

  it('event and walk rows never render a complete toggle (only tasks are completable)', () => {
    render(
      <DayPeekPanel
        dateKey="2026-07-11"
        events={[event]}
        tasks={[]}
        walks={[walk]}
        timezone={TZ}
        onOpenCalendar={vi.fn()}
        onOpenTask={vi.fn()}
        onOpenEvent={vi.fn()}
        onOpenWalkPlanner={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button', { name: /^(Mark|Reopen)/ })).not.toBeInTheDocument()
  })
})
