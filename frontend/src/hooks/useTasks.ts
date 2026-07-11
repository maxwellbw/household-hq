import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { Task } from '@/types/domain'

export function useTasks() {
  const { session, authedCall, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      try {
        const { tasks } = await authedCall<{ tasks: Task[] }>('tasks.list')
        return tasks
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}
