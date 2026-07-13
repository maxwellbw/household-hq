import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchWhoAmI, renderSignInButton, setupGis, signOut as gisSignOut } from '@/lib/auth'
import { apiCall, ApiError } from '@/lib/api'
import * as sessionStore from '@/lib/session-store'
import type { Session, WhoAmI } from '@/types/domain'

type AuthStatus = 'restoring' | 'signed-out' | 'authenticating' | 'signed-in' | 'forbidden' | 'error'

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  errorMessage: string | null
  /** Call once from a mounted DOM node to set up + render the GIS sign-in button. */
  initSignInButton: (el: HTMLElement) => Promise<void>
  signOut: () => void
  setActingPerson: (person: 'max' | 'jaz') => void
  /** Call from any data hook's error handler; resets to signed-out on auth failures. Returns true if handled. */
  handleAuthError: (err: unknown) => boolean
  /** Authenticated API call using the current household session token (feature 018 rev.). */
  authedCall: <T>(action: string, payload?: Record<string, unknown>) => Promise<T>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isForbidden(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.code === 'FORBIDDEN' || err.code === 'ALLOWLIST_MISCONFIGURED')
}

function isAuthExpired(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.code === 'UNAUTHENTICATED' || err.code === 'INVALID_CREDENTIAL')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring')
  const [session, setSession] = useState<Session | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)

  const applyCredential = useCallback(
    async (token: string): Promise<{ ok: true; who: WhoAmI } | { ok: false; err: unknown }> => {
      try {
        const who = await fetchWhoAmI(token)
        return { ok: true, who }
      } catch (err) {
        return { ok: false, err }
      }
    },
    [],
  )

  // whoami always answers with a freshly minted session token (sliding 30-day
  // window) — that fresh token, not the credential we presented, becomes both
  // the in-memory credential and the persisted one (feature 018 rev.).
  const commitSignedIn = useCallback((who: WhoAmI) => {
    tokenRef.current = who.sessionToken
    sessionStore.setSessionToken(who.sessionToken)
    const seeded = who.needsActingPerson ? (sessionStore.getActingPerson() ?? undefined) : undefined
    setSession({ token: who.sessionToken, who, actingPerson: seeded })
    setStatus('signed-in')
    setErrorMessage(null)
  }, [])

  const dropSession = useCallback(() => {
    sessionStore.clearSessionToken()
    setSession(null)
    tokenRef.current = null
    setStatus('signed-out')
  }, [])

  // Boot: restore from the persisted session token — one whoami round-trip, no
  // Google involvement (FR-001/FR-005). Nothing stored → the sign-in wall.
  useEffect(() => {
    let cancelled = false

    async function restore() {
      const stored = sessionStore.getSessionToken()
      if (!stored) {
        setStatus('signed-out')
        return
      }
      const result = await applyCredential(stored)
      if (cancelled) return
      if (result.ok) {
        commitSignedIn(result.who)
      } else if (isForbidden(result.err)) {
        sessionStore.clearSessionToken()
        setStatus('forbidden')
        setErrorMessage(result.err.message)
      } else if (isAuthExpired(result.err)) {
        dropSession()
      } else {
        // Transient failure (offline, server hiccup): keep the stored token so
        // the next launch restores silently; this visit falls back to the wall.
        setStatus('signed-out')
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCredential = useCallback(
    async (token: string) => {
      setStatus('authenticating')
      setErrorMessage(null)
      const result = await applyCredential(token)
      if (result.ok) {
        commitSignedIn(result.who)
        return
      }
      if (isForbidden(result.err)) {
        setStatus('forbidden')
        setErrorMessage(result.err.message)
      } else {
        setStatus('error')
        setErrorMessage(result.err instanceof Error ? result.err.message : 'Sign-in failed.')
      }
      setSession(null)
      tokenRef.current = null
    },
    [applyCredential, commitSignedIn],
  )

  const initSignInButton = useCallback(
    async (el: HTMLElement) => {
      await setupGis(handleCredential)
      await renderSignInButton(el)
    },
    [handleCredential],
  )

  const signOut = useCallback(() => {
    void gisSignOut()
    sessionStore.clear()
    setSession(null)
    tokenRef.current = null
    setStatus('signed-out')
    setErrorMessage(null)
  }, [])

  const setActingPerson = useCallback((person: 'max' | 'jaz') => {
    sessionStore.setActingPerson(person)
    setSession((prev) => (prev ? { ...prev, actingPerson: person } : prev))
  }, [])

  const handleAuthError = useCallback(
    (err: unknown): boolean => {
      if (isAuthExpired(err)) {
        dropSession()
        return true
      }
      return false
    },
    [dropSession],
  )

  // With a 30-day token renewed on every boot, mid-session expiry is a rare
  // edge (a tab left open for a month): fall back to the sign-in wall rather
  // than attempting any silent Google re-auth — that path proved unreliable.
  const authedCall = useCallback(
    async <T,>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
      const token = tokenRef.current
      if (!token) throw new ApiError('UNAUTHENTICATED', 'Not signed in.')
      try {
        return await apiCall<T>(action, payload, { token, actingPerson: session?.actingPerson })
      } catch (err) {
        if (isAuthExpired(err)) dropSession()
        throw err
      }
    },
    [dropSession, session?.actingPerson],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      errorMessage,
      initSignInButton,
      signOut,
      setActingPerson,
      handleAuthError,
      authedCall,
    }),
    [status, session, errorMessage, initSignInButton, signOut, setActingPerson, handleAuthError, authedCall],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
