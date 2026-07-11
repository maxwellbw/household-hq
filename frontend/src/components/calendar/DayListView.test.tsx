import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DayListView } from './DayListView'
import type { EventWithTasks } from '@/lib/tether'
import type { Task } from '@/types/domain'

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
})
