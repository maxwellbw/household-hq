import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useBootstrap } from '@/hooks/useBootstrap'
import { useTheme } from '@/hooks/useTheme'
import { listenForDeepLinks } from '@/lib/deeplink'
import { AppShell } from '@/components/shell/AppShell'
import { LazyBoundary } from '@/components/shell/LazyBoundary'
import { SignInGate } from '@/components/auth/SignInGate'
import { RestoringGate } from '@/components/auth/RestoringGate'
import { BootErrorGate } from '@/components/auth/BootErrorGate'
import { ActingPersonPrompt } from '@/components/auth/ActingPersonPrompt'
import { ActingPersonAffirm } from '@/components/auth/ActingPersonAffirm'
import type { CalendarHomeProps } from '@/components/calendar/CalendarHome'
import { OwnerFilterChips } from '@/components/calendar/OwnerFilterChips'
import { useOwnerFilter } from '@/hooks/useOwnerFilter'
import { SomedayList } from '@/components/task/SomedayList'
import { ScheduleTaskDialog } from '@/components/task/ScheduleTaskDialog'
import { TasksView } from '@/components/task/TasksView'
import { ListsView } from '@/components/lists/ListsView'
import { DashboardHome } from '@/components/dashboard/DashboardHome'
import type { NavSection } from '@/components/shell/navItems'

// Feature 030 US5 (FR-018/019): Schedule-X (the calendar view's dependency) and the More
// view (activity feed) are the heaviest and least-cold-critical parts of the bundle — kept
// out of the initial chunk and fetched on demand via LazyBoundary. Dashboard/tasks/lists
// are the landing path and stay eager.
const loadCalendarHome = () =>
  import('@/components/calendar/CalendarHome').then((m) => ({ default: m.CalendarHome }))
const loadMoreView = () => import('@/components/more/MoreView').then((m) => ({ default: m.MoreView }))
type MoreViewProps = import('@/components/more/MoreView').MoreViewProps

function App() {
  // Feature 032 US1: the theme engine mounts once, above every early-return
  // gate, so sign-in/restoring/error screens re-theme with live OS changes too.
  useTheme()
  const { status, session } = useAuth()
  // Feature 030 US1: one cold-load bootstrap seeds every primary-view dataset's cache;
  // `enabled: !!session` inside the hook means this is idle (not loading) pre-sign-in.
  const bootstrap = useBootstrap()
  const { visibleOwners, toggle } = useOwnerFilter()
  const [active, setActive] = useState<NavSection>('home')
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null)
  const [prefilledDate, setPrefilledDate] = useState<string>('')
  const [calendarFocusDate, setCalendarFocusDate] = useState<string | null>(null)
  const [listsFocusName, setListsFocusName] = useState<string | null>(null)
  const [moreFocusSubscreen, setMoreFocusSubscreen] = useState<'feed' | null>(null)

  function openCalendarOnDate(dateKey: string) {
    setCalendarFocusDate(dateKey)
    setActive('calendar')
  }

  // Feature 032 US2 (FR-010, audit F-31): the dashboard's grocery nudge jumps straight to
  // the Groceries list's Needed view — same consume-on-mount pattern as calendarFocusDate.
  function openGroceriesNeeded() {
    setListsFocusName('Groceries')
    setActive('lists')
  }

  // Feature 032 US2 (FR-009): the dashboard's Lately strip jumps straight to More → Feed.
  function openFeed() {
    setMoreFocusSubscreen('feed')
    setActive('more')
  }

  // Consumed once by CalendarHome's initial mount (it seeds Schedule-X's
  // selectedDate from this prop) — cleared right after so a later, unrelated
  // visit to the Calendar tab doesn't re-jump to a stale deep-linked date.
  useEffect(() => {
    if (active === 'calendar' && calendarFocusDate) {
      setCalendarFocusDate(null)
    }
  }, [active, calendarFocusDate])

  useEffect(() => {
    if (active === 'lists' && listsFocusName) {
      setListsFocusName(null)
    }
  }, [active, listsFocusName])

  // Feature 010 US3: a tapped push notification deep-links here — cold launch via the
  // `?task=` URL param, or a warm-app postMessage from the service worker. Tasks tab is
  // the closest existing surface to "the related task" without new detail-view routing;
  // no id (or unsupported) falls through to whatever section was already active (Home by
  // default), matching the spec's fallback.
  useEffect(() => {
    return listenForDeepLinks(() => setActive('tasks'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'restoring') {
    return <RestoringGate />
  }

  // Feature 030 US2 (FR-007/010): a transient whoami or bootstrap failure lands here —
  // session preserved, recoverable via manual retry — rather than the sign-in wall.
  if (status === 'restore-error') {
    return <BootErrorGate />
  }

  if (status !== 'signed-in' || !session) {
    return <SignInGate />
  }

  if (session.who.needsActingPerson && !session.actingPerson) {
    return <ActingPersonPrompt />
  }

  // Gate the primary views' first render on the bootstrap request settling (success or
  // exhausted retries) so they never render from an empty, unseeded cache (SC-001).
  if (bootstrap.isLoading) {
    return <RestoringGate />
  }

  function openScheduleDialog(taskId: string, date = '') {
    setSchedulingTaskId(taskId)
    setPrefilledDate(date)
  }

  function closeScheduleDialog() {
    setSchedulingTaskId(null)
    setPrefilledDate('')
  }

  return (
    <AppShell active={active} onNavigate={setActive}>
      {session.who.needsActingPerson && session.actingPerson && (
        <ActingPersonAffirm person={session.actingPerson} />
      )}
      {active === 'home' && (
        <DashboardHome
          onOpenDate={openCalendarOnDate}
          onNavigateTasks={() => setActive('tasks')}
          onNavigateGroceries={openGroceriesNeeded}
          onNavigateFeed={openFeed}
        />
      )}
      {active === 'calendar' && (
        <div className="flex flex-col">
          <OwnerFilterChips visibleOwners={visibleOwners} onToggle={toggle} />
          <LazyBoundary<CalendarHomeProps>
            label="Calendar"
            loader={loadCalendarHome}
            componentProps={{ visibleOwners, focusDate: calendarFocusDate ?? undefined }}
          />
          <SomedayList visibleOwners={visibleOwners} onSchedule={openScheduleDialog} />
        </div>
      )}
      {active === 'tasks' && <TasksView onScheduleSomeday={openScheduleDialog} />}
      {active === 'lists' && <ListsView focusListName={listsFocusName ?? undefined} />}
      {active === 'more' && (
        <LazyBoundary<MoreViewProps>
          label="More"
          loader={loadMoreView}
          componentProps={{
            initialSubscreen: moreFocusSubscreen ?? undefined,
            onConsumedInitialSubscreen: () => setMoreFocusSubscreen(null),
          }}
        />
      )}

      {schedulingTaskId && (
        <ScheduleTaskDialog
          taskId={schedulingTaskId}
          initialDate={prefilledDate}
          onClose={closeScheduleDialog}
        />
      )}
    </AppShell>
  )
}

export default App
