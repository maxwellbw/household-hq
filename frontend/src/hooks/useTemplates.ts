import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { TaskTemplate } from '@/types/domain'

const SAVE_ERROR_MESSAGE = "Couldn't save — try again"

export function useTemplates() {
  const { session, authedCall, handleAuthError } = useAuth()
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      try {
        const { templates } = await authedCall<{ templates: TaskTemplate[] }>('templates.list')
        return templates
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session,
  })
}

/** Optimistic create (US4 030, client-minted id — same id-replay pattern as useCreateEvent). */
export function useCreateTemplate() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: async (payload: Omit<TaskTemplate, 'id'> & { id: string }) => {
      try {
        return await authedCall<{ template: TaskTemplate }>('templates.create', payload as Record<string, unknown>)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['templates'] })
      const previous = queryClient.getQueryData<TaskTemplate[]>(['templates'])
      const optimistic: TaskTemplate = { ...payload }
      queryClient.setQueryData<TaskTemplate[] | undefined>(['templates'], (old) => (old ? [...old, optimistic] : [optimistic]))
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['templates'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  })

  return {
    ...mutation,
    mutate: (payload: Omit<TaskTemplate, 'id'>, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ ...payload, id: crypto.randomUUID() }, options),
    mutateAsync: (payload: Omit<TaskTemplate, 'id'>) => mutation.mutateAsync({ ...payload, id: crypto.randomUUID() }),
  }
}

/** Optimistic patch (US4 030), revert + toast on failure, invalidate on settle. */
export function useUpdateTemplate() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (payload: Partial<TaskTemplate> & { id: string }) => {
      try {
        return await authedCall<{ template: TaskTemplate }>('templates.update', payload as Record<string, unknown>)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['templates'] })
      const previous = queryClient.getQueryData<TaskTemplate[]>(['templates'])
      queryClient.setQueryData<TaskTemplate[] | undefined>(['templates'], (old) =>
        old?.map((t) => (t.id === payload.id ? { ...t, ...payload } : t)),
      )
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['templates'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  })
}

/** Optimistic removal (US4 030), revert + toast on failure. */
export function useDeleteTemplate() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await authedCall<{ id: string }>('templates.delete', { id })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['templates'] })
      const previous = queryClient.getQueryData<TaskTemplate[]>(['templates'])
      queryClient.setQueryData<TaskTemplate[] | undefined>(['templates'], (old) => old?.filter((t) => t.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['templates'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  })
}
