import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  fetchWhoAmI,
  promptSilent,
  renderSignInButton,
  setupGis,
  signOut as gisSignOut,
} from '@/lib/auth'
import { apiCall, ApiError } from '@/lib/api'
import * as sessionStore from '@/lib/session-store'
import type { Session, WhoAmI } from '@/types/domain'

type AuthStatus = 'restoring' | 'signed-out' | 'authenticating' | 'signed-in' | 'forbidden' | 'error'

const SILENT_SIGN_IN_TIMEOUT_MS = 4000

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
  /**
   * Authenticated API call that transparently refreshes an expired credential
   * once and retries, instead of surfacing the auth error (feature 018 US2).
   */
  authedCall: <T>(action: string, payload?: Record<string, unknown>) => Promise<T>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isForbidden(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.code === 'FORBIDDEN' || err.code === 'ALLOWLIST_MISCONFIGURED')
}

function isAuthExpired(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.code === 'UNAUTHENTICATED' || err.code === 'INVALID_CREDENTIAL')
}

/**
 * Silently obtain a fresh credential via GIS auto-select (feature 018
 * research R1/R3). Registers a one-shot credential callback and races it
 * against GIS reporting a decline (moment listener) or a timeout — whichever
 * settles first wins. Callers must treat rejection as "fall back to
 * interactive sign-in", never retry in a loop.
 */
function acquireTokenSilently(): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Silent sign-in timed out'))
    }, SILENT_SIGN_IN_TIMEOUT_MS)

    void setupGis((token) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(token)
    })

    void promptSilent().then((outcome) => {
      if (settled) return
      if (outcome === 'declined') {
        settled = true
        clearTimeout(timer)
        reject(new Error('Silent sign-in declined'))
      }
    })
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring')
  const [session, setSession] = useState<Session | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)
  const refreshPromiseRef = useRef<Promise<string> | null>(null)

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

  const commitSignedIn = useCallback((token: string, who: WhoAmI) => {
    tokenRef.current = token
    const seeded = who.needsActingPerson ? (sessionStore.getActingPerson() ?? undefined) : undefined
    setSession({ token, who, actingPerson: seeded })
    setStatus('signed-in')
    setErrorMessage(null)
    sessionStore.setAutoSignIn()
  }, [])

  // Boot: attempt a silent restore when a prior sign-in left the hint set;
  // otherwise go straight to the sign-in wall (FR-001/FR-005).
  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!sessionStore.getAutoSignIn()) {
        setStatus('signed-out')
        return
      }
      try {
        const token = await acquireTokenSilently()
        if (cancelled) return
        const result = await applyCredential(token)
        if (cancelled) return
        if (result.ok) {
          commitSignedIn(token, result.who)
        } else if (isForbidden(result.err)) {
          setStatus('forbidden')
          setErrorMessage(result.err.message)
        } else {
          setStatus('signed-out')
        }
      } catch {
        if (!cancelled) setStatus('signed-out')
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
        commitSignedIn(token, result.who)
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

  const handleAuthError = useCallback((err: unknown): boolean => {
    if (isAuthExpired(err)) {
      setSession(null)
      tokenRef.current = null
      setStatus('signed-out')
      return true
    }
    return false
  }, [])

  // Single-flight silent refresh used by authedCall when a stale token
  // surfaces mid-session (feature 018 US2 / research R3). Concurrent callers
  // share one in-flight prompt rather than each triggering their own.
  const refreshToken = useCallback((): Promise<string> => {
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = acquireTokenSilently()
        .then(async (token) => {
          const result = await applyCredential(token)
          if (!result.ok) {
            throw result.err instanceof Error ? result.err : new Error('Refresh failed')
          }
          commitSignedIn(token, result.who)
          return token
        })
        .catch((err: unknown) => {
          setSession(null)
          tokenRef.current = null
          setStatus('signed-out')
          throw err
        })
        .finally(() => {
          refreshPromiseRef.current = null
        })
    }
    return refreshPromiseRef.current
  }, [applyCredential, commitSignedIn])

  const authedCall = useCallback(
    async <T,>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
      const token = tokenRef.current
      if (!token) throw new ApiError('UNAUTHENTICATED', 'Not signed in.')
      try {
        return await apiCall<T>(action, payload, { token, actingPerson: session?.actingPerson })
      } catch (err) {
        if (!isAuthExpired(err)) throw err
        const freshToken = await refreshToken()
        return await apiCall<T>(action, payload, { token: freshToken, actingPerson: session?.actingPerson })
      }
    },
    [refreshToken, session?.actingPerson],
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
