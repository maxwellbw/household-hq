import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { Event } from '@/types/domain'

export function useEvents() {
  const { session, authedCall, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      try {
        const { events } = await authedCall<{ events: Event[] }>('events.list')
        return events
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}
