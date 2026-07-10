import type { Owner } from '@/types/domain'

export interface ScheduleDraft {
  taskId: string
  /** ISO YYYY-MM-DD, or '' when no date has been chosen yet. */
  date: string
  /** null until the user actively picks an owner (FR-007 — never inferred). */
  owner: Owner | null
}

/** Confirm is enabled only when both date and owner are explicitly set (FR-008). */
export function canConfirm(draft: ScheduleDraft): boolean {
  return draft.date !== '' && draft.owner !== null
}

/** Produces the payload for tasks.update to schedule a someday task. */
export function buildSchedulePayload(draft: ScheduleDraft): { id: string; dueDate: string; owner: Owner } {
  return { id: draft.taskId, dueDate: draft.date, owner: draft.owner as Owner }
}
