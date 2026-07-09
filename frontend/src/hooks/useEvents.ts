import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Event } from '@/types/domain'

export function useEvents() {
  const { session, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      try {
        const { events } = await apiCall<{ events: Event[] }>('events.list', {}, { token: session!.token })
        return events
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}
