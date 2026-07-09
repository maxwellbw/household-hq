import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/shell/AppShell'
import { SignInGate } from '@/components/auth/SignInGate'
import { ActingPersonPrompt } from '@/components/auth/ActingPersonPrompt'
import { CalendarHome } from '@/components/calendar/CalendarHome'
import { OwnerFilterChips } from '@/components/calendar/OwnerFilterChips'
import { useOwnerFilter } from '@/hooks/useOwnerFilter'

function App() {
  const { status, session } = useAuth()
  const { visibleOwners, toggle } = useOwnerFilter()

  if (status !== 'signed-in' || !session) {
    return <SignInGate />
  }

  if (session.who.needsActingPerson && !session.actingPerson) {
    return <ActingPersonPrompt />
  }

  return (
    <AppShell>
      <OwnerFilterChips visibleOwners={visibleOwners} onToggle={toggle} />
      <CalendarHome visibleOwners={visibleOwners} />
    </AppShell>
  )
}

export default App
