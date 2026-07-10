import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/shell/AppShell'
import { SignInGate } from '@/components/auth/SignInGate'
import { ActingPersonPrompt } from '@/components/auth/ActingPersonPrompt'
import { CalendarHome } from '@/components/calendar/CalendarHome'
import { OwnerFilterChips } from '@/components/calendar/OwnerFilterChips'
import { useOwnerFilter } from '@/hooks/useOwnerFilter'
import { SomedayList } from '@/components/task/SomedayList'
import { ScheduleTaskDialog } from '@/components/task/ScheduleTaskDialog'
import { TasksView } from '@/components/task/TasksView'
import { FeedView } from '@/components/feed/FeedView'
import { MoreView } from '@/components/more/MoreView'
import type { NavSection } from '@/components/shell/navItems'

function App() {
  const { status, session } = useAuth()
  const { visibleOwners, toggle } = useOwnerFilter()
  const [active, setActive] = useState<NavSection>('calendar')
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null)
  const [prefilledDate, setPrefilledDate] = useState<string>('')

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
      {active === 'calendar' && (
        <div className="flex flex-col">
          <OwnerFilterChips visibleOwners={visibleOwners} onToggle={toggle} />
          <CalendarHome visibleOwners={visibleOwners} />
          <SomedayList visibleOwners={visibleOwners} onSchedule={openScheduleDialog} />
        </div>
      )}
      {active === 'tasks' && <TasksView />}
      {active === 'feed' && <FeedView />}
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
