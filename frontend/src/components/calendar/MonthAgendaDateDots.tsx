import type { Owner } from '@/types/domain'
import { cn } from '@/lib/utils'

interface AgendaDotEvent {
  owner?: Owner
}

interface MonthAgendaDateDotsProps {
  events: AgendaDotEvent[]
}

const OWNER_ORDER: Owner[] = ['max', 'jaz', 'both']
const OWNER_DOT: Record<Owner, string> = {
  max: 'bg-owner-max',
  jaz: 'bg-owner-jaz',
  both: 'bg-owner-both',
}

/**
 * Schedule-X custom component for the mobile month-agenda view's per-day dots (F-12,
 * FR-022): the built-in dots are one-per-event in a single vendor color. We instead show
 * one dot per *owner present that day* — matching SevenDayStrip's convention exactly —
 * which is capped at 3 by construction (Owner is max/jaz/both, nothing else exists) rather
 * than needing an overflow affordance; `events` arrives pre-sliced to
 * `monthAgendaOptions.nEventIndicatorsPerDay` (bumped well above any plausible daily count
 * in CalendarHome so this dedup sees the true day, not an arbitrarily truncated one).
 */
export function MonthAgendaDateDots({ events }: MonthAgendaDateDotsProps) {
  const present = OWNER_ORDER.filter((owner) => events.some((e) => e.owner === owner))
  if (present.length === 0) return null

  return (
    <div className="flex items-center justify-center gap-0.5">
      {present.map((owner) => (
        <span key={owner} className={cn('h-1.5 w-1.5 rounded-full', OWNER_DOT[owner])} aria-hidden="true" />
      ))}
    </div>
  )
}
