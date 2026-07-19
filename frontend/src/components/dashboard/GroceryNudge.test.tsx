import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GroceryNudge } from './GroceryNudge'

describe('GroceryNudge', () => {
  it('renders nothing when show is false', () => {
    render(<GroceryNudge show={false} onNavigate={vi.fn()} />)
    expect(screen.queryByText(/Running low on staples/)).not.toBeInTheDocument()
  })

  it('navigates to the grocery Needed view when tapped (audit F-31)', () => {
    const onNavigate = vi.fn()
    render(<GroceryNudge show={true} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /Running low on staples/ }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })
})
