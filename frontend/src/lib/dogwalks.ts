import { Temporal } from 'temporal-polyfill'
import { formatDayLabel, todayKey } from '@/lib/datetime'
import { dogWalkNoticeKey, isDismissed } from '@/lib/dogWalkDismissals'
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

export interface DogWalkNoticeItem {
  key: string
  date: string
  slot: DogWalk['slot']
  reason: string | null
  /** today/tomorrow read as urgent (alarm styling, never collapsed); everything
   *  else is quiet (US6, FR-019/020). */
  tier: 'urgent' | 'quiet'
  /** Precomputed relative-day wording for reason copy — 'today' / 'tomorrow' / 'on Thu' —
   *  so the component never needs its own timezone to avoid re-deriving "today" itself
   *  (the exact bug this feature fixes: hardcoded "today" for dates a week out). */
  dayPhrase: string
}

function dayPhraseFor(dateKey: string, today: string, tomorrow: string): string {
  if (dateKey === today) return 'today'
  if (dateKey === tomorrow) return 'tomorrow'
  return `on ${formatDayLabel(dateKey, { weekday: 'short' })}`
}

/** Needs-decision days minus this device's dismissed notices, evaluated fresh on every
 *  call so a dismissal survives an in-session refetch or a reload (feature 029 US3) —
 *  mirrors ackNotices' persisted-filter pattern rather than relying on component state
 *  that resets on remount. */
export function dogWalkNotices(rows: DogWalk[], timezone?: string): DogWalkNoticeItem[] {
  const today = todayKey(timezone)
  const tomorrow = Temporal.PlainDate.from(today).add({ days: 1 }).toString()
  return needsDecisionDays(rows, timezone)
    .map((d) => ({
      key: dogWalkNoticeKey(d.date, d.slot, d.reason ?? ''),
      date: d.date,
      slot: d.slot,
      reason: d.reason,
      tier: (d.date === today || d.date === tomorrow ? 'urgent' : 'quiet') as 'urgent' | 'quiet',
      dayPhrase: dayPhraseFor(d.date, today, tomorrow),
    }))
    .filter((notice) => !isDismissed(notice.key))
}

/** Walks (booked/suggested/needs-decision) on a single day, by slot — feeds the Day Peek
 *  panel's read-only walk row(s) (feature 029 US1). Deferred rows carry no useful time
 *  window for the peek and are excluded. */
export function walksForDay(rows: DogWalk[], dateKey: string): DogWalk[] {
  return rows
    .filter((r) => r.date === dateKey && (r.status === 'booked' || r.status === 'suggested' || r.status === 'needs-decision'))
    .slice()
    .sort((a, b) => a.slot.localeCompare(b.slot))
}
