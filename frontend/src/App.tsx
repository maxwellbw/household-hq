import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/shell/AppShell'
import { SignInGate } from '@/components/auth/SignInGate'
import { ActingPersonPrompt } from '@/components/auth/ActingPersonPrompt'
import { CalendarHome } from '@/components/calendar/CalendarHome'
import { OwnerFilterChips } from '@/components/calendar/OwnerFilterChips'
import { useOwnerFilter } from '@/hooks/useOwnerFilter'
import { TasksView } from '@/components/task/TasksView'
import { FeedView } from '@/components/feed/FeedView'
import { MoreView } from '@/components/more/MoreView'
import type { NavSection } from '@/components/shell/navItems'

function App() {
  const { status, session } = useAuth()
  const { visibleOwners, toggle } = useOwnerFilter()
  const [active, setActive] = useState<NavSection>('calendar')

  if (status !== 'signed-in' || !session) {
    return <SignInGate />
  }

  if (session.who.needsActingPerson && !session.actingPerson) {
    return <ActingPersonPrompt />
  }

  return (
    <AppShell active={active} onNavigate={setActive}>
      {active === 'calendar' && (
        <>
          <OwnerFilterChips visibleOwners={visibleOwners} onToggle={toggle} />
          <CalendarHome visibleOwners={visibleOwners} />
        </>
      )}
      {active === 'tasks' && <TasksView />}
      {active === 'feed' && <FeedView />}
      {active === 'more' && <MoreView />}
    </AppShell>
  )
}

export default App
