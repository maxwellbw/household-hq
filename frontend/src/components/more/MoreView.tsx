import { useState } from 'react'
import { ChevronRight, RefreshCw, ClipboardList, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ownerStyle } from '@/lib/owners'
import { cn } from '@/lib/utils'

type Subscreen = null | 'recurring' | 'templates'

/** More hub — account info + sign out + links to management screens (managers wired in US6 / T032). */
export function MoreView() {
  const { session, signOut } = useAuth()
  const [subscreen, setSubscreen] = useState<Subscreen>(null)
  const who = session?.who
  const owner = who?.identity === 'shared' ? session?.actingPerson : who?.identity

  if (subscreen !== null) {
    const label = subscreen === 'recurring' ? 'Recurring Rules' : 'Prep Templates'
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <button
            type="button"
            onClick={() => setSubscreen(null)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Back to More"
          >
            ←
          </button>
          <h2 className="font-display text-lg text-ink">{label}</h2>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <p className="font-display text-lg text-ink">Coming in a future update</p>
          <p className="text-sm text-ink-muted">
            Management screens for {label.toLowerCase()} are on the way.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      {/* Manage section */}
      <section aria-labelledby="more-manage-heading">
        <h2
          id="more-manage-heading"
          className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint"
        >
          Manage
        </h2>
        <ul className="rounded-card bg-surface shadow-card">
          <li>
            <button
              type="button"
              onClick={() => setSubscreen('recurring')}
              className={cn(
                'flex min-h-[52px] w-full items-center gap-3 border-b border-border px-4 py-3 text-left',
                'hover:bg-surface-alt',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <RefreshCw className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="flex-1 text-sm text-ink">Recurring Rules</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setSubscreen('templates')}
              className={cn(
                'flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left',
                'hover:bg-surface-alt',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <ClipboardList className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="flex-1 text-sm text-ink">Prep Templates</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      {/* Account section */}
      <section aria-labelledby="more-account-heading">
        <h2
          id="more-account-heading"
          className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint"
        >
          Account
        </h2>
        <ul className="rounded-card bg-surface shadow-card">
          {who && (
            <li className="flex min-h-[52px] items-center gap-3 border-b border-border px-4 py-3">
              {owner && (
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium text-surface',
                    owner === 'max' && 'bg-owner-max',
                    owner === 'jaz' && 'bg-owner-jaz',
                  )}
                  aria-hidden="true"
                >
                  {ownerStyle(owner).initial}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {who.displayName || who.email}
                </p>
                <p className="truncate text-xs text-ink-muted">{who.email}</p>
              </div>
            </li>
          )}
          <li>
            <button
              type="button"
              onClick={signOut}
              className={cn(
                'flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left',
                'hover:bg-surface-alt',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <LogOut className="h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
              <span className="flex-1 text-sm text-danger">Sign out</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  )
}
