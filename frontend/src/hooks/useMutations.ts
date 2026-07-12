import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { Owner, Task } from '@/types/domain'
import type { NewEventInput, NewOneTimeTaskInput, NewRecurringInput } from '@/lib/quickAdd'
import { buildEventPayload, buildOneTimeTaskPayload, buildRecurringPayload } from '@/lib/quickAdd'
import type { ScheduleDraft } from '@/lib/schedule'
import { buildSchedulePayload } from '@/lib/schedule'

/** Quick-add creates (US5) — invalidate the relevant list on success so the new item appears immediately. */
export function useCreateEvent() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewEventInput) => {
      try {
        return await authedCall('events.create', buildEventPayload(input))
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useCreateRecurring() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewRecurringInput) => {
      try {
        return await authedCall('recurring.create', buildRecurringPayload(input))
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useCreateOneTimeTask(timezone: string) {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewOneTimeTaskInput) => {
      try {
        return await authedCall('tasks.create', buildOneTimeTaskPayload(input, timezone))
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/** Update an existing event (US4) — invalidate events on success. */
export function useUpdateEvent() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id: string
      title?: string
      start?: string
      end?: string
      owner?: Owner
      notes?: string
      location?: string
    }) => {
      try {
        return await authedCall('events.update', payload)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
}

/** Task check-off / reopen (US6) — optimistic flip, revert + plain error on failure. */
function useSetTaskStatus(action: 'tasks.complete' | 'tasks.reopen', nextStatus: Task['status']) {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taskId: string) => {
      try {
        return await authedCall(action, { id: taskId })
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
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, dueDate }: { id: string; dueDate: string }) => {
      try {
        return await authedCall('tasks.snooze', { id, dueDate })
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

/** Schedule a someday task by setting its dueDate + owner via tasks.update (FR-009). */
export function useScheduleTask() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (draft: ScheduleDraft) => {
      try {
        return await authedCall('tasks.update', buildSchedulePayload(draft))
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/** Update a task's title/owner/dueDate/notes (US2) — dueDate: '' clears the date. */
export function useUpdateTask() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; title?: string; owner?: Owner; dueDate?: string; notes?: string }) => {
      try {
        return await authedCall('tasks.update', payload)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/** Delete a task (022 US2) — server hard-deletes + mirror cleanup; instance-only for
 *  recurring-generated tasks (rule untouched). No optimistic removal: rare/destructive. */
export function useDeleteTask() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      try {
        return await authedCall('tasks.delete', { id: taskId })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/** Delete an event (022 US2) — server hard-deletes, purges all its prep tasks (done +
 *  outstanding), and removes the calendar mirror. Invalidates both events and tasks. */
export function useDeleteEvent() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (eventId: string) => {
      try {
        return await authedCall('events.delete', { id: eventId })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

/** Unsnooze a task — optimistic flip back to 'open', invalidate on settle. */
export function useUnsnoozeTask() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      try {
        return await authedCall('tasks.unsnooze', { id: taskId })
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

/** Acknowledge/commit to an assigned task ("I've got it", feature 019 US2) — optimistic
 *  ackBy flip to the acting person, invalidate on settle. Server enforces that only the
 *  current owner may acknowledge and pings the assigner best-effort. */
export function useAcknowledgeTask() {
  const { authedCall, handleAuthError, session } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      try {
        return await authedCall('tasks.acknowledge', { id: taskId })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      const actor = session?.who.identity === 'shared' ? session.actingPerson : session?.who.identity
      queryClient.setQueryData<Task[] | undefined>(['tasks'], (old) =>
        old?.map((t) => (t.id === taskId && actor ? { ...t, ackBy: actor as Owner } : t)),
      )
      return { previous }
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}
