import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { Settings } from '@/types/domain'

const DEFAULT_TIMEZONE = 'America/Los_Angeles'

export function useSettings() {
  const { session, authedCall, handleAuthError } = useAuth()

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      try {
        return await authedCall<{ settings: Settings }>('settings.list')
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
