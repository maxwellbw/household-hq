import { useEffect, useMemo, useState } from 'react'
import { ScheduleXCalendar, useCalendarApp } from '@schedule-x/react'
import { createViewMonthGrid, createViewMonthAgenda } from '@schedule-x/calendar'
import { Temporal } from 'temporal-polyfill'
import '@schedule-x/theme-default/dist/index.css'
import './calendar-theme.css'
import { useEvents } from '@/hooks/useEvents'
import { useTasks } from '@/hooks/useTasks'
import { useSettings } from '@/hooks/useSettings'
import { useDogWalks } from '@/hooks/useDogWalks'
import { isOverdue, todayKey, toZonedDateTime, weekRange } from '@/lib/datetime'
import { needsDecisionDays, upcomingWalks } from '@/lib/dogwalks'
import { buildCalendarModel, type EventWithTasks } from '@/lib/tether'
import { taskDisplayDateKey, type CalendarItem } from '@/lib/calendarItems'
import { EventContent } from '@/components/calendar/EventContent'
import { MonthAgendaDateDots } from '@/components/calendar/MonthAgendaDateDots'
import { EmptyState } from '@/components/calendar/EmptyState'
import { CalendarViewSwitcher } from '@/components/calendar/CalendarViewSwitcher'
import { DayListView, type CalendarViewMode } from '@/components/calendar/DayListView'
import { EventDetailSheet } from '@/components/event/EventDetailSheet'
import { TaskDetailSheet } from '@/components/task/TaskDetailSheet'
import { ErrorState } from '@/components/shell/ErrorState'
import { SyncedAt } from '@/components/shell/SyncedAt'
import type { DogWalk, Owner } from '@/types/domain'

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

// Feature 029 US7 — pinned root cause: `@schedule-x/react`'s `ScheduleXCalendar` runs its
// setup effect on `[calendarApp, customComponents, randomId]` and its cleanup calls
// `calendarApp.destroy()`, so ANY new `customComponents` reference fully tears down and
// re-renders the entire calendar (every chip), not just the changed ones. An inline object
// literal in the JSX below recreated on every `CalendarHome` render — including a harmless
// background refetch of unchanged data — reproducibly caused `calendarApp.destroy()` to
// fire on every settle (confirmed live: 71/71 event DOM nodes replaced, `destroy()` called,
// while `calendarApp.events.set()` was never even invoked). Hoisting this object to module
// scope keeps its reference stable — `EventContent` is a stable import — so the effect
// no-ops on an unchanged refetch and the flash is gone.
const CUSTOM_COMPONENTS = { monthGridEvent: EventContent, monthAgendaEvent: EventContent, monthAgendaDateDots: MonthAgendaDateDots }

// Feature 033 T030/FR-022: Schedule-X pre-slices the month-agenda day's `events` to this
// count before our MonthAgendaDateDots component ever sees them — set well above any
// plausible daily item count so the owner-dedup there sees the true day, not an
// arbitrarily truncated one (the dedup's own 3-owner cap is what actually bounds the UI).
const MONTH_AGENDA_EVENT_INDICATORS_PER_DAY = 20

// Desktop month-grid per-day chip cap before collapsing into "+N more"
// (feature 017 FR-008) — tuned to stay within one grid-cell row at the
// app's desktop widths.
const MONTH_GRID_EVENTS_PER_DAY = 3

export interface CalendarHomeProps {
  visibleOwners: Set<Owner>
  focusDate?: string
  /** Called once after mount, having already captured `focusDate` — lets the caller clear its
   *  own signal without racing this component's lazy-loaded mount (feature 033 F-04 fix,
   *  research R4: the previous effect-on-`active` pattern in App.tsx cleared before the
   *  dynamic import resolved, so the seeded date was lost; mirrors MoreView's
   *  `onConsumedInitialSubscreen`). */
  onConsumedFocusDate?: () => void
  /** Opens the App-level dog-walk planner sheet for a date (FR-010) — walk chips/rows in
   *  every calendar view route through this. */
  onOpenWalkPlanner: (dateKey: string) => void
}

export function CalendarHome({ visibleOwners, focusDate, onConsumedFocusDate, onOpenWalkPlanner }: CalendarHomeProps) {
  const eventsQuery = useEvents()
  const tasksQuery = useTasks()
  const dogWalksQuery = useDogWalks()
  const { timezone } = useSettings()
  const isMobile = useIsMobile()
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string } | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [mode, setMode] = useState<CalendarViewMode>('month')
  const [anchorDate, setAnchorDate] = useState<string>(() => focusDate ?? todayKey(timezone))

  // Feature 033 F-04 fix (research R4): consume-on-mount, not effect-on-tab-switch — `focusDate`
  // is already seeded into `anchorDate`/`calendarApp`'s initial `selectedDate` above; this just
  // tells the caller its signal has been captured, once, so a later unrelated visit to the
  // Calendar tab doesn't re-jump to a stale deep-linked date.
  useEffect(() => {
    onConsumedFocusDate?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isLoading = eventsQuery.isLoading || tasksQuery.isLoading
  const isError = eventsQuery.isError || tasksQuery.isError
  const dataUpdatedAt = Math.max(eventsQuery.dataUpdatedAt, tasksQuery.dataUpdatedAt)
  const today = todayKey(timezone)

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

  // Feature 011: booked/suggested dog walks as a read-only event source, owner 'both'
  // (research R12) — always shown regardless of the owner filter chips, since a walk
  // belongs to the household, not a filterable person.
  const visibleDogWalks = useMemo(
    () => upcomingWalks(dogWalksQuery.data ?? [], timezone),
    [dogWalksQuery.data, timezone],
  )
  const dogWalkFlags = useMemo(
    () => needsDecisionDays(dogWalksQuery.data ?? [], timezone),
    [dogWalksQuery.data, timezone],
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
    // date (FR-013) — rendered as all-day pseudo-events on their dueDate,
    // or on today with an Overdue badge when past due (FR-012, display-only:
    // the stored dueDate is never touched).
    const taskItems = visibleStandaloneTasks.map((task) => {
      const displayKey = taskDisplayDateKey(task, timezone, today) as string
      const date = Temporal.PlainDate.from(displayKey)
      return {
        id: `task-${task.id}`,
        title: task.title,
        start: date,
        end: date,
        owner: task.owner,
        _raw: task,
        _kind: 'task' as const,
        _overdue: isOverdue(task, today),
      }
    })
    // Feature 011: booked/suggested dog walks. Feature 033 US4 (F-02): tapping opens the
    // planner for the walk's own date — carried as `_dateKey` rather than re-derived from
    // `id`, since `useCalendarApp`'s config (including `callbacks`) is captured once at
    // mount (schedule-x/react has no re-render sync for it) while `calendarApp.events.set()`
    // below does keep the event objects themselves fresh every render.
    const dogWalkItems = visibleDogWalks.map((walk) => ({
      id: `dogwalk-${walk.id}`,
      title: 'Dog walk',
      start: toZonedDateTime(walk.windowStart as string, timezone),
      end: toZonedDateTime(walk.windowEnd as string, timezone),
      owner: 'both' as const,
      _raw: walk,
      _kind: 'dogwalk' as const,
      _dateKey: walk.date,
    }))
    // Feature 011: needs-decision days as all-day warning markers (no window to place a
    // timed chip on), so the finder's "you handle this one" days are visible on the calendar
    // itself, not only the dashboard notice. Feature 033 US4: tapping opens the planner too.
    const dogWalkFlagItems = dogWalkFlags.map((walk) => {
      const date = Temporal.PlainDate.from(walk.date)
      return {
        id: `dogwalk-flag-${walk.id}`,
        title: 'Dog walk — needs a decision',
        start: date,
        end: date,
        owner: 'both' as const,
        _kind: 'dogwalk-flag' as const,
        _reason: walk.reason,
        _dateKey: walk.date,
      }
    })
    return [...eventItems, ...taskItems, ...dogWalkItems, ...dogWalkFlagItems]
  }, [visibleEvents, visibleStandaloneTasks, visibleDogWalks, dogWalkFlags, timezone, today])

  const calendarApp = useCalendarApp({
    views: [createViewMonthGrid(), createViewMonthAgenda()],
    defaultView: isMobile ? 'month-agenda' : 'month-grid',
    // Sunday-first everywhere (feature 017 FR-005, R2) — installed build's
    // FirstDayOfWeek enum: MONDAY=1 … SATURDAY=6, SUNDAY=7.
    firstDayOfWeek: 7,
    monthGridOptions: { nEventsPerDay: MONTH_GRID_EVENTS_PER_DAY },
    monthAgendaOptions: { nEventIndicatorsPerDay: MONTH_AGENDA_EVENT_INDICATORS_PER_DAY },
    // Schedule-X's own breakpoint-based view-switcher (default true) fights our
    // useIsMobile() choice and destroys/recreates the event DOM on every resize
    // (address-bar show/hide, orientation change) — a likely cause of taps
    // silently missing (research R4b). We already own the mobile/desktop split.
    isResponsive: false,
    selectedDate: Temporal.PlainDate.from(focusDate ?? today),
    events: scheduleXEvents,
    timezone,
    dayBoundaries: { start: '00:00', end: '24:00' },
    callbacks: {
      onRangeUpdate: (range: CalendarDateRange) => {
        setVisibleRange({ start: range.start.toString(), end: range.end.toString() })
      },
      onEventClick: (calendarEvent: { id: string | number; _kind?: string; _dateKey?: string }) => {
        const id = String(calendarEvent.id)
        // Feature 033 US4/F-02: a walk chip (booked or needs-decision) is read-only — no
        // detail sheet — but opens the day planner for its date.
        if (calendarEvent._kind === 'dogwalk' || calendarEvent._kind === 'dogwalk-flag') {
          if (calendarEvent._dateKey) onOpenWalkPlanner(calendarEvent._dateKey)
          return
        }
        if (id.startsWith('task-')) {
          setSelectedTaskId(id.slice('task-'.length))
        } else {
          setSelectedEventId(id)
        }
      },
      // Month-grid overflow ("+N more") jumps to a focused single-day list
      // for that date (feature 017 FR-009, clarified 2026-07-11) rather than
      // an in-place popover.
      onClickPlusEvents: (date: { toString(): string }) => {
        setAnchorDate(date.toString())
        setMode('day')
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
  const selectedTask = selectedTaskId ? visibleStandaloneTasks.find((t) => t.id === selectedTaskId) : null

  function handleItemClick(item: CalendarItem) {
    if (item.kind === 'dogwalk' || item.kind === 'dogwalk-flag') {
      onOpenWalkPlanner((item.raw as DogWalk).date)
      return
    }
    if (item.kind === 'task') {
      setSelectedTaskId(item.id)
    } else {
      setSelectedEventId(item.id)
    }
  }

  function handleViewChange(next: Exclude<CalendarViewMode, 'day'>) {
    setMode(next)
    if (next === 'week') setAnchorDate(weekRange(timezone).startKey)
    if (next === 'next7') setAnchorDate(today)
  }

  function handleDayListNavigate(deltaDays: number) {
    setAnchorDate((prev) => Temporal.PlainDate.from(prev).add({ days: deltaDays }).toString())
  }

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-ink-muted">Loading your calendar…</div>
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load the calendar"
        copy="Check your connection and try again."
        onRetry={() => {
          void eventsQuery.refetch()
          void tasksQuery.refetch()
        }}
        busy={eventsQuery.isFetching || tasksQuery.isFetching}
      />
    )
  }

  return (
    <div className="sx-react-calendar-wrapper flex shrink-0 flex-col">
      <CalendarViewSwitcher mode={mode === 'day' ? 'month' : mode} onChange={handleViewChange} />
      {mode === 'month' ? (
        <ScheduleXCalendar calendarApp={calendarApp} customComponents={CUSTOM_COMPONENTS} />
      ) : (
        <DayListView
          mode={mode}
          anchorDate={anchorDate}
          events={visibleEvents}
          standaloneTasks={visibleStandaloneTasks}
          dogWalks={visibleDogWalks}
          dogWalkFlags={dogWalkFlags}
          timezone={timezone}
          onItemClick={handleItemClick}
          onNavigate={handleDayListNavigate}
        />
      )}
      {itemsInVisibleRange.length === 0 && <EmptyState />}
      <SyncedAt updatedAt={dataUpdatedAt} />
      {selectedEvent && (
        <EventDetailSheet event={selectedEvent} timezone={timezone} onClose={() => setSelectedEventId(null)} />
      )}
      {selectedTask && (
        <TaskDetailSheet task={selectedTask} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  )
}
