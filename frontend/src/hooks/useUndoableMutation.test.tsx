import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useUndoableMutation } from '@/hooks/useUndoableMutation'
import { ToastProvider } from '@/hooks/useToast'

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

function mutationLike(impl?: (variables: unknown, options?: { onSuccess?: () => void }) => void) {
  return { mutate: vi.fn(impl ?? ((_v, options) => options?.onSuccess?.())) }
}

describe('useUndoableMutation', () => {
  it('commits the forward mutation immediately', () => {
    const forward = mutationLike()
    const inverse = mutationLike()
    const { result } = renderHook(() => useUndoableMutation(forward, inverse, { label: 'Done' }), { wrapper })

    act(() => result.current('t1', 't1'))

    expect(forward.mutate).toHaveBeenCalledWith('t1', expect.any(Object))
    expect(inverse.mutate).not.toHaveBeenCalled()
  })

  it('does not show Undo (and never calls inverse) if the forward mutation does not succeed', () => {
    const forward = mutationLike(() => {
      /* never calls onSuccess — simulates a still-pending/failed mutation */
    })
    const inverse = mutationLike()
    const { result } = renderHook(() => useUndoableMutation(forward, inverse, { label: 'Done' }), { wrapper })

    act(() => result.current('t1', 't1'))

    expect(inverse.mutate).not.toHaveBeenCalled()
  })

  it('invokes inverse with the inverse variables when Undo is tapped', () => {
    const forward = mutationLike()
    const inverse = mutationLike()
    const { result } = renderHook(() => useUndoableMutation(forward, inverse, { label: 'Done' }), { wrapper })

    act(() => result.current('forward-args', { id: 'inverse-args' }))

    act(() => {
      document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(inverse.mutate).toHaveBeenCalledWith({ id: 'inverse-args' })
  })

  it('supports a label function computed from the forward variables', () => {
    const forward = mutationLike()
    const inverse = mutationLike()
    const label = vi.fn((v: string) => `Done — ${v}`)
    const { result } = renderHook(() => useUndoableMutation(forward, inverse, { label }), { wrapper })

    act(() => result.current('Water the plants', 'Water the plants'))

    expect(label).toHaveBeenCalledWith('Water the plants')
    expect(document.body.textContent).toContain('Done — Water the plants')
  })
})
