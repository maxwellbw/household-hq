import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { ActivityEntry } from '@/types/domain'

export function useActivity() {
  const { session, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['activity'],
    queryFn: async () => {
      try {
        const { entries } = await apiCall<{ entries: ActivityEntry[] }>(
          'activity.list',
          {},
          { token: session!.token },
        )
        return entries
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}
