import { render, screen, within, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'

const signOut = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: {
      who: { identity: 'max', displayName: 'Max', email: 'max@example.com', needsActingPerson: false },
    },
    signOut,
  }),
}))

beforeEach(() => {
  signOut.mockClear()
})

describe('AppShell — avatar menu (feature 032 US6, FR-022)', () => {
  it('a single tap on the avatar opens a menu instead of signing out', () => {
    render(
      <AppShell active="home" onNavigate={vi.fn()}>
        <p>content</p>
      </AppShell>,
    )
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }))
    expect(signOut).not.toHaveBeenCalled()
    expect(screen.getByRole('menu', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
  })

  it('shows the signed-in identity inside the menu', () => {
    render(
      <AppShell active="home" onNavigate={vi.fn()}>
        <p>content</p>
      </AppShell>,
    )
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }))
    const menu = screen.getByRole('menu', { name: 'Account' })
    expect(within(menu).getByText('Max')).toBeInTheDocument()
    expect(within(menu).getByText('max@example.com')).toBeInTheDocument()
  })

  it('signs out only via the deliberate second tap on the menu item', () => {
    render(
      <AppShell active="home" onNavigate={vi.fn()}>
        <p>content</p>
      </AppShell>,
    )
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('closes the menu on Escape without signing out', () => {
    render(
      <AppShell active="home" onNavigate={vi.fn()}>
        <p>content</p>
      </AppShell>,
    )
    fireEvent.click(screen.getByRole('button', { name: /open account menu/i }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu', { name: 'Account' })).not.toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
  })
})

describe('AppShell — quick-add FAB (feature 032 US5, FR-021, audit F-15)', () => {
  it('shows the FAB on other tabs', () => {
    render(
      <AppShell active="home" onNavigate={vi.fn()}>
        <p>content</p>
      </AppShell>,
    )
    expect(screen.getByRole('button', { name: 'Add something' })).toBeInTheDocument()
  })

  it('hides the FAB on Lists, which has its own in-context add controls', () => {
    render(
      <AppShell active="lists" onNavigate={vi.fn()}>
        <p>content</p>
      </AppShell>,
    )
    expect(screen.queryByRole('button', { name: 'Add something' })).not.toBeInTheDocument()
  })
})
