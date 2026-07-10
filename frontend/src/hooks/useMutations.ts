import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { Task } from '@/types/domain'
import type { NewEventInput, NewOneTimeTaskInput, NewRecurringInput } from '@/lib/quickAdd'
import { buildEventPayload, buildOneTimeTaskPayload, buildRecurringPayload } from '@/lib/quickAdd'

/** Quick-add creates (US5) — invalidate the relevant list on success so the new item appears immediately. */
export function useCreateEvent() {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewEventInput) => {
      try {
        return await apiCall(
          'events.create',
          buildEventPayload(input),
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useCreateRecurring() {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewRecurringInput) => {
      try {
        return await apiCall(
          'recurring.create',
          buildRecurringPayload(input),
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useCreateOneTimeTask(timezone: string) {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewOneTimeTaskInput) => {
      try {
        return await apiCall(
          'tasks.create',
          buildOneTimeTaskPayload(input, timezone),
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/** Task check-off / reopen (US6) — optimistic flip, revert + plain error on failure. */
function useSetTaskStatus(action: 'tasks.complete' | 'tasks.reopen', nextStatus: Task['status']) {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taskId: string) => {
      try {
        return await apiCall(action, { id: taskId }, { token: session!.token, actingPerson: session!.actingPerson })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      queryClient.setQueryData<Task[] | undefined>(['tasks'], (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t)),
      )
      return { previous }
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useCompleteTask() {
  return useSetTaskStatus('tasks.complete', 'done')
}

export function useReopenTask() {
  return useSetTaskStatus('tasks.reopen', 'open')
}

/** Snooze a task to a new dueDate — optimistic flip to 'snoozed', invalidate on settle. */
export function useSnoozeTask() {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dueDate }: { id: string; dueDate: string }) => {
      try {
        return await apiCall(
          'tasks.snooze',
          { id, dueDate },
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      queryClient.setQueryData<Task[] | undefined>(['tasks'], (old) =>
        old?.map((t) => (t.id === id ? { ...t, status: 'snoozed' as const } : t)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/** Unsnooze a task — optimistic flip back to 'open', invalidate on settle. */
export function useUnsnoozeTask() {
  const { session, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      try {
        return await apiCall(
          'tasks.unsnooze',
          { id: taskId },
          { token: session!.token, actingPerson: session!.actingPerson },
        )
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      queryClient.setQueryData<Task[] | undefined>(['tasks'], (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, status: 'open' as const } : t)),
      )
      return { previous }
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}
