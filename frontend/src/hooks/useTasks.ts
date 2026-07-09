import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Task } from '@/types/domain'

export function useTasks() {
  const { session, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      try {
        const { tasks } = await apiCall<{ tasks: Task[] }>('tasks.list', {}, { token: session!.token })
        return tasks
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}
