import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { Event, Owner, RecurringRule, Task } from '@/types/domain'
import type { NewEventInput, NewOneTimeTaskInput, NewRecurringInput } from '@/lib/quickAdd'
import { buildEventPayload, buildOneTimeTaskPayload, buildRecurringPayload } from '@/lib/quickAdd'
import type { ScheduleDraft } from '@/lib/schedule'
import { buildSchedulePayload } from '@/lib/schedule'

const SAVE_ERROR_MESSAGE = "Couldn't save — try again"

type EventCreatePayload = { id: string; title: string; start: string; end: string; owner: Owner; type?: string; notes?: string; location?: string; templateId?: string }
type TaskCreatePayload = { id: string; title: string; owner: Owner; dueDate?: string; notes?: string }

/** Create an event (US5/US2 R2) — optimistic insert using a client-minted id (the
 *  optimistic row *is* the real row; backend id-replay makes retries duplicate-proof),
 *  revert + toast on failure, invalidate on settle. */
export function useCreateEvent() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: async (input: NewEventInput) => {
      try {
        return await authedCall('events.create', buildEventPayload(input))
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (input: NewEventInput) => {
      await queryClient.cancelQueries({ queryKey: ['events'] })
      const previous = queryClient.getQueryData<Event[]>(['events'])
      const payload = buildEventPayload(input) as EventCreatePayload
      const optimistic: Event = {
        id: payload.id,
        title: payload.title,
        start: payload.start,
        end: payload.end,
        owner: payload.owner,
        type: payload.type,
        notes: payload.notes,
        location: payload.location,
        templateId: payload.templateId,
      }
      queryClient.setQueryData<Event[] | undefined>(['events'], (old) => (old ? [...old, optimistic] : [optimistic]))
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(['events'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })

  const withId = (input: NewEventInput): NewEventInput => ({ ...input, id: input.id ?? crypto.randomUUID() })
  return {
    ...mutation,
    mutate: (input: NewEventInput, options?: Parameters<typeof mutation.mutate>[1]) => mutation.mutate(withId(input), options),
    mutateAsync: (input: NewEventInput) => mutation.mutateAsync(withId(input)),
  }
}

/** Create a recurring rule from quick-add (US4 030) — optimistic insert into ['recurring']
 *  using a client-minted id, same id-replay pattern as useCreateEvent; instances themselves
 *  materialize via the existing nightly generator so ['tasks'] isn't touched optimistically,
 *  only invalidated on settle as a safety net (unchanged from before this conversion). */
export function useCreateRecurring() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: async (input: NewRecurringInput & { id: string }) => {
      try {
        return await authedCall('recurring.create', { ...buildRecurringPayload(input), id: input.id })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (input: NewRecurringInput & { id: string }) => {
      await queryClient.cancelQueries({ queryKey: ['recurring'] })
      const previous = queryClient.getQueryData<RecurringRule[]>(['recurring'])
      const optimistic: RecurringRule = {
        id: input.id,
        title: input.title,
        cadence: input.cadence,
        anchorDate: input.anchorDate,
        defaultOwner: input.defaultOwner,
        lastGenerated: '',
      }
      queryClient.setQueryData<RecurringRule[] | undefined>(['recurring'], (old) => (old ? [...old, optimistic] : [optimistic]))
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(['recurring'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const withId = (input: NewRecurringInput): NewRecurringInput & { id: string } => ({ ...input, id: crypto.randomUUID() })
  return {
    ...mutation,
    mutate: (input: NewRecurringInput, options?: Parameters<typeof mutation.mutate>[1]) => mutation.mutate(withId(input), options),
    mutateAsync: (input: NewRecurringInput) => mutation.mutateAsync(withId(input)),
  }
}

/** Create a one-time task (US5/US2 R2) — optimistic insert using a client-minted id, same
 *  shape as useCreateEvent above. */
export function useCreateOneTimeTask(timezone: string) {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: async (input: NewOneTimeTaskInput) => {
      try {
        return await authedCall('tasks.create', buildOneTimeTaskPayload(input, timezone))
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (input: NewOneTimeTaskInput) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      const payload = buildOneTimeTaskPayload(input, timezone) as TaskCreatePayload
      const optimistic: Task = {
        id: payload.id,
        title: payload.title,
        owner: payload.owner,
        status: 'open',
        dueDate: payload.dueDate,
        notes: payload.notes,
      }
      queryClient.setQueryData<Task[] | undefined>(['tasks'], (old) => (old ? [...old, optimistic] : [optimistic]))
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const withId = (input: NewOneTimeTaskInput): NewOneTimeTaskInput => ({ ...input, id: input.id ?? crypto.randomUUID() })
  return {
    ...mutation,
    mutate: (input: NewOneTimeTaskInput, options?: Parameters<typeof mutation.mutate>[1]) => mutation.mutate(withId(input), options),
    mutateAsync: (input: NewOneTimeTaskInput) => mutation.mutateAsync(withId(input)),
  }
}

/** Update an existing event (US4/US2 R2) — optimistic patch, revert + toast on failure,
 *  invalidate on settle. */
export function useUpdateEvent() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (payload: {
      id: string
      title?: string
      start?: string
      end?: string
      owner?: Owner
      notes?: string
      location?: string
      templateId?: string
    }) => {
      try {
        return await authedCall('events.update', payload)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['events'] })
      const previous = queryClient.getQueryData<Event[]>(['events'])
      queryClient.setQueryData<Event[] | undefined>(['events'], (old) =>
        old?.map((e) => (e.id === payload.id ? { ...e, ...payload } : e)),
      )
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['events'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
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

/** Schedule a someday task by setting its dueDate + owner via tasks.update (FR-009).
 *  Optimistic patch (US4 030) — revert on failure (ScheduleTaskDialog surfaces its own
 *  toast from the rejected mutateAsync), invalidate on settle. */
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
    onMutate: async (draft: ScheduleDraft) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      const payload = buildSchedulePayload(draft)
      queryClient.setQueryData<Task[] | undefined>(['tasks'], (old) =>
        old?.map((t) => (t.id === payload.id ? { ...t, dueDate: payload.dueDate, owner: payload.owner } : t)),
      )
      return { previous }
    },
    onError: (_err, _draft, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/** Update a task's title/owner/dueDate/notes (US2 R2) — dueDate: '' clears the date.
 *  Optimistic patch, revert + toast on failure, invalidate on settle. */
export function useUpdateTask() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (payload: { id: string; title?: string; owner?: Owner; dueDate?: string; notes?: string }) => {
      try {
        return await authedCall('tasks.update', payload)
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      queryClient.setQueryData<Task[] | undefined>(['tasks'], (old) =>
        old?.map((t) => (t.id === payload.id ? { ...t, ...payload } : t)),
      )
      return { previous }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous)
      toast.show(SAVE_ERROR_MESSAGE)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/** Persist a completed force-rank session as the shared household Someday order (021 US2) —
 *  `order` is task IDs best-to-worst; the backend writes dense ranks in one batch and clears
 *  any rank no longer in the list. Optimistic patch (US4 030) mirrors that exactly — revert
 *  on failure (ForceRankDialog surfaces its own toast/retry), invalidate on settle. */
export function useRankTasks() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (order: string[]) => {
      try {
        return await authedCall<{ ranked: number }>('tasks.rank', { order })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onMutate: async (order: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      const rankOf = new Map(order.map((id, i) => [id, String(i + 1)]))
      queryClient.setQueryData<Task[] | undefined>(['tasks'], (old) =>
        old?.map((t) => ({ ...t, somedayRank: rankOf.get(t.id) ?? '' })),
      )
      return { previous }
    },
    onError: (_err, _order, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/** Delete a task (022 US2) — server hard-deletes + mirror cleanup; instance-only for
 *  recurring-generated tasks (rule untouched). Optimistic removal (US4 030) — revert on
 *  failure (TaskDetailSheet surfaces its own error toast at the call site), invalidate on
 *  settle. Supersedes the prior "no optimistic removal: rare/destructive" stance now that
 *  revert-on-failure is the established recovery path for every save in the app. */
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
    onMutate: async (taskId: string) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData<Task[]>(['tasks'])
      queryClient.setQueryData<Task[] | undefined>(['tasks'], (old) => old?.filter((t) => t.id !== taskId))
      return { previous }
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

/** Delete an event (022 US2) — server hard-deletes, purges all its prep tasks (done +
 *  outstanding), and removes the calendar mirror. Optimistic removal (US4 030) of both the
 *  event and its cascaded prep tasks, revert on failure (EventDetailSheet surfaces its own
 *  error toast at the call site), invalidate both on settle. */
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
    onMutate: async (eventId: string) => {
      await queryClient.cancelQueries({ queryKey: ['events'] })
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previousEvents = queryClient.getQueryData<Event[]>(['events'])
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks'])
      queryClient.setQueryData<Event[] | undefined>(['events'], (old) => old?.filter((e) => e.id !== eventId))
      queryClient.setQueryData<Task[] | undefined>(['tasks'], (old) => old?.filter((t) => t.eventId !== eventId))
      return { previousEvents, previousTasks }
    },
    onError: (_err, _eventId, context) => {
      if (context?.previousEvents) queryClient.setQueryData(['events'], context.previousEvents)
      if (context?.previousTasks) queryClient.setQueryData(['tasks'], context.previousTasks)
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
