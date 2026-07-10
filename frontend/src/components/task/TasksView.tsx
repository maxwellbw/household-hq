import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { useSettings } from '@/hooks/useSettings'
import { useOwnerFilter } from '@/hooks/useOwnerFilter'
import { groupTasks } from '@/lib/tasks'
import { TaskRow } from '@/components/task/TaskRow'
import { OwnerFilterChips } from '@/components/calendar/OwnerFilterChips'

/** All household tasks — grouped Open → collapsed Done, filtered by owner chips. */
export function TasksView() {
  const { data: tasks, isPending, isError } = useTasks()
  const { timezone } = useSettings()
  const { visibleOwners, toggle } = useOwnerFilter()
  const [doneExpanded, setDoneExpanded] = useState(false)

  if (isPending) {
    return (
      <div className="flex flex-col gap-2 px-4 py-6" aria-busy="true" aria-label="Loading tasks">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-control bg-surface-alt" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="font-display text-lg text-ink">Could not load tasks</p>
        <p className="text-sm text-ink-muted">Check your connection and try again.</p>
      </div>
    )
  }

  const filtered = (tasks ?? []).filter((t) => visibleOwners.has(t.owner))
  const { open, done } = groupTasks(filtered)

  const noTasksAtAll = !tasks?.length
  const nothingAfterFilter = !!tasks?.length && !filtered.length

  return (
    <div>
      <OwnerFilterChips visibleOwners={visibleOwners} onToggle={toggle} />

      <div className="px-4 py-2">
        {/* Open group */}
        <h2 className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
          Open
        </h2>

        {noTasksAtAll ? (
          <div className="flex flex-col items-center gap-1 py-10 text-center">
            <p className="font-display text-base text-ink">Nothing on the list yet</p>
            <p className="text-sm text-ink-muted">Tap + to add a task.</p>
          </div>
        ) : nothingAfterFilter ? (
          <div className="flex flex-col items-center gap-1 py-10 text-center">
            <p className="font-display text-base text-ink">No tasks for this filter</p>
            <p className="text-sm text-ink-muted">Try toggling an owner chip above.</p>
          </div>
        ) : open.length === 0 ? (
          <p className="px-1 py-4 text-sm text-ink-muted">All caught up — nothing open right now.</p>
        ) : (
          <div className="rounded-card bg-surface shadow-card">
            {open.map((task) => (
              <TaskRow key={task.id} task={task} timezone={timezone} />
            ))}
          </div>
        )}

        {/* Done group — collapsed by default */}
        {done.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDoneExpanded((v) => !v)}
              aria-expanded={doneExpanded}
              className="mb-1 flex min-h-[44px] w-full items-center gap-1 px-1 text-left text-xs font-medium uppercase tracking-wide text-ink-faint hover:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {doneExpanded
                ? <ChevronDown size={14} aria-hidden="true" />
                : <ChevronRight size={14} aria-hidden="true" />
              }
              Done ({done.length})
            </button>

            {doneExpanded && (
              <div className="rounded-card bg-surface shadow-card">
                {done.map((task) => (
                  <TaskRow key={task.id} task={task} timezone={timezone} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
