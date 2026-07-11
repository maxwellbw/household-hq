import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { ActivityEntry } from '@/types/domain'

export function useActivity() {
  const { session, authedCall, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      try {
        const { entries } = await authedCall<{ entries: ActivityEntry[] }>('activity.list')
        return entries
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}
