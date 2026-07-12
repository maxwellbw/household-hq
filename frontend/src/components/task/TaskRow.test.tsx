import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskRow } from './TaskRow'
import type { Task } from '@/types/domain'

const completeMutate = vi.fn()
const reopenMutate = vi.fn()
const acknowledgeMutate = vi.fn((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
vi.mock('@/hooks/useMutations', () => ({
  useCompleteTask: () => ({ mutate: completeMutate }),
  useReopenTask: () => ({ mutate: reopenMutate }),
  useAcknowledgeTask: () => ({ mutate: acknowledgeMutate, isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

let mockIdentity: 'max' | 'jaz' = 'max'
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: {
      token: 'tok',
      who: { identity: mockIdentity, displayName: mockIdentity, email: `${mockIdentity}@test.com`, needsActingPerson: false },
      actingPerson: undefined,
    },
  }),
}))

function task(overrides: Partial<Task> & { id: string }): Task {
  return { title: 'Task', owner: 'both', status: 'open', ...overrides } as Task
}

describe('TaskRow — acknowledge/commit (019 US2)', () => {
  it('shows the "Not yet committed" badge and action when the viewer is the uncommitted assignee', () => {
    mockIdentity = 'max'
    render(<TaskRow task={task({ id: 't1', owner: 'max', status: 'open' })} timezone="America/Los_Angeles" />)
    expect(screen.getByText('Not yet committed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "I've got it" })).toBeInTheDocument()
  })

  it('shows the badge but no action when the viewer is the assigner', () => {
    mockIdentity = 'jaz'
    render(<TaskRow task={task({ id: 't1', owner: 'max', status: 'open' })} timezone="America/Los_Angeles" />)
    expect(screen.getByText('Not yet committed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "I've got it" })).not.toBeInTheDocument()
  })

  it('tapping "I\'ve got it" acknowledges the task', () => {
    mockIdentity = 'max'
    render(<TaskRow task={task({ id: 't1', owner: 'max', status: 'open' })} timezone="America/Los_Angeles" />)
    fireEvent.click(screen.getByRole('button', { name: "I've got it" }))
    expect(acknowledgeMutate).toHaveBeenCalledWith('t1', expect.anything())
  })

  it('shows no badge once acknowledged', () => {
    mockIdentity = 'max'
    render(
      <TaskRow
        task={task({ id: 't1', owner: 'max', status: 'open', ackBy: 'max' })}
        timezone="America/Los_Angeles"
      />,
    )
    expect(screen.queryByText('Not yet committed')).not.toBeInTheDocument()
  })

  it('shows no badge for a "both"-owned task', () => {
    mockIdentity = 'max'
    render(<TaskRow task={task({ id: 't1', owner: 'both', status: 'open' })} timezone="America/Los_Angeles" />)
    expect(screen.queryByText('Not yet committed')).not.toBeInTheDocument()
  })
})
