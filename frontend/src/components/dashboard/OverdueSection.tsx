import { TaskRow } from '@/components/task/TaskRow'
import type { Task } from '@/types/domain'

interface OverdueSectionProps {
  tasks: Task[]
  timezone: string
  onViewAll: () => void
}

const CAP = 5

/** Dashboard's highest-priority region (feature 032 US2, contract C7, audit F-27): renders
 *  nothing when there's nothing overdue — the empty case is handled entirely by the merged
 *  "all clear" line on today's card, so this never stacks its own empty state on top. */
export function OverdueSection({ tasks, timezone, onViewAll }: OverdueSectionProps) {
  if (tasks.length === 0) return null
  const visible = tasks.slice(0, CAP)

  return (
    <section aria-labelledby="overdue-heading" className="px-4 pb-2 pt-3">
      <h2 id="overdue-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger">
        Overdue
      </h2>
      <ul role="list" className="rounded-control border-2 border-danger bg-surface">
        {visible.map((t) => (
          <li key={t.id} role="listitem">
            <TaskRow task={t} timezone={timezone} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onViewAll}
        className="mt-2 flex min-h-[44px] items-center rounded-control px-1 text-xs font-medium text-accent hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        View all {tasks.length} in Tasks
      </button>
    </section>
  )
}
