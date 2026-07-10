import type { Task } from '@/types/domain'

export interface GroupedTasks {
  open: Task[]
  done: Task[]
}

// Sentinel that sorts undated tasks after all real ISO dates (YYYY-MM-DD)
const UNDATED_SENTINEL = '9999-99-99'

/**
 * Partition tasks into Open (status !== 'done') and Done (status === 'done').
 * Open: sorted by dueDate ascending — overdue dates naturally precede future
 * ones, undated tasks go last. Done: sorted by completedAt descending.
 * Pure function — no side effects.
 */
export function groupTasks(tasks: Task[]): GroupedTasks {
  const open = tasks
    .filter((t) => t.status !== 'done')
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

  return { open, done }
}
