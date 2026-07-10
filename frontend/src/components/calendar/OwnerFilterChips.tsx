import { ALL_OWNERS, ownerStyle } from '@/lib/owners'
import { cn } from '@/lib/utils'
import type { Owner } from '@/types/domain'

interface OwnerFilterChipsProps {
  visibleOwners: Set<Owner>
  onToggle: (owner: Owner) => void
}

/** Independent, combinable Max/Jaz/Both toggle chips (FR-015, clarified session 2026-07-08). */
export function OwnerFilterChips({ visibleOwners, onToggle }: OwnerFilterChipsProps) {
  return (
    <div className="flex gap-2 px-4 py-2" role="group" aria-label="Filter by owner">
      {ALL_OWNERS.map((owner) => {
        const style = ownerStyle(owner)
        const enabled = visibleOwners.has(owner)
        return (
          <button
            key={owner}
            type="button"
            onClick={() => onToggle(owner)}
            aria-pressed={enabled}
            className={cn(
              'flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-opacity',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              enabled ? 'border-border bg-surface text-ink' : 'border-border bg-surface text-ink-faint opacity-50',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-surface',
                owner === 'max' && 'bg-owner-max',
                owner === 'jaz' && 'bg-owner-jaz',
                owner === 'both' && 'bg-accent-hover',
              )}
              aria-hidden="true"
            >
              {style.initial}
            </span>
            {style.label}
          </button>
        )
      })}
    </div>
  )
}
