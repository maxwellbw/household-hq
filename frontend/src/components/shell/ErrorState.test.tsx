import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorState } from './ErrorState'

describe('ErrorState', () => {
  it('renders the title, copy, and a Retry button', () => {
    render(<ErrorState title="Couldn't load the feed" copy="Check your connection and try again." onRetry={vi.fn()} />)
    expect(screen.getByText("Couldn't load the feed")).toBeInTheDocument()
    expect(screen.getByText('Check your connection and try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('calls onRetry when tapped', () => {
    const onRetry = vi.fn()
    render(<ErrorState title="t" copy="c" onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows a busy state and disables the button while retrying (contract C2)', () => {
    render(<ErrorState title="t" copy="c" onRetry={vi.fn()} busy />)
    const button = screen.getByRole('button', { name: 'Retrying…' })
    expect(button).toBeDisabled()
  })
})
