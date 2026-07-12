import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { RecurringEventRule } from '@/types/domain'

export function useRecurringEvents() {
  const { session, authedCall, handleAuthError } = useAuth()
  return useQuery({
    queryKey: ['recurringEvents'],
    queryFn: async () => {
      try {
        const { recurringEvents } = await authedCall<{ recurringEvents: RecurringEventRule[] }>('recurringEvents.list')
        return recurringEvents
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}

export function useCreateRecurringEventRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<RecurringEventRule, 'id' | 'lastGenerated'>) => {
      try {
        return await authedCall<{ recurringEvent: RecurringEventRule }>('recurringEvents.create', payload as Record<string, unknown>)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringEvents'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
  })
}

export function useUpdateRecurringEventRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RecurringEventRule> & { id: string }) => {
      try {
        return await authedCall<{ recurringEvent: RecurringEventRule }>('recurringEvents.update', payload as Record<string, unknown>)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurringEvents'] }),
  })
}

export function useDeleteRecurringEventRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await authedCall<{ id: string }>('recurringEvents.delete', { id })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurringEvents'] }),
  })
}
