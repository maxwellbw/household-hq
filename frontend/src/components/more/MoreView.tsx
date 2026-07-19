import { useEffect, useState } from 'react'
import { ChevronRight, RefreshCw, CalendarClock, ClipboardList, Settings2, LogOut, Rss } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme, type ThemePreference } from '@/hooks/useTheme'
import { RecurringManager } from '@/components/more/RecurringManager'
import { RecurringEventsManager } from '@/components/more/RecurringEventsManager'
import { TemplatesManager } from '@/components/more/TemplatesManager'
import { SettingsView } from '@/components/more/SettingsView'
import { FeedView } from '@/components/feed/FeedView'
import { ownerStyle } from '@/lib/owners'
import { cn } from '@/lib/utils'

type Subscreen = null | 'recurring' | 'recurringEvents' | 'templates' | 'settings' | 'feed'

export interface MoreViewProps {
  /** Feature 032 US2 (FR-009): the dashboard's Lately strip "See all" jumps straight to
   *  Feed instead of landing on the main More menu. */
  initialSubscreen?: 'feed'
  /** Called once after mount, having already captured `initialSubscreen` — lets the caller
   *  clear its own signal without racing this component's lazy-loaded mount (audit F-04's
   *  documented race — the effect-on-`active` pattern clears before the dynamic import
   *  resolves, so App.tsx hands the "consumed" moment to this component instead). */
  onConsumedInitialSubscreen?: () => void
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/**
 * Feature 032 US1 (contract C6): three-way theme control. Device state, not
 * household data — applies instantly with no Save round-trip, unlike the
 * Settings sheet form.
 */
function AppearanceSection() {
  const { preference, resolvedTheme, setPreference } = useTheme()
  return (
    <section aria-labelledby="more-appearance-heading">
      <h2
        id="more-appearance-heading"
        className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint"
      >
        Appearance
      </h2>
      <div className="rounded-card bg-surface p-4 shadow-card">
        <div role="group" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-control bg-surface-alt p-1">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={preference === option.value}
              onClick={() => setPreference(option.value)}
              className={cn(
                'min-h-[44px] rounded-[calc(var(--radius-control)-4px)] px-3 text-sm',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                preference === option.value
                  ? 'bg-surface font-medium text-ink shadow-card'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 px-1 text-xs text-ink-muted">
          {preference === 'system'
            ? `Follows this device — currently ${resolvedTheme === 'dark' ? 'dark' : 'light'}.`
            : 'Applies on this device only.'}
        </p>
      </div>
    </section>
  )
}

/** More hub — account info + sign out + Recurring/Templates managers (US6, T032). */
export function MoreView({ initialSubscreen, onConsumedInitialSubscreen }: MoreViewProps = {}) {
  const { session, signOut } = useAuth()
  const [subscreen, setSubscreen] = useState<Subscreen>(initialSubscreen ?? null)

  useEffect(() => {
    onConsumedInitialSubscreen?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const who = session?.who
  const owner = who?.identity === 'shared' ? session?.actingPerson : who?.identity

  if (subscreen === 'recurring') {
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
          <h2 className="font-display text-lg text-ink">Recurring Rules</h2>
        </div>
        <RecurringManager />
      </div>
    )
  }

  if (subscreen === 'recurringEvents') {
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
          <h2 className="font-display text-lg text-ink">Recurring Events</h2>
        </div>
        <RecurringEventsManager />
      </div>
    )
  }

  if (subscreen === 'templates') {
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
          <h2 className="font-display text-lg text-ink">Prep Templates</h2>
        </div>
        <TemplatesManager />
      </div>
    )
  }

  if (subscreen === 'settings') {
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
          <h2 className="font-display text-lg text-ink">Settings</h2>
        </div>
        <SettingsView />
      </div>
    )
  }

  if (subscreen === 'feed') {
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
          <h2 className="font-display text-lg text-ink">Feed</h2>
        </div>
        <FeedView />
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
              onClick={() => setSubscreen('feed')}
              className={cn(
                'flex min-h-[52px] w-full items-center gap-3 border-b border-border px-4 py-3 text-left',
                'hover:bg-surface-alt',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <Rss className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="flex-1 text-sm text-ink">Feed</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
            </button>
          </li>
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
              onClick={() => setSubscreen('recurringEvents')}
              className={cn(
                'flex min-h-[52px] w-full items-center gap-3 border-b border-border px-4 py-3 text-left',
                'hover:bg-surface-alt',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <CalendarClock className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="flex-1 text-sm text-ink">Recurring Events</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setSubscreen('templates')}
              className={cn(
                'flex min-h-[52px] w-full items-center gap-3 border-b border-border px-4 py-3 text-left',
                'hover:bg-surface-alt',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <ClipboardList className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="flex-1 text-sm text-ink">Prep Templates</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setSubscreen('settings')}
              className={cn(
                'flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left',
                'hover:bg-surface-alt',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <Settings2 className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
              <span className="flex-1 text-sm text-ink">Settings</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      <AppearanceSection />

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
