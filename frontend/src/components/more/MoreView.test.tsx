import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MoreView } from './MoreView'
import { resetThemeStoreForTests } from '@/hooks/useTheme'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: {
      who: { identity: 'max', displayName: 'Max', email: 'max@example.com', needsActingPerson: false },
    },
    signOut: vi.fn(),
  }),
}))

beforeEach(() => {
  localStorage.clear()
  resetThemeStoreForTests()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  localStorage.clear()
  resetThemeStoreForTests()
})

describe('MoreView — Appearance (feature 032 US1, contract C6)', () => {
  it('renders the three-way theme control with System selected by default', () => {
    render(<MoreView />)
    expect(screen.getByRole('group', { name: /theme/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('applies a choice instantly (no Save): stamps <html> and persists hq.theme', () => {
    render(<MoreView />)
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('hq.theme')).toBe('dark')
    // No Save button belongs to the appearance card — device state applies live.
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })

  it('makes the resolved theme evident while following the system', () => {
    render(<MoreView />)
    // setup.ts's matchMedia stub reports light; the helper line says so.
    expect(screen.getByText(/follows this device — currently light/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(screen.getByText(/applies on this device only/i)).toBeInTheDocument()
  })

  it('restores a persisted choice on a fresh render', () => {
    localStorage.setItem('hq.theme', 'dark')
    render(<MoreView />)
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
