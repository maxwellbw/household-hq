import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OverdueSection } from './OverdueSection'
import type { Task } from '@/types/domain'

vi.mock('@/hooks/useMutations', () => ({
  useCompleteTask: () => ({ mutate: vi.fn() }),
  useReopenTask: () => ({ mutate: vi.fn() }),
  useAcknowledgeTask: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: {
      token: 'tok',
      who: { identity: 'max', displayName: 'Max', email: 'max@test.com', needsActingPerson: false },
      actingPerson: undefined,
    },
  }),
}))

const TZ = 'America/Los_Angeles'

function makeTask(id: string, dueDate: string): Task {
  return { id, title: `Task ${id}`, owner: 'max', status: 'open', dueDate }
}

describe('OverdueSection', () => {
  it('renders nothing when there are no overdue tasks', () => {
    const { container } = render(<OverdueSection tasks={[]} timezone={TZ} onViewAll={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the Overdue heading and up to 5 rows, capped', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => makeTask(`t${i}`, '2026-07-01'))
    render(<OverdueSection tasks={tasks} timezone={TZ} onViewAll={vi.fn()} />)
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'View all 8 in Tasks' })).toBeInTheDocument()
  })

  it('calls onViewAll when the link is tapped', () => {
    const onViewAll = vi.fn()
    render(<OverdueSection tasks={[makeTask('t1', '2026-07-01')]} timezone={TZ} onViewAll={onViewAll} />)
    fireEvent.click(screen.getByRole('button', { name: /View all/ }))
    expect(onViewAll).toHaveBeenCalledTimes(1)
  })
})
