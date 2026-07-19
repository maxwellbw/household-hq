import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { ActivityEntry } from '@/types/domain'

export function useActivity() {
  const { session, authedCall, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      try {
        // Feature 032 US3 (audit F-09 investigated): the backend's response key is
        // `activity` (backend/Api.js `readActivityFeed_`), not `entries` — the mismatch
        // made this query resolve `undefined` and reject with a React Query invariant
        // error on every real fetch, which is why Feed appeared to fail independently of
        // the other (bootstrap-seeded) views.
        const { activity } = await authedCall<{ activity: ActivityEntry[] }>('activity.list')
        return activity
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}
