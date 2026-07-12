import type { Owner, Task } from '@/types/domain'

export interface GroupedTasks {
  open: Task[]
  done: Task[]
  someday: Task[]
}

export interface SnoozeHistoryRow {
  fromDue: string | null // null when the task had no dueDate before this snooze (∅)
  newDue: string
  at: string // ISO timestamp when the snooze happened
}

/**
 * Parse snoozeHistory from the raw Sheet string into typed rows.
 * Format (R5): entries joined by ' | ', each `<fromDue|∅>→<newDue> @ <timestamp>`.
 * Tolerant: malformed/empty entries are silently skipped; never throws.
 */
export function parseSnoozeHistory(raw: string | undefined | null): SnoozeHistoryRow[] {
  if (!raw || !raw.trim()) return []
  return raw.split(' | ').flatMap((entry) => {
    const arrowIdx = entry.indexOf('→')
    const atIdx = entry.indexOf(' @ ')
    if (arrowIdx < 0 || atIdx < 0 || atIdx <= arrowIdx) return []
    const fromDueRaw = entry.slice(0, arrowIdx).trim()
    const newDue = entry.slice(arrowIdx + 1, atIdx).trim()
    const at = entry.slice(atIdx + 3).trim()
    if (!newDue || !at) return []
    return [{ fromDue: !fromDueRaw || fromDueRaw === '∅' ? null : fromDueRaw, newDue, at }]
  })
}

/**
 * Serialize SnoozeHistoryRow[] back to the Sheet encoding.
 * Primarily for round-trip testing; backend is the canonical writer.
 */
export function formatSnoozeHistory(rows: SnoozeHistoryRow[]): string {
  return rows.map((r) => `${r.fromDue ?? '∅'}→${r.newDue} @ ${r.at}`).join(' | ')
}

// Sentinel that sorts undated tasks after all real ISO dates (YYYY-MM-DD). Only reachable
// now by an undated task still attached to an event (rare) — standalone undated tasks are
// routed to `someday` instead (feature 021).
const UNDATED_SENTINEL = '9999-99-99'

/** A "someday" task (feature 013/021): open, standalone (no event), no due date. */
function isSomedayTask(t: Task): boolean {
  return !t.eventId && !t.dueDate
}

/**
 * Shared household order for the Someday list/section (feature 021): ranked tasks
 * ascending by `somedayRank` (blank = unranked), unranked tasks below sorted by title.
 * Pure — used identically by the Tasks tab and the home dashboard so both agree (SC-003).
 */
export function somedaySort(a: Task, b: Task): number {
  const ar = a.somedayRank ? Number(a.somedayRank) : NaN
  const br = b.somedayRank ? Number(b.somedayRank) : NaN
  const ak = Number.isFinite(ar) ? ar : Number.POSITIVE_INFINITY
  const bk = Number.isFinite(br) ? br : Number.POSITIVE_INFINITY
  return ak !== bk ? ak - bk : a.title.localeCompare(b.title)
}

/**
 * Partition tasks into Open (dated, status !== 'done'), Done (status === 'done'), and
 * Someday (standalone, undated, open — feature 021). Open: sorted by dueDate ascending;
 * an undated-but-event-attached task (edge case) still sinks to the bottom via the
 * sentinel rather than disappearing. Done: sorted by completedAt descending. Someday:
 * shared-rank order via `somedaySort`. Pure function — no side effects.
 */
export function groupTasks(tasks: Task[]): GroupedTasks {
  const openAll = tasks.filter((t) => t.status !== 'done')

  const someday = openAll.filter(isSomedayTask).sort(somedaySort)

  const open = openAll
    .filter((t) => !isSomedayTask(t))
    .sort((a, b) => {
      const ak = a.dueDate ?? UNDATED_SENTINEL
      const bk = b.dueDate ?? UNDATED_SENTINEL
      return ak < bk ? -1 : ak > bk ? 1 : 0
    })

  const done = tasks
    .filter((t) => t.status === 'done')
    .sort((a, b) => {
      const ak = a.completedAt ?? ''
      const bk = b.completedAt ?? ''
      return bk < ak ? -1 : bk > ak ? 1 : 0
    })

  return { open, done, someday }
}

/**
 * True when `task` is assigned to a single person and that person has not yet
 * acknowledged it (feature 019 US2 — "not yet committed"). `both`-owned and completed
 * tasks are never uncommitted; the badge/action is visible to both users regardless of
 * `viewer` (viewer is accepted for API symmetry with `canAcknowledge`).
 */
export function isUncommitted(task: Task, _viewer?: Owner): boolean {
  return (
    (task.owner === 'max' || task.owner === 'jaz') &&
    (task.status === 'open' || task.status === 'snoozed') &&
    task.ackBy !== task.owner
  )
}

/** True when `viewer` is the assignee of an uncommitted task — i.e. may tap "I've got it". */
export function canAcknowledge(task: Task, viewer: Owner | undefined): boolean {
  return isUncommitted(task) && viewer !== undefined && viewer === task.owner
}
