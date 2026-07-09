// Quick-add payload builders (research R6): each type maps to an existing
// backend create action, collecting only what REQUIRED_ON_CREATE
// (backend/Config.js) needs, with sensible defaults so the fast path is a
// few taps (FR-023). No new backend surface.

import type { Cadence, Owner } from '@/types/domain'
import { todayKey } from '@/lib/datetime'

export interface NewEventInput {
  title: string
  start: string // ISO datetime
  end?: string // ISO datetime; defaults to start + 1h
  owner: Owner
  type?: string
}

export interface NewRecurringInput {
  title: string
  cadence: Cadence
  anchorDate: string // ISO date
  defaultOwner: Owner
}

export interface NewOneTimeTaskInput {
  title: string
  dueDate?: string // ISO date; defaults to today
  owner: Owner
}

function addOneHour(isoDateTime: string): string {
  const [datePart, timePart] = isoDateTime.split('T')
  if (!timePart) return isoDateTime // all-day/date-only — nothing to shift
  const [h, m] = timePart.split(':').map(Number)
  const nextHour = (h + 1) % 24
  return `${datePart}T${String(nextHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** → events.create payload. */
export function buildEventPayload(input: NewEventInput): Record<string, unknown> {
  return {
    title: input.title,
    start: input.start,
    end: input.end || addOneHour(input.start),
    owner: input.owner,
    ...(input.type ? { type: input.type } : {}),
  }
}

/** → recurring.create payload (creates the rule; instances materialize via the existing nightly generator). */
export function buildRecurringPayload(input: NewRecurringInput): Record<string, unknown> {
  return {
    title: input.title,
    cadence: input.cadence,
    anchorDate: input.anchorDate,
    defaultOwner: input.defaultOwner,
  }
}

/** → tasks.create payload. */
export function buildOneTimeTaskPayload(input: NewOneTimeTaskInput, timezone: string): Record<string, unknown> {
  return {
    title: input.title,
    owner: input.owner,
    dueDate: input.dueDate || todayKey(timezone),
  }
}
