import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { RecurringRule } from '@/types/domain'

export function useRecurring() {
  const { session, authedCall, handleAuthError } = useAuth()
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      try {
        const { recurring } = await authedCall<{ recurring: RecurringRule[] }>('recurring.list')
        return recurring
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}

export function useCreateRecurringRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<RecurringRule, 'id' | 'lastGenerated'>) => {
      try {
        return await authedCall<{ recurring: RecurringRule }>('recurring.create', payload as Record<string, unknown>)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useUpdateRecurringRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<RecurringRule> & { id: string }) => {
      try {
        return await authedCall<{ recurring: RecurringRule }>('recurring.update', payload as Record<string, unknown>)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useDeleteRecurringRule() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await authedCall<{ id: string }>('recurring.delete', { id })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  })
}
