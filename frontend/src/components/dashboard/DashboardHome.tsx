import { useMemo, useState } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useEvents } from '@/hooks/useEvents'
import { useRecurring } from '@/hooks/useRecurring'
import { useSettings } from '@/hooks/useSettings'
import { useListItems } from '@/hooks/useLists'
import { useDogWalks } from '@/hooks/useDogWalks'
import { useAuth } from '@/hooks/useAuth'
import { highlights, itemsForDay, loadBalance, resolveViewer, sevenDayTiles, smartViews } from '@/lib/dashboard'
import { ackNotices } from '@/lib/ackNotices'
import { dogWalkNotices, walksForDay } from '@/lib/dogwalks'
import { shouldShowGroceryNudge } from '@/lib/lists'
import { buildCalendarModel } from '@/lib/tether'
import { monthRange, todayKey, weekRange } from '@/lib/datetime'
import { WeekendSection } from '@/components/dashboard/WeekendSection'
import { OverdueSection } from '@/components/dashboard/OverdueSection'
import { LoadBalance } from '@/components/dashboard/LoadBalance'
import { LatelyStrip } from '@/components/dashboard/LatelyStrip'
import { SevenDayStrip } from '@/components/dashboard/SevenDayStrip'
import { DayPeekPanel } from '@/components/dashboard/DayPeekPanel'
import { AckNotices } from '@/components/dashboard/AckNotices'
import { DogWalkNotice } from '@/components/dashboard/DogWalkNotice'
import { DogWalkPlanner } from '@/components/dashboard/DogWalkPlanner'
import { GroceryNudge } from '@/components/dashboard/GroceryNudge'
import { Highlights } from '@/components/dashboard/Highlights'
import { ErrorState } from '@/components/shell/ErrorState'
import { TaskDetailSheet } from '@/components/task/TaskDetailSheet'
import { EventDetailSheet } from '@/components/event/EventDetailSheet'
import type { Task } from '@/types/domain'

interface DashboardHomeProps {
  onOpenDate: (dateKey: string) => void
  /** Navigates to the Tasks tab (Overdue section's "view all", contract C7). */
  onNavigateTasks: () => void
  /** Navigates to Lists → Groceries → Needed (FR-010, audit F-31). */
  onNavigateGroceries: () => void
  /** Navigates to More → Feed (Lately strip's "See all", FR-009). */
  onNavigateFeed: () => void
}

export function DashboardHome({ onOpenDate, onNavigateTasks, onNavigateGroceries, onNavigateFeed }: DashboardHomeProps) {
  const tasksQuery = useTasks()
  const eventsQuery = useEvents()
  const recurringQuery = useRecurring()
  const { timezone, data: settingsData } = useSettings()
  const listItemsQuery = useListItems()
  const dogWalksQuery = useDogWalks()
  const { session } = useAuth()
  // Feature 032 US2 (contract C7): today is pre-selected on mount so the merged day card
  // (events + walk status + tasks due) is the dashboard's default "now" surface, not a
  // second tap away.
  const [peekDateKey, setPeekDateKey] = useState<string | null>(() => todayKey(timezone))
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)
  const [plannerDateKey, setPlannerDateKey] = useState<string | null>(null)

  const isPending = tasksQuery.isPending || eventsQuery.isPending || recurringQuery.isPending
  const isError = tasksQuery.isError || eventsQuery.isError || recurringQuery.isError

  const todayK = todayKey(timezone)

  const views = useMemo(
    () => smartViews(tasksQuery.data ?? [], eventsQuery.data ?? [], timezone),
    [tasksQuery.data, eventsQuery.data, timezone],
  )

  const weekBal = useMemo(
    () => loadBalance(tasksQuery.data ?? [], weekRange(timezone)),
    [tasksQuery.data, timezone],
  )

  const monthBal = useMemo(
    () => loadBalance(tasksQuery.data ?? [], monthRange(timezone)),
    [tasksQuery.data, timezone],
  )

  const viewer = resolveViewer(session)

  const notices = useMemo(() => ackNotices(tasksQuery.data ?? [], viewer), [tasksQuery.data, viewer])

  const highlightItems = useMemo(
    () => highlights(eventsQuery.data ?? [], recurringQuery.data ?? [], tasksQuery.data ?? [], timezone),
    [eventsQuery.data, recurringQuery.data, tasksQuery.data, timezone],
  )

  const dogWalkNoticeItems = useMemo(
    () => dogWalkNotices(dogWalksQuery.data ?? [], timezone),
    [dogWalksQuery.data, timezone],
  )

  const strip = useMemo(
    () => sevenDayTiles(tasksQuery.data ?? [], eventsQuery.data ?? [], timezone, dogWalksQuery.data ?? []),
    [tasksQuery.data, eventsQuery.data, timezone, dogWalksQuery.data],
  )

  const peekItems = useMemo(
    () => (peekDateKey ? itemsForDay(tasksQuery.data ?? [], eventsQuery.data ?? [], peekDateKey, timezone) : null),
    [peekDateKey, tasksQuery.data, eventsQuery.data, timezone],
  )

  const peekWalks = useMemo(
    () => (peekDateKey ? walksForDay(dogWalksQuery.data ?? [], peekDateKey) : []),
    [peekDateKey, dogWalksQuery.data],
  )

  const calendarModel = useMemo(
    () => buildCalendarModel(eventsQuery.data ?? [], tasksQuery.data ?? []),
    [eventsQuery.data, tasksQuery.data],
  )
  const detailEvent = useMemo(
    () => (detailEventId ? (calendarModel.events.find((e) => e.id === detailEventId) ?? null) : null),
    [detailEventId, calendarModel],
  )

  function toggleDate(dateKey: string) {
    setPeekDateKey((prev) => (prev === dateKey ? null : dateKey))
  }

  const showGroceryNudge = useMemo(
    () => shouldShowGroceryNudge(listItemsQuery.data ?? [], settingsData?.settings.groceryStapleNudgeThreshold),
    [listItemsQuery.data, settingsData],
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6" aria-busy="true" aria-label="Loading dashboard">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-alt" />
            <div className="h-11 animate-pulse rounded-control bg-surface-alt" />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load the dashboard"
        copy="Check your connection and try again."
        onRetry={() => {
          void tasksQuery.refetch()
          void eventsQuery.refetch()
          void recurringQuery.refetch()
        }}
        busy={tasksQuery.isFetching || eventsQuery.isFetching || recurringQuery.isFetching}
      />
    )
  }

  // Feature 032 US2 (FR-008): when Overdue is empty, OverdueSection renders nothing — the
  // merged region's single warm empty line is today's card, worded to cover both regions.
  const overdueEmpty = views.overdue.tasks.length === 0
  const todayCardEmptyMessage =
    peekDateKey === todayK && overdueEmpty ? 'Nothing due and nothing overdue — enjoy the quiet.' : undefined

  return (
    <div className="flex flex-col py-2">
      <AckNotices notices={notices} />
      <DogWalkNotice notices={dogWalkNoticeItems} onOpenDate={onOpenDate} />
      <GroceryNudge show={showGroceryNudge} onNavigate={onNavigateGroceries} />
      <OverdueSection tasks={views.overdue.tasks} timezone={timezone} onViewAll={onNavigateTasks} />
      <SevenDayStrip tiles={strip} activeDateKey={peekDateKey} onToggleDate={toggleDate} />
      {peekDateKey && peekItems && (
        <DayPeekPanel
          dateKey={peekDateKey}
          events={peekItems.events}
          tasks={peekItems.tasks}
          walks={peekWalks}
          timezone={timezone}
          emptyMessage={todayCardEmptyMessage}
          onOpenCalendar={onOpenDate}
          onOpenTask={setDetailTask}
          onOpenEvent={(event) => setDetailEventId(event.id)}
          onOpenWalkPlanner={setPlannerDateKey}
        />
      )}
      <LatelyStrip onSeeAll={onNavigateFeed} />
      <WeekendSection tasks={views.weekend.tasks} events={views.weekend.events} timezone={timezone} />
      <LoadBalance weekBalance={weekBal} monthBalance={monthBal} viewer={viewer} />
      <Highlights items={highlightItems} />
      {detailTask && <TaskDetailSheet task={detailTask} onClose={() => setDetailTask(null)} />}
      {detailEvent && <EventDetailSheet event={detailEvent} timezone={timezone} onClose={() => setDetailEventId(null)} />}
      {plannerDateKey && (
        <DogWalkPlanner dateKey={plannerDateKey} timezone={timezone} onClose={() => setPlannerDateKey(null)} />
      )}
    </div>
  )
}
