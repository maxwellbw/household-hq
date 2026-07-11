/**
 * Shown briefly while a returning user's session is being silently restored
 * on app boot (feature 018 FR-005). Distinct from both the signed-in app and
 * the sign-in wall — no household data is reachable here.
 */
export function RestoringGate() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <h1 className="font-display text-2xl text-ink">Household HQ</h1>
      <p className="text-sm text-ink-muted" aria-live="polite">
        Signing you back in…
      </p>
    </div>
  )
}
