import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ownerStyle } from '@/lib/owners'
import { cn } from '@/lib/utils'
import { QuickAddSheet } from '@/components/quickadd/QuickAddSheet'
import { NAV_ITEMS, type NavSection } from '@/components/shell/navItems'

interface AppShellProps {
  children: ReactNode
  active: NavSection
  onNavigate: (section: NavSection) => void
}

export function AppShell({ children, active, onNavigate }: AppShellProps) {
  const { session, signOut } = useAuth()
  const who = session?.who
  const owner = who?.identity === 'shared' ? session?.actingPerson : who?.identity
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <h1 className="font-display text-lg">Household HQ</h1>
        {who && (
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-[44px] items-center gap-2 rounded-control px-2 py-1 text-sm text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={`Signed in as ${who.displayName || who.email}. Sign out.`}
          >
            {owner && (
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-surface',
                  owner === 'max' && 'bg-owner-max',
                  owner === 'jaz' && 'bg-owner-jaz',
                )}
              >
                {ownerStyle(owner).initial}
              </span>
            )}
            <span className="hidden sm:inline">{who.displayName || who.email}</span>
          </button>
        )}
      </header>

      {/* Row container: left rail (desktop) + scrollable content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop left sidebar rail — hidden on mobile */}
        <nav
          aria-label="Main navigation"
          className="hidden sm:flex sm:w-[72px] sm:flex-col sm:gap-1 sm:border-r sm:border-border sm:bg-surface sm:px-1 sm:py-4"
        >
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              aria-current={key === active ? 'page' : undefined}
              aria-label={label}
              className={cn(
                'flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                key === active
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink-muted hover:bg-surface-alt hover:text-ink',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">{children}</main>
      </div>

      {/* Quick-add FAB */}
      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Add something"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-surface shadow-card hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:bottom-6"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Mobile bottom tab bar — hidden on sm+; safe-area padding keeps the tab row above the
          home indicator while the surface background still reaches the physical edge. */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            aria-current={key === active ? 'page' : undefined}
            className={cn(
              'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              key === active ? 'text-accent' : 'text-ink-faint',
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {quickAddOpen && <QuickAddSheet onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}
