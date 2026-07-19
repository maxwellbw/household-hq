import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  title: string
  copy: string
  onRetry: () => void
  /** True while the retry is in flight (contract C2) — disables the button and swaps its
   *  label/icon so repeated taps can't stack requests. */
  busy?: boolean
}

/** Shared error/retry surface (feature 032 US3, contract C2): every data view's `isError`
 *  branch adopts this instead of a bespoke dead-end message (audit F-09). Repeated failure
 *  after Retry just returns here — the same honest state, never a second spinner on top. */
export function ErrorState({ title, copy, onRetry, busy = false }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <p className="font-display text-lg text-ink">{title}</p>
      <p className="text-sm text-ink-muted">{copy}</p>
      <Button className="min-h-[44px]" onClick={onRetry} disabled={busy}>
        <RefreshCw aria-hidden="true" className={busy ? 'animate-spin' : undefined} />
        {busy ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  )
}
