import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { DogWalk } from '@/types/domain'

export function useDogWalks() {
  const { session, authedCall, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['dogWalks'],
    queryFn: async () => {
      try {
        const { dogWalks } = await authedCall<{ dogWalks: DogWalk[] }>('dogwalks.list')
        return dogWalks
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}
