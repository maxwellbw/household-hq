import { useEffect, useRef } from 'react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  title: string
  body?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  isPending?: boolean
}

/** Reusable destructive-action confirmation, modeled on SnoozeDialog's overlay + a11y (022 US2). */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose, isPending = false }: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useDialogA11y(panelRef, onClose)

  // Cancel takes initial focus — safer default for a destructive action (research.md R2).
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-t-card bg-surface p-5 shadow-card sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-lg text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        {body && <p className="mb-5 text-sm text-ink-muted">{body}</p>}

        <div className="flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-control border border-border bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="min-h-[44px] flex-1 rounded-control bg-danger px-4 text-sm font-medium text-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
