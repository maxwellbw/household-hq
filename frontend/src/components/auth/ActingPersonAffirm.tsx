import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ownerStyle } from '@/lib/owners'
import { cn } from '@/lib/utils'

/**
 * Dismissible affirmation shown when a returning shared-account user's
 * remembered acting person is restored silently (feature 018 FR-004,
 * clarify Q3) — replaces the blocking ActingPersonPrompt on return visits so
 * the wrong-person risk on a shared device is still guarded without
 * re-asking every time.
 */
export function ActingPersonAffirm({ person }: { person: 'max' | 'jaz' }) {
  const { setActingPerson } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const style = ownerStyle(person)

  if (dismissed) return null

  const other = person === 'max' ? 'jaz' : 'max'
  const otherStyle = ownerStyle(other)

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-alt px-4 py-2 text-sm">
      <span className="text-ink">
        Signed in as{' '}
        <span className={cn('font-medium', person === 'max' ? 'text-owner-max' : 'text-owner-jaz')}>
          {style.label}
        </span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setActingPerson(other)
            setDismissed(true)
          }}
          className={cn(
            'min-h-[44px] rounded-control px-3 py-2 font-medium underline-offset-2 hover:underline',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            other === 'max' ? 'text-owner-max' : 'text-owner-jaz',
          )}
        >
          Switch to {otherStyle.label}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
