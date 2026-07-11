import { cn } from '@/lib/utils'
import type { CalendarViewMode } from '@/components/calendar/DayListView'

interface CalendarViewSwitcherProps {
  mode: Exclude<CalendarViewMode, 'day'>
  onChange: (mode: Exclude<CalendarViewMode, 'day'>) => void
}

const OPTIONS: { mode: Exclude<CalendarViewMode, 'day'>; label: string }[] = [
  { mode: 'month', label: 'Month' },
  { mode: 'week', label: 'Week' },
  { mode: 'next7', label: 'Next 7 days' },
]

/**
 * Month / Week / Next-7-days toggle, rendered on both desktop and mobile
 * (feature 017 clarification — mobile had no view picker at all before this).
 */
export function CalendarViewSwitcher({ mode, onChange }: CalendarViewSwitcherProps) {
  return (
    <div role="group" aria-label="Calendar view" className="flex gap-1 px-2 py-1">
      {OPTIONS.map((opt) => {
        const active = opt.mode === mode
        return (
          <button
            key={opt.mode}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.mode)}
            className={cn(
              'min-h-[44px] rounded-control px-3 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              active ? 'bg-accent text-surface' : 'text-ink-muted hover:bg-surface-alt',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
