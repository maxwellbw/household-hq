import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Settings } from '@/types/domain'

const DEFAULT_TIMEZONE = 'America/Los_Angeles'

export function useSettings() {
  const { session, handleAuthError } = useAuth()

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        return await apiCall<{ settings: Settings }>('settings.list', {}, { token: session!.token })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })

  return {
    ...query,
    timezone: query.data?.settings.timezone || DEFAULT_TIMEZONE,
  }
}
