import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'

/**
 * Signed-out, authenticating, and refusal states all render here — no
 * household data is ever reachable from this component (FR-004/005).
 */
export function SignInGate() {
  const { status, errorMessage, initSignInButton } = useAuth()
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (buttonRef.current) {
      void initSignInButton(buttonRef.current)
    }
    // Render once on mount; GIS owns the button's lifecycle after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <h1 className="font-display text-2xl text-ink">Household HQ</h1>

      {status === 'forbidden' ? (
        <div className="max-w-sm space-y-2">
          <p className="text-ink">This account isn't on the household list.</p>
          <p className="text-sm text-ink-muted">
            {errorMessage || 'Ask Max or Jaz to add your email in Settings, or sign in with a different account.'}
          </p>
        </div>
      ) : status === 'error' ? (
        <div className="max-w-sm space-y-2">
          <p className="text-ink">Something went wrong signing you in.</p>
          <p className="text-sm text-ink-muted">{errorMessage || 'Please try again.'}</p>
        </div>
      ) : (
        <p className="max-w-sm text-sm text-ink-muted">Sign in with Google to see what's coming up.</p>
      )}

      <div ref={buttonRef} aria-busy={status === 'authenticating'} />

      {status === 'authenticating' && <p className="text-sm text-ink-faint">Signing you in…</p>}
    </div>
  )
}
