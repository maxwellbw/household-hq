import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DayListView } from './DayListView'
import type { EventWithTasks } from '@/lib/tether'
import type { DogWalk, Task } from '@/types/domain'

const TZ = 'America/Los_Angeles'

// Friday 2026-07-10 in America/Los_Angeles (matches lib/datetime.test.ts's fixed clock).
const FIXED_NOW = '2026-07-10T18:00:00Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

const events: EventWithTasks[] = [
  {
    id: 'e1',
    title: 'Dentist',
    start: '2026-07-08T14:30',
    end: '2026-07-08T15:30',
    owner: 'jaz',
    tasks: [],
    openTaskCount: 0,
    totalTaskCount: 0,
    doneTaskCount: 0,
  },
]

const tasks: Task[] = [{ id: 't1', title: 'Water plants', owner: 'max', status: 'open', dueDate: '2026-07-09' }]

describe('DayListView', () => {
  it('renders 7 Sunday-first columns in week mode', () => {
    render(
      <DayListView
        mode="week"
        anchorDate="2026-07-10"
        events={events}
        standaloneTasks={tasks}
        timezone={TZ}
        onItemClick={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    // Week containing Fri 2026-07-10 is Sun 07-05 – Sat 07-11.
    expect(screen.getByText('Sun, Jul 5 – Sat, Jul 11')).toBeInTheDocument()
    expect(screen.getAllByText(/Jul 5/).length).toBeGreaterThan(0)
    expect(screen.getByText('Dentist')).toBeInTheDocument()
    expect(screen.getByText('Water plants')).toBeInTheDocument()
  })

  it('renders today-first columns in next7 mode', () => {
    render(
      <DayListView
        mode="next7"
        anchorDate="2026-07-10"
        events={events}
        standaloneTasks={tasks}
        timezone={TZ}
        onItemClick={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    expect(screen.getByText('Fri, Jul 10 – Thu, Jul 16')).toBeInTheDocument()
  })

  it('renders a single day column in day mode', () => {
    render(
      <DayListView
        mode="day"
        anchorDate="2026-07-08"
        events={events}
        standaloneTasks={[]}
        timezone={TZ}
        onItemClick={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    expect(screen.getByText('Dentist')).toBeInTheDocument()
    expect(screen.queryByText(/Jul 11/)).not.toBeInTheDocument()
  })

  describe('dog-walk items (feature 033 US4, T017/T020)', () => {
    const bookedWalk: DogWalk = {
      id: 'w1',
      date: '2026-07-08',
      slot: 'primary',
      status: 'booked',
      windowStart: '2026-07-08T08:00:00-07:00',
      windowEnd: '2026-07-08T08:30:00-07:00',
      durationMin: 30,
      reason: null,
    }

    const flaggedWalk: DogWalk = {
      id: 'w2',
      date: '2026-07-09',
      slot: 'primary',
      status: 'needs-decision',
      windowStart: null,
      windowEnd: null,
      durationMin: null,
      reason: null,
    }

    it('renders a booked walk item in its date column with its time window', () => {
      render(
        <DayListView
          mode="week"
          anchorDate="2026-07-10"
          events={[]}
          standaloneTasks={[]}
          dogWalks={[bookedWalk]}
          timezone={TZ}
          onItemClick={vi.fn()}
          onNavigate={vi.fn()}
        />,
      )
      expect(screen.getByText('Dog walk')).toBeInTheDocument()
      expect(screen.getByText('8:00 AM–8:30 AM')).toBeInTheDocument()
    })

    it('renders a needs-decision walk flag item in its date column', () => {
      render(
        <DayListView
          mode="week"
          anchorDate="2026-07-10"
          events={[]}
          standaloneTasks={[]}
          dogWalkFlags={[flaggedWalk]}
          timezone={TZ}
          onItemClick={vi.fn()}
          onNavigate={vi.fn()}
        />,
      )
      expect(
        screen.getByText((_, element) => element?.tagName.toLowerCase() === 'span' && element.textContent === 'Dog walk — needs a decision'),
      ).toBeInTheDocument()
    })

    it('tapping a walk item calls onItemClick with the dogwalk item (tap-through to the planner)', () => {
      const onItemClick = vi.fn()
      render(
        <DayListView
          mode="week"
          anchorDate="2026-07-10"
          events={[]}
          standaloneTasks={[]}
          dogWalks={[bookedWalk]}
          timezone={TZ}
          onItemClick={onItemClick}
          onNavigate={vi.fn()}
        />,
      )
      fireEvent.click(screen.getByText('8:00 AM–8:30 AM'))
      expect(onItemClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'dogwalk-w1', kind: 'dogwalk', raw: bookedWalk }),
      )
    })
  })

  describe('done-task collapse (feature 033 US7, T031 — F-16/FR-023)', () => {
    const doneTask: Task = { id: 'd1', title: 'Recycling', owner: 'max', status: 'done', dueDate: '2026-07-08' }
    const openTask: Task = { id: 'o1', title: 'Water plants', owner: 'max', status: 'open', dueDate: '2026-07-08' }

    it('collapses a day of only-done tasks behind an "N done ✓" affordance instead of a struck-through wall', () => {
      render(
        <DayListView
          mode="day"
          anchorDate="2026-07-08"
          events={[]}
          standaloneTasks={[doneTask]}
          timezone={TZ}
          onItemClick={vi.fn()}
          onNavigate={vi.fn()}
        />,
      )
      expect(screen.getByText('1 done ✓')).toBeInTheDocument()
      expect(screen.queryByText('Recycling')).not.toBeInTheDocument()
      expect(screen.queryByText('Nothing scheduled')).not.toBeInTheDocument()
    })

    it('expands the done-task affordance in place on tap', () => {
      render(
        <DayListView
          mode="day"
          anchorDate="2026-07-08"
          events={[]}
          standaloneTasks={[doneTask]}
          timezone={TZ}
          onItemClick={vi.fn()}
          onNavigate={vi.fn()}
        />,
      )
      const toggle = screen.getByRole('button', { name: '1 done ✓' })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText('Recycling')).toBeInTheDocument()
    })

    it('shows open items normally alongside a collapsed done-task affordance', () => {
      // Both due "today" (FIXED_NOW) so the open task's real due date isn't remapped by
      // taskDisplayDateKey's overdue-onto-today rule — keeping it co-located with the done
      // task (whose display date is never remapped, since isOverdue excludes done status).
      const todayDone = { ...doneTask, dueDate: '2026-07-10' }
      const todayOpen = { ...openTask, dueDate: '2026-07-10' }
      render(
        <DayListView
          mode="day"
          anchorDate="2026-07-10"
          events={[]}
          standaloneTasks={[todayDone, todayOpen]}
          timezone={TZ}
          onItemClick={vi.fn()}
          onNavigate={vi.fn()}
        />,
      )
      expect(screen.getByText('Water plants')).toBeInTheDocument()
      expect(screen.getByText('1 done ✓')).toBeInTheDocument()
      expect(screen.queryByText('Recycling')).not.toBeInTheDocument()
    })

    it('tapping a done task inside the expanded affordance still calls onItemClick', () => {
      const onItemClick = vi.fn()
      render(
        <DayListView
          mode="day"
          anchorDate="2026-07-08"
          events={[]}
          standaloneTasks={[doneTask]}
          timezone={TZ}
          onItemClick={onItemClick}
          onNavigate={vi.fn()}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: '1 done ✓' }))
      fireEvent.click(screen.getByText('Recycling'))
      expect(onItemClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1', kind: 'task' }))
    })
  })
})
