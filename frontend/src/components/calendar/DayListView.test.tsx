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
})
