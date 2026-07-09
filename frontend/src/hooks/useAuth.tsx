import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { fetchWhoAmI, renderSignInButton, setupGis, signOut as gisSignOut } from '@/lib/auth'
import { ApiError } from '@/lib/api'
import type { Session } from '@/types/domain'

type AuthStatus = 'signed-out' | 'authenticating' | 'signed-in' | 'forbidden' | 'error'

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
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('signed-out')
  const [session, setSession] = useState<Session | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleCredential = useCallback(async (token: string) => {
    setStatus('authenticating')
    setErrorMessage(null)
    try {
      const who = await fetchWhoAmI(token)
      setSession({ token, who })
      setStatus('signed-in')
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'FORBIDDEN' || err.code === 'ALLOWLIST_MISCONFIGURED')) {
        setStatus('forbidden')
        setErrorMessage(err.message)
      } else {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Sign-in failed.')
      }
      setSession(null)
    }
  }, [])

  const initSignInButton = useCallback(
    async (el: HTMLElement) => {
      await setupGis(handleCredential)
      await renderSignInButton(el)
    },
    [handleCredential],
  )

  const signOut = useCallback(() => {
    void gisSignOut()
    setSession(null)
    setStatus('signed-out')
    setErrorMessage(null)
  }, [])

  const setActingPerson = useCallback((person: 'max' | 'jaz') => {
    setSession((prev) => (prev ? { ...prev, actingPerson: person } : prev))
  }, [])

  const handleAuthError = useCallback((err: unknown): boolean => {
    if (err instanceof ApiError && (err.code === 'UNAUTHENTICATED' || err.code === 'INVALID_CREDENTIAL')) {
      setSession(null)
      setStatus('signed-out')
      return true
    }
    return false
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, errorMessage, initSignInButton, signOut, setActingPerson, handleAuthError }),
    [status, session, errorMessage, initSignInButton, signOut, setActingPerson, handleAuthError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
