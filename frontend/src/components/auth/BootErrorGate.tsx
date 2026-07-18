import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useBootstrap } from '@/hooks/useBootstrap'
import { Button } from '@/components/ui/button'

/**
 * Feature 030 US2 (FR-007/010): shown when boot restore or the initial bootstrap keeps
 * failing after its bounded auto-retries — a stalled connection or a flaky server, not a
 * real auth rejection. The stored session token is untouched, so "Retry" re-runs restore +
 * bootstrap and lands signed-in with no Google re-auth once the underlying condition clears.
 */
export function BootErrorGate() {
  const { retryRestore } = useAuth()
  const bootstrap = useBootstrap()
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    setRetrying(true)
    try {
      await Promise.all([retryRestore(), bootstrap.refetch()])
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <h1 className="font-display text-2xl text-ink">Household HQ</h1>

      <div className="max-w-sm space-y-2">
        <p className="text-ink">Couldn't load your household data.</p>
        <p className="text-sm text-ink-muted">
          Check your connection and try again — you're still signed in, nothing was lost.
        </p>
      </div>

      <Button
        className="min-h-[44px]"
        onClick={() => void handleRetry()}
        disabled={retrying}
        aria-busy={retrying}
      >
        <RefreshCw className={retrying ? 'animate-spin' : undefined} aria-hidden="true" />
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
      <span className="sr-only" aria-live="polite">
        {retrying ? 'Retrying…' : ''}
      </span>
    </div>
  )
}
