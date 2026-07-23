import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GroceryNudge } from './GroceryNudge'

describe('GroceryNudge', () => {
  it('renders nothing when show is false', () => {
    render(<GroceryNudge show={false} count={5} onNavigate={vi.fn()} />)
    expect(screen.queryByText(/Running low on staples/)).not.toBeInTheDocument()
  })

  it('navigates to the grocery Needed view when tapped (audit F-31)', () => {
    const onNavigate = vi.fn()
    render(<GroceryNudge show={true} count={5} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /Running low on staples/ }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('states the needed-staples count (034 US5)', () => {
    render(<GroceryNudge show={true} count={5} onNavigate={vi.fn()} />)
    expect(screen.getByText(/Running low on staples — 5 items needed\./)).toBeInTheDocument()
  })

  it('uses the singular when exactly one staple is needed', () => {
    render(<GroceryNudge show={true} count={1} onNavigate={vi.fn()} />)
    expect(screen.getByText(/Running low on staples — 1 item needed\./)).toBeInTheDocument()
  })
})
