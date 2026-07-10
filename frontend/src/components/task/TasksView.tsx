import { useTasks } from '@/hooks/useTasks'
import { useSettings } from '@/hooks/useSettings'
import { TaskRow } from '@/components/task/TaskRow'

/** All household tasks — grouped Open → collapsed Done, owner-filter in US2 (T010). */
export function TasksView() {
  const { data: tasks, isPending, isError } = useTasks()
  const { timezone } = useSettings()

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

  const open = tasks?.filter((t) => t.status !== 'done') ?? []

  if (!open.length && !tasks?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="font-display text-lg text-ink">Nothing on the list</p>
        <p className="text-sm text-ink-muted">Use the + button to add a task.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      <h2 className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
        Tasks
      </h2>
      {open.length === 0 ? (
        <p className="px-1 py-4 text-sm text-ink-muted">All caught up — nothing open right now.</p>
      ) : (
        <div className="rounded-card bg-surface shadow-card">
          {open.map((task) => (
            <TaskRow key={task.id} task={task} timezone={timezone} />
          ))}
        </div>
      )}
    </div>
  )
}
