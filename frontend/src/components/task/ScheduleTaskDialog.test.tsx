import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ScheduleTaskDialog } from './ScheduleTaskDialog'
import type { Task } from '@/types/domain'

const mutateAsync = vi.fn().mockResolvedValue(undefined)
const showToast = vi.fn()

vi.mock('@/hooks/useDialogA11y', () => ({ useDialogA11y: () => {} }))
vi.mock('@/hooks/useMutations', () => ({
  useScheduleTask: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ timezone: 'America/Los_Angeles' }),
}))
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: showToast }),
}))

const somedayTasks: Task[] = [
  { id: 't1', title: 'Fix the fence', owner: 'jaz', status: 'open' } as Task,
]
vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({ data: somedayTasks }),
}))

beforeEach(() => {
  mutateAsync.mockClear()
  showToast.mockClear()
})

describe('ScheduleTaskDialog — owner pre-seed (034 US2)', () => {
  it("pre-selects the task's current owner so scheduling needs only a date", () => {
    render(<ScheduleTaskDialog taskId="t1" onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Jaz/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Max/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('honors an explicit initialOwner override', () => {
    render(<ScheduleTaskDialog taskId="t1" initialOwner="max" onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Max/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('still requires a date: Schedule is disabled with owner seeded but no date, enabled after picking one', () => {
    render(<ScheduleTaskDialog taskId="t1" onClose={vi.fn()} />)
    const confirm = screen.getByRole('button', { name: 'Schedule' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-25' } })
    expect(confirm).not.toBeDisabled()
  })

  it('schedules with the seeded owner and chosen date', async () => {
    const onClose = vi.fn()
    render(<ScheduleTaskDialog taskId="t1" onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(mutateAsync).toHaveBeenCalledWith({ taskId: 't1', date: '2026-07-25', owner: 'jaz' })
  })
})
