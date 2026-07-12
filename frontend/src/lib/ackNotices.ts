import type { Owner, Task } from '@/types/domain'
import { ackNoticeKey, isDismissed } from '@/lib/ackDismissals'

export interface AckNotice {
  key: string
  taskId: string
  taskTitle: string
  assignee: Owner // the person who acknowledged (task.owner)
}

/**
 * Derive the assigner's "X has it" notices for `viewer` (feature 019 research R4): every
 * task owned by the single person who is NOT the viewer, acknowledged by that owner, minus
 * this device's dismissed keys. Does not depend on task status — persists even after
 * completion until dismissed (per clarify).
 */
export function ackNotices(tasks: Task[], viewer: Owner | null): AckNotice[] {
  if (!viewer) return []
  return tasks
    .filter((t) => t.owner !== 'both' && t.owner !== viewer && t.ackBy === t.owner && t.ackAt)
    .map((t) => ({
      key: ackNoticeKey(t.id, t.ackAt as string),
      taskId: t.id,
      taskTitle: t.title,
      assignee: t.owner,
    }))
    .filter((notice) => !isDismissed(notice.key))
}
