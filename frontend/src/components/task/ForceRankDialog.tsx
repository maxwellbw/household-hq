import { useEffect, useMemo, useRef } from 'react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { useForceRankSession } from '@/hooks/useForceRankSession'
import { useRankTasks } from '@/hooks/useMutations'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { ErrorState } from '@/components/shell/ErrorState'
import type { Task } from '@/types/domain'

interface ForceRankDialogProps {
  /** The current live someday tasks — seeds/reconciles the session and resolves ids to titles/owners. */
  somedayTasks: Task[]
  onClose: () => void
}

/**
 * "This or that?" pairwise force-rank session (feature 021 US2): shows two someday tasks at
 * a time, binary-insertion-places the loser/winner, and persists the finished order as one
 * shared household ranking via `tasks.rank`. Same-device resumable (useForceRankSession);
 * a failed save keeps the completed comparisons and offers Try again rather than discarding
 * them (FR-016) — the prior order stays in effect until a save actually succeeds.
 */
export function ForceRankDialog({ somedayTasks, onClose }: ForceRankDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useDialogA11y(panelRef, onClose)

  const ids = useMemo(() => somedayTasks.map((t) => t.id), [somedayTasks])
  const byId = useMemo(() => new Map(somedayTasks.map((t) => [t.id, t])), [somedayTasks])
  const { session, pair, order, start, answer, reset } = useForceRankSession(ids)
  const rank = useRankTasks()
  const toast = useToast()
  const startedRef = useRef(false)

  useEffect(() => {
    if (!session && !startedRef.current) {
      startedRef.current = true
      start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    if (order && !rank.isPending && !rank.isError) {
      rank.mutate(order, {
        onSuccess: () => { reset(); onClose() },
        onError: () => toast.show("Couldn't save the new order — try again"),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

  function retrySave() {
    if (!order) return
    rank.mutate(order, {
      onSuccess: () => { reset(); onClose() },
      onError: () => toast.show("Couldn't save the new order — try again"),
    })
  }

  const total = session ? session.sorted.length + session.unsorted.length + (session.pivotId ? 1 : 0) : 0
  const placed = session ? session.sorted.length : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-scrim motion-safe:animate-in motion-safe:fade-in" aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-rank-title"
        className={cn(
          'relative z-10 w-full max-w-sm rounded-t-2xl border border-border bg-surface px-5 pb-8 pt-5 shadow-card',
          'sm:rounded-2xl',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom-4 sm:motion-safe:slide-in-from-bottom-0 sm:motion-safe:fade-in',
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="force-rank-title" className="font-display text-lg text-ink">
            This or that?
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        {order ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            {rank.isError ? (
              <ErrorState
                title="Couldn't save"
                copy="Your new order didn't save. The old order is still in effect."
                onRetry={retrySave}
                busy={rank.isPending}
              />
            ) : (
              <p className="text-sm text-ink-muted" role="status" aria-live="polite">Saving your order…</p>
            )}
          </div>
        ) : !pair ? (
          <p className="py-8 text-center text-sm text-ink-muted" role="status" aria-live="polite">
            Getting your list ready…
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-muted" role="status" aria-live="polite">Placed {placed} of {total}</p>
            <div className="flex flex-col gap-3" role="group" aria-labelledby="force-rank-title">
              {[pair.a, pair.b].map((id) => {
                const task = byId.get(id)
                if (!task) return null
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => answer(id)}
                    className={cn(
                      'flex min-h-[56px] items-center gap-3 rounded-control border border-border bg-bg px-4 py-3 text-left transition-colors',
                      'hover:border-accent hover:bg-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-surface',
                        task.owner === 'max' && 'bg-owner-max',
                        task.owner === 'jaz' && 'bg-owner-jaz',
                        task.owner === 'both' && 'bg-accent-hover',
                      )}
                      aria-hidden="true"
                    >
                      {task.owner === 'both' ? 'MJ' : task.owner === 'max' ? 'M' : 'J'}
                    </span>
                    <span className="text-sm text-ink">{task.title}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
