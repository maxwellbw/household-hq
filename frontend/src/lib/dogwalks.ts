import { todayKey } from '@/lib/datetime'
import type { DogWalk } from '@/types/domain'

/** Booked/suggested walks from today forward (household tz), earliest first — the
 *  calendar/dashboard's read-only dog-walk event source (contracts/dogwalks-api.md). */
export function upcomingWalks(rows: DogWalk[], timezone?: string): DogWalk[] {
  const today = todayKey(timezone)
  return rows
    .filter((r) => (r.status === 'booked' || r.status === 'suggested') && r.date >= today && r.windowStart && r.windowEnd)
    .slice()
    .sort((a, b) => (a.date === b.date ? a.slot.localeCompare(b.slot) : a.date.localeCompare(b.date)))
}

/** In-range weekdays flagged needing a manual decision, earliest first — feeds the
 *  dashboard's dismissible DogWalkNotice (US5). */
export function needsDecisionDays(rows: DogWalk[], timezone?: string): DogWalk[] {
  const today = todayKey(timezone)
  return rows
    .filter((r) => r.status === 'needs-decision' && r.date >= today)
    .slice()
    .sort((a, b) => (a.date === b.date ? a.slot.localeCompare(b.slot) : a.date.localeCompare(b.date)))
}
