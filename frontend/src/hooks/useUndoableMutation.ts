import { useToast } from '@/hooks/useToast'

interface MutationLike<TVariables> {
  mutate: (variables: TVariables, options?: { onSuccess?: () => void; onError?: () => void }) => void
}

interface UseUndoableMutationOptions<TForwardVariables> {
  /** Toast copy, or a function of the forward variables (e.g. to include the task title). */
  label: string | ((variables: TForwardVariables) => string)
  windowMs?: number
}

/**
 * Wires an immediate forward commit to a single-slot Undo toast (feature 032 US3, contract
 * C3): `forward` fires right away — no confirm dialog — and on success shows `label` with an
 * Undo action that re-invokes `inverse`. Both `forward` and `inverse` must already be
 * existing idempotent mutations (e.g. useCompleteTask/useReopenTask); this hook adds no
 * mutation logic of its own, only the toast wiring. Returns a `commit` function taking the
 * forward mutation's variables and, separately, whatever variables `inverse` needs (often
 * the same value, e.g. a task id — but list-item delete/re-add need different shapes).
 */
export function useUndoableMutation<TForwardVariables, TInverseVariables = TForwardVariables>(
  forward: MutationLike<TForwardVariables>,
  inverse: MutationLike<TInverseVariables>,
  { label, windowMs }: UseUndoableMutationOptions<TForwardVariables>,
) {
  const toast = useToast()

  return function commit(forwardVariables: TForwardVariables, inverseVariables: TInverseVariables) {
    forward.mutate(forwardVariables, {
      onSuccess: () => {
        const text = typeof label === 'function' ? label(forwardVariables) : label
        toast.showUndo(text, () => inverse.mutate(inverseVariables), windowMs)
      },
    })
  }
}
