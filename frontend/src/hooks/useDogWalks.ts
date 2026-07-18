import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import type { DogWalk, DogWalkDayPlan } from '@/types/domain'

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

/**
 * The day planner's payload (feature 031 US2, T030): loaded on demand only when the planner
 * opens for a given date, not folded into `data.bootstrap` (research R7) — bootstrap is the
 * cold-load path feature 030 slimmed down, and a per-day planner payload for every day in
 * the horizon would undo that. `date` is `null` while the planner is closed.
 */
export function useDogWalkDay(date: string | null) {
  const { session, authedCall, handleAuthError } = useAuth()

  return useQuery({
    queryKey: ['dogWalkDay', date],
    queryFn: async () => {
      try {
        return await authedCall<DogWalkDayPlan>('dogwalks.day', { date })
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    enabled: !!session && !!date,
  })
}

export interface BookWalkInput {
  date: string
  slot: 'primary' | 'second'
  windowStart: string
  windowEnd: string
  durationMin: number
  confirmOverride?: boolean
}

/** Invalidate both the day-specific and the dashboard-wide walk queries — a booking action
 *  changes what both `dogwalks.day` and `dogwalks.list` return for this date. */
function invalidateDogWalkQueries(queryClient: ReturnType<typeof useQueryClient>, date: string) {
  queryClient.invalidateQueries({ queryKey: ['dogWalkDay', date] })
  queryClient.invalidateQueries({ queryKey: ['dogWalks'] })
}

/**
 * Book a window (feature 031 US3, T046). No optimistic update — the resulting row (status,
 * invite ids) is server-computed and a mispredicted optimistic value would just have to be
 * rolled back. On an `OVERRIDE_REQUIRED` response, the thrown `ApiError`'s `.details` carries
 * `{failedGates, conflicts}` for the caller to render as a confirmation step (T048) and
 * resubmit with `confirmOverride: true` — this hook does not treat that as a toast-worthy
 * failure, it's the caller's job to interpret the error code.
 */
export function useBookWalk() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: BookWalkInput) => {
      try {
        const { dogWalk } = await authedCall<{ dogWalk: DogWalk }>('dogwalks.book', { ...input })
        return dogWalk
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSettled: (_data, _err, input) => invalidateDogWalkQueries(queryClient, input.date),
  })
}

/** Remove a booked walk (T046) — idempotent on the backend, so a retry/double-tap is safe. */
export function useUnbookWalk() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { date: string; slot: 'primary' | 'second' }) => {
      try {
        const { dogWalk } = await authedCall<{ dogWalk: DogWalk }>('dogwalks.unbook', input)
        return dogWalk
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSettled: (_data, _err, input) => invalidateDogWalkQueries(queryClient, input.date),
  })
}

/** Hand a user-decided day back to automatic handling (T046, FR-022). */
export function useReleaseWalk() {
  const { authedCall, handleAuthError } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { date: string; slot: 'primary' | 'second' }) => {
      try {
        const { dogWalk } = await authedCall<{ dogWalk: DogWalk }>('dogwalks.release', input)
        return dogWalk
      } catch (err) {
        handleAuthError(err)
        throw err
      }
    },
    onSettled: (_data, _err, input) => invalidateDogWalkQueries(queryClient, input.date),
  })
}
