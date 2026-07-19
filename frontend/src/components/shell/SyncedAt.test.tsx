import { render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncedAt } from './SyncedAt'

describe('SyncedAt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when never fetched', () => {
    const { container } = render(<SyncedAt updatedAt={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "just now" under a minute old', () => {
    render(<SyncedAt updatedAt={Date.now() - 30_000} />)
    expect(screen.getByText('Synced just now')).toBeInTheDocument()
  })

  it('shows minutes for an hour or less', () => {
    render(<SyncedAt updatedAt={Date.now() - 5 * 60_000} />)
    expect(screen.getByText('Synced 5 min ago')).toBeInTheDocument()
  })

  it('shows hours beyond 60 minutes', () => {
    render(<SyncedAt updatedAt={Date.now() - 2 * 60 * 60_000} />)
    expect(screen.getByText('Synced 2 h ago')).toBeInTheDocument()
  })

  it('ticks forward every 60s without a remount', () => {
    const updatedAt = Date.now()
    render(<SyncedAt updatedAt={updatedAt} />)
    expect(screen.getByText('Synced just now')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('Synced 1 min ago')).toBeInTheDocument()
  })
})
