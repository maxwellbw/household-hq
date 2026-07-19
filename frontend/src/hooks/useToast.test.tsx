import { screen, fireEvent, act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ToastProvider, useToast } from '@/hooks/useToast'

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

describe('useToast — showUndo (feature 032 US3, contract C3)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders the label and an Undo action', () => {
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => result.current.showUndo('Done — Water the plants', vi.fn()))
    expect(screen.getByText('Done — Water the plants')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('calls onUndo and dismisses when tapped', () => {
    const onUndo = vi.fn()
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => result.current.showUndo('Done', onUndo))
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Undo' })))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Done')).not.toBeInTheDocument()
  })

  it('auto-dismisses after the window lapses without calling onUndo', () => {
    const onUndo = vi.fn()
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => result.current.showUndo('Done', onUndo, 6000))
    expect(screen.getByText('Done')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(6000))
    expect(screen.queryByText('Done')).not.toBeInTheDocument()
    expect(onUndo).not.toHaveBeenCalled()
  })

  it('keeps a single live Undo toast — a second call finalizes the first instead of stacking', () => {
    const firstUndo = vi.fn()
    const secondUndo = vi.fn()
    const { result } = renderHook(() => useToast(), { wrapper })
    act(() => result.current.showUndo('First', firstUndo))
    act(() => result.current.showUndo('Second', secondUndo))

    expect(screen.queryByText('First')).not.toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1)

    // The finalized first toast's inverse is never invoked, even after its original window.
    act(() => vi.advanceTimersByTime(6000))
    expect(firstUndo).not.toHaveBeenCalled()
  })
})
