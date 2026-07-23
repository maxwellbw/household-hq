import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { useSettings } from '@/hooks/useSettings'
import { useOwnerFilter } from '@/hooks/useOwnerFilter'
import { groupTasks, groupTasksByHorizon } from '@/lib/tasks'
import { TaskRow } from '@/components/task/TaskRow'
import { SnoozeDialog } from '@/components/task/SnoozeDialog'
import { TaskDetailSheet } from '@/components/task/TaskDetailSheet'
import { ForceRankDialog } from '@/components/task/ForceRankDialog'
import { OwnerFilterChips } from '@/components/calendar/OwnerFilterChips'
import { ErrorState } from '@/components/shell/ErrorState'
import type { Task } from '@/types/domain'

interface TasksViewProps {
  /** Opens the shared feature-013 schedule (date+owner) dialog for a someday task (feature 021). */
  onScheduleSomeday?: (taskId: string) => void
}

/** Feature 032 US5 (FR-017): horizon headings, soonest-first. */
const HORIZON_LABELS = {
  thisWeek: 'This week',
  nextWeek: 'Next week',
  later: 'Later',
} as const

/** All household tasks — grouped Open → collapsed Done → Someday, filtered by owner chips. */
export function TasksView({ onScheduleSomeday }: TasksViewProps) {
  const { data: tasks, isPending, isError, isFetching, refetch } = useTasks()
  const { timezone } = useSettings()
  const { visibleOwners, toggle } = useOwnerFilter()
  const [doneExpanded, setDoneExpanded] = useState(false)
  const [openExpanded, setOpenExpanded] = useState(true)
  const [somedayExpanded, setSomedayExpanded] = useState(true)
  const [snoozeTask, setSnoozeTask] = useState<Task | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailEdit, setDetailEdit] = useState(false)
  const [forceRankOpen, setForceRankOpen] = useState(false)

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
      <ErrorState
        title="Could not load tasks"
        copy="Check your connection and try again."
        onRetry={() => void refetch()}
        busy={isFetching}
      />
    )
  }

  const filtered = (tasks ?? []).filter((t) => visibleOwners.has(t.owner))
  const { open, done, someday } = groupTasks(filtered)
  const horizons = groupTasksByHorizon(open, timezone)

  const noTasksAtAll = !tasks?.length
  const nothingAfterFilter = !!tasks?.length && !filtered.length

  return (
    <div>
      <OwnerFilterChips visibleOwners={visibleOwners} onToggle={toggle} />

      <div className="px-4 py-2">
        {/* Open group — collapsible, expanded by default */}
        <button
          type="button"
          onClick={() => setOpenExpanded((v) => !v)}
          aria-expanded={openExpanded}
          className="mb-1 flex min-h-[44px] w-full items-center gap-1 px-1 text-left text-xs font-medium uppercase tracking-wide text-ink-faint hover:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {openExpanded
            ? <ChevronDown size={14} aria-hidden="true" />
            : <ChevronRight size={14} aria-hidden="true" />
          }
          Open ({open.length})
        </button>

        {openExpanded && (
          noTasksAtAll ? (
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
            <div className="flex flex-col gap-3">
              {(Object.keys(HORIZON_LABELS) as (keyof typeof HORIZON_LABELS)[]).map((horizon) => {
                const rows = horizons[horizon]
                if (rows.length === 0) return null
                return (
                  <div key={horizon}>
                    <h3 className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
                      {HORIZON_LABELS[horizon]} ({rows.length})
                    </h3>
                    <div className="rounded-card bg-surface shadow-card">
                      {rows.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          timezone={timezone}
                          onSnooze={() => setSnoozeTask(task)}
                          onDetail={() => { setDetailTask(task); setDetailEdit(false) }}
                          onEditDue={() => { setDetailTask(task); setDetailEdit(true) }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
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
                  <TaskRow
                    key={task.id}
                    task={task}
                    timezone={timezone}
                    onDetail={() => { setDetailTask(task); setDetailEdit(false) }}
                    onEditDue={() => { setDetailTask(task); setDetailEdit(true) }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Someday group — standalone undated tasks, collapsible, expanded by default (021) */}
        <div className="mt-4">
          <div className="mb-1 flex min-h-[44px] w-full items-center gap-1 px-1">
            <button
              type="button"
              onClick={() => setSomedayExpanded((v) => !v)}
              aria-expanded={somedayExpanded}
              className="flex min-h-[44px] flex-1 items-center gap-1 text-left text-xs font-medium uppercase tracking-wide text-ink-faint hover:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {somedayExpanded
                ? <ChevronDown size={14} aria-hidden="true" />
                : <ChevronRight size={14} aria-hidden="true" />
              }
              Someday ({someday.length})
            </button>
            {/* Force-rank is unavailable with fewer than 2 tasks — nothing to compare (FR-014) */}
            {someday.length >= 2 && (
              <button
                type="button"
                onClick={() => setForceRankOpen(true)}
                className="flex min-h-[44px] shrink-0 items-center rounded-control px-2 text-xs font-medium text-ink-muted hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Force-rank
              </button>
            )}
          </div>

          {somedayExpanded && (
            someday.length === 0 ? (
              <p className="px-1 py-4 text-sm text-ink-muted">
                Nothing parked for later — add a task without a due date to see it here.
              </p>
            ) : (
              <div className="rounded-card bg-surface shadow-card">
                {someday.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    timezone={timezone}
                    onDetail={() => { setDetailTask(task); setDetailEdit(false) }}
                    onSchedule={() => onScheduleSomeday?.(task.id)}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {snoozeTask && (
        <SnoozeDialog task={snoozeTask} onClose={() => setSnoozeTask(null)} />
      )}
      {detailTask && (
        <TaskDetailSheet
          task={detailTask}
          initialEdit={detailEdit}
          onClose={() => { setDetailTask(null); setDetailEdit(false) }}
        />
      )}
      {forceRankOpen && (
        <ForceRankDialog somedayTasks={someday} onClose={() => setForceRankOpen(false)} />
      )}
    </div>
  )
}
