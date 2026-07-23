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

const showToast = vi.fn()
const showUndo = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: showToast, showUndo }),
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

describe('TaskRow — acknowledge/commit (019 US2, redesigned as a single chip per 028 R7)', () => {
  it('shows a tappable "I\'ve got it" chip when the viewer is the uncommitted assignee', () => {
    mockIdentity = 'max'
    render(<TaskRow task={task({ id: 't1', owner: 'max', status: 'open' })} timezone="America/Los_Angeles" />)
    const chip = screen.getByRole('button', { name: /Not yet committed — tap to confirm/ })
    expect(chip).toHaveTextContent("I've got it")
  })

  it('shows a non-interactive "Not yet committed" chip when the viewer is the assigner (visibility rule unchanged)', () => {
    mockIdentity = 'jaz'
    render(<TaskRow task={task({ id: 't1', owner: 'max', status: 'open' })} timezone="America/Los_Angeles" />)
    expect(screen.getByText('Not yet committed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Not yet committed|I've got it/ })).not.toBeInTheDocument()
  })

  it('tapping the chip acknowledges the task', () => {
    mockIdentity = 'max'
    render(<TaskRow task={task({ id: 't1', owner: 'max', status: 'open' })} timezone="America/Los_Angeles" />)
    fireEvent.click(screen.getByRole('button', { name: /Not yet committed — tap to confirm/ }))
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

describe('TaskRow — completing is undoable, not confirmed (feature 032 US3, contract C3)', () => {
  it('completing commits immediately and shows an Undo toast instead of a plain one', () => {
    showToast.mockClear()
    completeMutate.mockImplementationOnce((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
    render(<TaskRow task={task({ id: 't1', title: 'Water the plants', status: 'open' })} timezone="America/Los_Angeles" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Water the plants done' }))
    expect(completeMutate).toHaveBeenCalledWith('t1', expect.anything())
    expect(showUndo).toHaveBeenCalledWith('Done — Water the plants', expect.any(Function), undefined)
    expect(showToast).not.toHaveBeenCalled()
  })

  it("Undo re-invokes reopen with the task's id", () => {
    completeMutate.mockImplementationOnce((_id: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.())
    render(<TaskRow task={task({ id: 't1', title: 'Water the plants', status: 'open' })} timezone="America/Los_Angeles" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Water the plants done' }))
    const onUndo = showUndo.mock.calls.at(-1)?.[1]
    onUndo?.()
    expect(reopenMutate).toHaveBeenCalledWith('t1')
  })

  it('reopening a done task (checkbox tap) calls reopen directly, without an Undo toast', () => {
    render(<TaskRow task={task({ id: 't1', title: 'Water the plants', status: 'done' })} timezone="America/Los_Angeles" />)
    fireEvent.click(screen.getByRole('button', { name: 'Reopen Water the plants' }))
    expect(reopenMutate).toHaveBeenCalledWith('t1')
  })
})

describe('TaskRow — overflow menu renders only wired actions (034 US2)', () => {
  it('omits the ⋮ trigger entirely when no menu actions are wired (e.g. a someday row before wiring)', () => {
    render(<TaskRow task={task({ id: 't1', title: 'Park it', status: 'open' })} timezone="America/Los_Angeles" />)
    expect(screen.queryByRole('button', { name: /More options/ })).not.toBeInTheDocument()
  })

  it('shows a working Schedule item and no dead Snooze/Edit-due when only onSchedule is wired', () => {
    const onSchedule = vi.fn()
    render(
      <TaskRow task={task({ id: 't1', title: 'Park it', status: 'open' })} timezone="America/Los_Angeles" onSchedule={onSchedule} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'More options for Park it' }))
    expect(screen.getByRole('menuitem', { name: 'Schedule' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Snooze' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Edit due' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Schedule' }))
    expect(onSchedule).toHaveBeenCalledTimes(1)
  })

  it('shows Snooze and Edit due (and no Schedule) for a dated open row', () => {
    render(
      <TaskRow
        task={task({ id: 't1', title: 'Do it', status: 'open', dueDate: '2026-07-25' })}
        timezone="America/Los_Angeles"
        onSnooze={vi.fn()}
        onEditDue={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'More options for Do it' }))
    expect(screen.getByRole('menuitem', { name: 'Snooze' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Edit due' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Schedule' })).not.toBeInTheDocument()
  })
})
