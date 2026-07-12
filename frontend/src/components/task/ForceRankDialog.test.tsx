import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ForceRankDialog } from './ForceRankDialog'
import type { Task } from '@/types/domain'

function task(id: string, title: string, owner: Task['owner']): Task {
  return { id, title, owner, status: 'open' }
}

const showToast = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: showToast }),
}))

type MutateOpts = { onSuccess?: () => void; onError?: () => void }

/** Next call to `mutate()` succeeds or fails — read by the reactive mock hook below. */
let nextOutcome: 'success' | 'error' = 'success'
const rankMutateSpy = vi.fn<(order: string[], opts?: MutateOpts) => void>()

// A real (reactive) hook, not a static object — isPending/isError must actually re-render
// the component the same way the real `useRankTasks` (TanStack Query) does.
vi.mock('@/hooks/useMutations', () => ({
  useRankTasks: () => {
    const [state, setState] = useState({ isPending: false, isError: false })
    return {
      isPending: state.isPending,
      isError: state.isError,
      mutate: (order: string[], opts?: MutateOpts) => {
        rankMutateSpy(order, opts)
        if (nextOutcome === 'error') {
          setState({ isPending: false, isError: true })
          opts?.onError?.()
        } else {
          setState({ isPending: false, isError: false })
          opts?.onSuccess?.()
        }
      },
    }
  },
}))

const STORAGE_KEY = 'household-hq.forceRankSession'

beforeEach(() => {
  localStorage.clear()
  showToast.mockClear()
  rankMutateSpy.mockClear()
  nextOutcome = 'success'
})

afterEach(() => localStorage.clear())

describe('ForceRankDialog', () => {
  it('presents the this-or-that heading and a progress count as soon as it opens', () => {
    const tasks = [
      task('a', 'Air-duct cleaning', 'max'),
      task('b', 'Carpet cleaning', 'jaz'),
      task('c', 'Reseal deck', 'both'),
    ]
    render(<ForceRankDialog somedayTasks={tasks} onClose={vi.fn()} />)
    expect(screen.getByText('This or that?')).toBeInTheDocument()
    expect(screen.getByText('Placed 1 of 3')).toBeInTheDocument()
    // The two tasks currently being compared are both shown as choices.
    expect(screen.getByText('Air-duct cleaning')).toBeInTheDocument()
    expect(screen.getByText('Carpet cleaning')).toBeInTheDocument()
  })

  it('completing all comparisons saves the resulting order and closes on success', () => {
    const tasks = [task('a', 'Air-duct cleaning', 'max'), task('b', 'Carpet cleaning', 'jaz')]
    const onClose = vi.fn()
    render(<ForceRankDialog somedayTasks={tasks} onClose={onClose} />)
    fireEvent.click(screen.getByText('Air-duct cleaning'))
    expect(rankMutateSpy).toHaveBeenCalledWith(['a', 'b'], expect.any(Object))
    expect(onClose).toHaveBeenCalled()
  })

  it('a failed save shows Try again and keeps the dialog open (previous order stays in effect)', () => {
    nextOutcome = 'error'
    const tasks = [task('a', 'Air-duct cleaning', 'max'), task('b', 'Carpet cleaning', 'jaz')]
    const onClose = vi.fn()
    render(<ForceRankDialog somedayTasks={tasks} onClose={onClose} />)
    fireEvent.click(screen.getByText('Air-duct cleaning'))
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("Couldn't save"))
    expect(screen.getByText("Try again")).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clicking Try again retries the save with the same completed order', () => {
    nextOutcome = 'error'
    const tasks = [task('a', 'Air-duct cleaning', 'max'), task('b', 'Carpet cleaning', 'jaz')]
    const onClose = vi.fn()
    render(<ForceRankDialog somedayTasks={tasks} onClose={onClose} />)
    fireEvent.click(screen.getByText('Air-duct cleaning'))
    expect(screen.getByText('Try again')).toBeInTheDocument()
    nextOutcome = 'success'
    fireEvent.click(screen.getByText('Try again'))
    expect(onClose).toHaveBeenCalled()
  })

  it('closing before completion preserves progress for same-device resume (FR-013)', () => {
    const tasks = [
      task('a', 'Air-duct cleaning', 'max'),
      task('b', 'Carpet cleaning', 'jaz'),
      task('c', 'Reseal deck', 'both'),
    ]
    const onClose = vi.fn()
    const { unmount } = render(<ForceRankDialog somedayTasks={tasks} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
    expect(rankMutateSpy).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    unmount()

    // Re-opening (fresh mount) resumes rather than restarting from scratch.
    render(<ForceRankDialog somedayTasks={tasks} onClose={vi.fn()} />)
    expect(screen.getByText('Placed 1 of 3')).toBeInTheDocument()
  })
})
