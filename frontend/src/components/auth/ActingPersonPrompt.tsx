import { useAuth } from '@/hooks/useAuth'
import { ownerStyle } from '@/lib/owners'
import { cn } from '@/lib/utils'

/**
 * Shown once per session when the shared household account signs in
 * (WhoAmI.needsActingPerson). Writes require a concrete Max/Jaz actor
 * (backend ACTING_PERSON_REQUIRED, feature 002 FR-014).
 */
export function ActingPersonPrompt() {
  const { setActingPerson } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <h1 className="font-display text-2xl text-ink">Who's this?</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        You're signed in on the shared account. Let us know who's using it so changes are attributed correctly.
      </p>
      <div className="flex gap-4">
        {(['max', 'jaz'] as const).map((person) => {
          const style = ownerStyle(person)
          return (
            <button
              key={person}
              type="button"
              onClick={() => setActingPerson(person)}
              className={cn(
                'flex min-h-[44px] min-w-[96px] items-center justify-center gap-2 rounded-control border border-border px-4 py-2 font-medium',
                'hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                person === 'max' && 'text-owner-max',
                person === 'jaz' && 'text-owner-jaz',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs text-surface',
                  person === 'max' && 'bg-owner-max',
                  person === 'jaz' && 'bg-owner-jaz',
                )}
              >
                {style.initial}
              </span>
              {style.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
