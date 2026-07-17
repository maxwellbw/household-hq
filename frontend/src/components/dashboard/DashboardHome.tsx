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
import { monthRange, weekRange } from '@/lib/datetime'
import { SmartViews } from '@/components/dashboard/SmartViews'
import { LoadBalance } from '@/components/dashboard/LoadBalance'
import { Highlights } from '@/components/dashboard/Highlights'
import { SevenDayStrip } from '@/components/dashboard/SevenDayStrip'
import { DayPeekPanel } from '@/components/dashboard/DayPeekPanel'
import { AckNotices } from '@/components/dashboard/AckNotices'
import { DogWalkNotice } from '@/components/dashboard/DogWalkNotice'
import { GroceryNudge } from '@/components/dashboard/GroceryNudge'
import { TaskDetailSheet } from '@/components/task/TaskDetailSheet'
import { EventDetailSheet } from '@/components/event/EventDetailSheet'
import type { Task } from '@/types/domain'

interface DashboardHomeProps {
  onOpenDate: (dateKey: string) => void
}

export function DashboardHome({ onOpenDate }: DashboardHomeProps) {
  const tasksQuery = useTasks()
  const eventsQuery = useEvents()
  const recurringQuery = useRecurring()
  const { timezone, data: settingsData } = useSettings()
  const listItemsQuery = useListItems()
  const dogWalksQuery = useDogWalks()
  const { session } = useAuth()
  const [peekDateKey, setPeekDateKey] = useState<string | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)

  const isPending = tasksQuery.isPending || eventsQuery.isPending || recurringQuery.isPending
  const isError = tasksQuery.isError || eventsQuery.isError || recurringQuery.isError

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
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <p className="font-display text-lg text-ink">Couldn't load the dashboard</p>
        <p className="text-sm text-ink-muted">Check your connection and try again.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col py-2">
      <AckNotices notices={notices} />
      <DogWalkNotice notices={dogWalkNoticeItems} onOpenDate={onOpenDate} />
      <GroceryNudge show={showGroceryNudge} />
      <SevenDayStrip tiles={strip} activeDateKey={peekDateKey} onToggleDate={toggleDate} />
      {peekDateKey && peekItems && (
        <DayPeekPanel
          dateKey={peekDateKey}
          events={peekItems.events}
          tasks={peekItems.tasks}
          walks={peekWalks}
          timezone={timezone}
          onOpenCalendar={onOpenDate}
          onOpenTask={setDetailTask}
          onOpenEvent={(event) => setDetailEventId(event.id)}
        />
      )}
      <SmartViews views={views} timezone={timezone} />
      <LoadBalance weekBalance={weekBal} monthBalance={monthBal} viewer={viewer} />
      <Highlights items={highlightItems} />
      {detailTask && <TaskDetailSheet task={detailTask} onClose={() => setDetailTask(null)} />}
      {detailEvent && <EventDetailSheet event={detailEvent} timezone={timezone} onClose={() => setDetailEventId(null)} />}
    </div>
  )
}
