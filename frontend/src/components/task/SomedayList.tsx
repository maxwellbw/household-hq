import { useMemo } from 'react'
import { useEvents } from '@/hooks/useEvents'
import { useTasks } from '@/hooks/useTasks'
import { useSettings } from '@/hooks/useSettings'
import { buildCalendarModel } from '@/lib/tether'
import { somedayTasks } from '@/lib/tether'
import { TaskRow } from '@/components/task/TaskRow'
import { ErrorState } from '@/components/shell/ErrorState'
import type { Owner } from '@/types/domain'

interface SomedayListProps {
  visibleOwners: Set<Owner>
  /** Called when the user taps a task title to open the schedule dialog. */
  onSchedule: (taskId: string) => void
}

export function SomedayList({ visibleOwners, onSchedule }: SomedayListProps) {
  const eventsQuery = useEvents()
  const tasksQuery = useTasks()
  const { timezone } = useSettings()

  const model = useMemo(
    () => buildCalendarModel(eventsQuery.data ?? [], tasksQuery.data ?? []),
    [eventsQuery.data, tasksQuery.data],
  )

  const tasks = useMemo(
    () => somedayTasks(model, visibleOwners),
    [model, visibleOwners],
  )

  const isLoading = eventsQuery.isLoading || tasksQuery.isLoading
  const isError = eventsQuery.isError || tasksQuery.isError

  return (
    <section aria-labelledby="someday-heading" className="px-4 pb-4 pt-2">
      <h2
        id="someday-heading"
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
      >
        Someday
      </h2>

      {isLoading && (
        <p className="py-3 text-sm text-ink-muted" role="status" aria-live="polite">
          Loading…
        </p>
      )}

      {isError && !isLoading && (
        <ErrorState
          title="Couldn't load someday tasks"
          copy="Check your connection and try again."
          onRetry={() => {
            void eventsQuery.refetch()
            void tasksQuery.refetch()
          }}
          busy={eventsQuery.isFetching || tasksQuery.isFetching}
        />
      )}

      {!isLoading && !isError && tasks.length === 0 && (
        <p className="py-3 font-display text-sm text-ink-muted">
          Nothing parked for later — add a task without a due date to see it here.
        </p>
      )}

      {!isLoading && !isError && tasks.length > 0 && (
        <ul role="list" className="rounded-control border border-border bg-surface">
          {tasks.map((task) => (
            <li key={task.id} role="listitem">
              <TaskRow
                task={task}
                timezone={timezone}
                onDetail={() => onSchedule(task.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
