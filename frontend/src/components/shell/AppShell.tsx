import { useState, type ReactNode } from 'react'
import { Calendar, ListChecks, Rss, MoreHorizontal, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ownerStyle } from '@/lib/owners'
import { cn } from '@/lib/utils'
import { QuickAddSheet } from '@/components/quickadd/QuickAddSheet'

const TABS = [
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'tasks', label: 'Tasks', icon: ListChecks },
  { key: 'feed', label: 'Feed', icon: Rss },
  { key: 'more', label: 'More', icon: MoreHorizontal },
] as const

export function AppShell({ children }: { children: ReactNode }) {
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

      <main className="flex-1 overflow-y-auto pb-16 sm:pb-0">{children}</main>

      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Add something"
        className="fixed bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-surface shadow-card hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:bottom-6"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface sm:hidden">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            disabled={key !== 'calendar'}
            className={cn(
              'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs',
              key === 'calendar' ? 'text-accent' : 'text-ink-faint',
            )}
            aria-current={key === 'calendar' ? 'page' : undefined}
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
