import { useEffect, useMemo, useState } from 'react'
import { ScheduleXCalendar, useCalendarApp } from '@schedule-x/react'
import { createViewMonthGrid, createViewMonthAgenda } from '@schedule-x/calendar'
import { Temporal } from 'temporal-polyfill'
import '@schedule-x/theme-default/dist/index.css'
import './calendar-theme.css'
import { useEvents } from '@/hooks/useEvents'
import { useTasks } from '@/hooks/useTasks'
import { useSettings } from '@/hooks/useSettings'
import { toZonedDateTime, todayKey } from '@/lib/datetime'
import { buildCalendarModel, type EventWithTasks } from '@/lib/tether'
import { EventContent } from '@/components/calendar/EventContent'
import { EmptyState } from '@/components/calendar/EmptyState'
import { EventDetailSheet } from '@/components/event/EventDetailSheet'
import type { Owner } from '@/types/domain'

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const listener = () => setIsMobile(mq.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])
  return isMobile
}

interface CalendarDateRange {
  start: { toString(): string }
  end: { toString(): string }
}

interface CalendarHomeProps {
  visibleOwners: Set<Owner>
}

export function CalendarHome({ visibleOwners }: CalendarHomeProps) {
  const eventsQuery = useEvents()
  const tasksQuery = useTasks()
  const { timezone } = useSettings()
  const isMobile = useIsMobile()
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string } | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const isLoading = eventsQuery.isLoading || tasksQuery.isLoading
  const isError = eventsQuery.isError || tasksQuery.isError
  const dataUpdatedAt = Math.max(eventsQuery.dataUpdatedAt, tasksQuery.dataUpdatedAt)

  const model = useMemo(
    () => buildCalendarModel(eventsQuery.data ?? [], tasksQuery.data ?? []),
    [eventsQuery.data, tasksQuery.data],
  )

  const visibleEvents = useMemo(
    () => model.events.filter((e) => visibleOwners.has(e.owner)),
    [model.events, visibleOwners],
  )
  const visibleStandaloneTasks = useMemo(
    () => model.standaloneTasks.filter((t) => visibleOwners.has(t.owner) && t.dueDate),
    [model.standaloneTasks, visibleOwners],
  )

  const scheduleXEvents = useMemo(() => {
    const eventItems = visibleEvents.map((event: EventWithTasks) => ({
      id: event.id,
      title: event.title,
      start: toZonedDateTime(event.start, timezone),
      end: toZonedDateTime(event.end, timezone),
      owner: event.owner,
      _raw: event,
      _kind: 'event' as const,
    }))
    // Standalone tasks (no parent event) still need to appear on their own
    // date (FR-013) — rendered as all-day pseudo-events on their dueDate.
    const taskItems = visibleStandaloneTasks.map((task) => {
      const date = Temporal.PlainDate.from(task.dueDate as string)
      return {
        id: `task-${task.id}`,
        title: task.title,
        start: date,
        end: date,
        owner: task.owner,
        _raw: task,
        _kind: 'task' as const,
      }
    })
    return [...eventItems, ...taskItems]
  }, [visibleEvents, visibleStandaloneTasks, timezone])

  const calendarApp = useCalendarApp({
    views: [createViewMonthGrid(), createViewMonthAgenda()],
    defaultView: isMobile ? 'month-agenda' : 'month-grid',
    selectedDate: Temporal.PlainDate.from(todayKey(timezone)),
    events: scheduleXEvents,
    timezone,
    dayBoundaries: { start: '00:00', end: '24:00' },
    callbacks: {
      onRangeUpdate: (range: CalendarDateRange) => {
        setVisibleRange({ start: range.start.toString(), end: range.end.toString() })
      },
      onEventClick: (calendarEvent: { id: string | number }) => {
        const id = String(calendarEvent.id)
        if (!id.startsWith('task-')) setSelectedEventId(id)
      },
    },
  })

  // Schedule-X's own `events` signal must be updated in place after
  // creation — the `useCalendarApp` config above only seeds the initial
  // set; the events collection API drives subsequent updates.
  useEffect(() => {
    if (!calendarApp) return
    calendarApp.events.set(scheduleXEvents)
  }, [calendarApp, scheduleXEvents])

  const itemsInVisibleRange = useMemo(() => {
    if (!visibleRange) return [...visibleEvents, ...visibleStandaloneTasks]
    const events = visibleEvents.filter((e) => e.start < visibleRange.end && e.end > visibleRange.start)
    const tasks = visibleStandaloneTasks.filter(
      (t) => (t.dueDate as string) < visibleRange.end && (t.dueDate as string) >= visibleRange.start.slice(0, 10),
    )
    return [...events, ...tasks]
  }, [visibleEvents, visibleStandaloneTasks, visibleRange])

  const selectedEvent = selectedEventId ? visibleEvents.find((e) => e.id === selectedEventId) : null

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-ink-muted">Loading your calendar…</div>
  }

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <p className="text-ink">Couldn't load the calendar.</p>
        <button
          type="button"
          onClick={() => {
            void eventsQuery.refetch()
            void tasksQuery.refetch()
          }}
          className="min-h-[44px] rounded-control border border-border px-4 text-sm hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="sx-react-calendar-wrapper flex shrink-0 flex-col">
      <ScheduleXCalendar calendarApp={calendarApp} customComponents={{ monthGridEvent: EventContent }} />
      {itemsInVisibleRange.length === 0 && <EmptyState />}
      {dataUpdatedAt > 0 && (
        <p className="px-4 py-1 text-xs text-ink-faint">
          Last synced {new Date(dataUpdatedAt).toLocaleTimeString()}
        </p>
      )}
      {selectedEvent && (
        <EventDetailSheet event={selectedEvent} timezone={timezone} onClose={() => setSelectedEventId(null)} />
      )}
    </div>
  )
}
