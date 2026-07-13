import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { listenForDeepLinks } from '@/lib/deeplink'
import { AppShell } from '@/components/shell/AppShell'
import { SignInGate } from '@/components/auth/SignInGate'
import { RestoringGate } from '@/components/auth/RestoringGate'
import { ActingPersonPrompt } from '@/components/auth/ActingPersonPrompt'
import { ActingPersonAffirm } from '@/components/auth/ActingPersonAffirm'
import { CalendarHome } from '@/components/calendar/CalendarHome'
import { OwnerFilterChips } from '@/components/calendar/OwnerFilterChips'
import { useOwnerFilter } from '@/hooks/useOwnerFilter'
import { SomedayList } from '@/components/task/SomedayList'
import { ScheduleTaskDialog } from '@/components/task/ScheduleTaskDialog'
import { TasksView } from '@/components/task/TasksView'
import { ListsView } from '@/components/lists/ListsView'
import { MoreView } from '@/components/more/MoreView'
import { DashboardHome } from '@/components/dashboard/DashboardHome'
import type { NavSection } from '@/components/shell/navItems'

function App() {
  const { status, session } = useAuth()
  const { visibleOwners, toggle } = useOwnerFilter()
  const [active, setActive] = useState<NavSection>('home')
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null)
  const [prefilledDate, setPrefilledDate] = useState<string>('')
  const [calendarFocusDate, setCalendarFocusDate] = useState<string | null>(null)

  function openCalendarOnDate(dateKey: string) {
    setCalendarFocusDate(dateKey)
    setActive('calendar')
  }

  // Consumed once by CalendarHome's initial mount (it seeds Schedule-X's
  // selectedDate from this prop) — cleared right after so a later, unrelated
  // visit to the Calendar tab doesn't re-jump to a stale deep-linked date.
  useEffect(() => {
    if (active === 'calendar' && calendarFocusDate) {
      setCalendarFocusDate(null)
    }
  }, [active, calendarFocusDate])

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

  if (status !== 'signed-in' || !session) {
    return <SignInGate />
  }

  if (session.who.needsActingPerson && !session.actingPerson) {
    return <ActingPersonPrompt />
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
      {active === 'home' && <DashboardHome onOpenDate={openCalendarOnDate} />}
      {active === 'calendar' && (
        <div className="flex flex-col">
          <OwnerFilterChips visibleOwners={visibleOwners} onToggle={toggle} />
          <CalendarHome visibleOwners={visibleOwners} focusDate={calendarFocusDate ?? undefined} />
          <SomedayList visibleOwners={visibleOwners} onSchedule={openScheduleDialog} />
        </div>
      )}
      {active === 'tasks' && <TasksView onScheduleSomeday={openScheduleDialog} />}
      {active === 'lists' && <ListsView />}
      {active === 'more' && <MoreView />}

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
