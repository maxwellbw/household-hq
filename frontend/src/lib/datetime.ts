// All formatting is pinned to the household timezone (Settings.timezone),
// never the viewer's device timezone (FR-017, research R7).
//
// Backend datetimes are naive local wall-clock strings ("2026-07-20T14:30",
// no offset) meant to be read directly as household-local time — NOT as
// device-local time. `new Date(naiveString)` would silently parse it in the
// *browser's* zone, which is wrong whenever the device isn't in the
// household timezone. Temporal.PlainDateTime.toZonedDateTime(timezone)
// interprets it correctly regardless of device tz; we then convert to an
// epoch instant and hand that to Intl.DateTimeFormat for display.

import { Temporal } from 'temporal-polyfill'

const DEFAULT_TIMEZONE = 'America/Los_Angeles'

function hasOffset(iso: string): boolean {
  return /Z$|[+-]\d{2}:\d{2}$/.test(iso)
}

/** The correct epoch instant for a naive household-local string, or a real instant/offset string. */
function toEpochMs(iso: string, timezone: string): number {
  const zdt = hasOffset(iso)
    ? Temporal.Instant.from(iso).toZonedDateTimeISO(timezone)
    : Temporal.PlainDateTime.from(iso).toZonedDateTime(timezone)
  return zdt.epochMilliseconds
}

/** The Temporal.ZonedDateTime for a backend datetime string, in the household timezone — for feeding Schedule-X. */
export function toZonedDateTime(iso: string, timezone: string = DEFAULT_TIMEZONE): Temporal.ZonedDateTime {
  return hasOffset(iso)
    ? Temporal.Instant.from(iso).toZonedDateTimeISO(timezone)
    : Temporal.PlainDateTime.from(iso).toZonedDateTime(timezone)
}

/** True when an ISO datetime string carries no time component (date-only) or start===end. */
export function isAllDay(start: string, end?: string): boolean {
  if (!start) return true
  const hasTime = /T\d{2}:\d{2}/.test(start)
  if (!hasTime) return true
  if (end && start === end) return true
  return false
}

/** YYYY-MM-DD for `iso` as observed in `timezone` — used for calendar day-bucketing. */
export function dayKey(iso: string, timezone: string = DEFAULT_TIMEZONE): string {
  if (!iso) return ''
  // A naive household-local string's date portion is already the correct
  // day — no conversion needed (and none possible without a source zone).
  if (!hasOffset(iso)) return iso.slice(0, 10)
  const ms = toEpochMs(iso, timezone)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

export function formatTime(iso: string, timezone: string = DEFAULT_TIMEZONE): string {
  const ms = toEpochMs(iso, timezone)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

export function formatDate(
  iso: string,
  timezone: string = DEFAULT_TIMEZONE,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  const ms = toEpochMs(iso, timezone)
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, ...opts }).format(new Date(ms))
}

/** Today's YYYY-MM-DD in the household timezone — independent of device timezone. */
export function todayKey(timezone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(fromKey + 'T00:00:00Z').getTime()
  const to = new Date(toKey + 'T00:00:00Z').getTime()
  return Math.round((to - from) / 86_400_000)
}

/**
 * Relative due label for a task's dueDate, or a T−N label relative to an
 * event's start when eventStartKey is supplied (checklist context).
 */
export function relativeDue(
  dueDate: string | undefined,
  timezone: string = DEFAULT_TIMEZONE,
  eventStartKey?: string,
): string {
  if (!dueDate) return ''
  const dueKey = dayKey(dueDate, timezone)
  const anchorKey = eventStartKey ?? todayKey(timezone)
  const diff = daysBetween(anchorKey, dueKey)

  if (eventStartKey) {
    if (diff === 0) return 'Due day-of'
    if (diff > 0) return `T+${diff} days`
    return `T−${Math.abs(diff)} days`
  }

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1) return `In ${diff} days`
  return `${Math.abs(diff)} days overdue`
}
