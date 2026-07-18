import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './useAuth'
import { ApiError } from '@/lib/api'
import * as sessionStore from '@/lib/session-store'

const { fetchWhoAmIMock, setupGisMock, signOutMock, apiCallMock } = vi.hoisted(() => ({
  fetchWhoAmIMock: vi.fn(),
  setupGisMock: vi.fn(),
  signOutMock: vi.fn(),
  apiCallMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  fetchWhoAmI: fetchWhoAmIMock,
  setupGis: setupGisMock,
  renderSignInButton: vi.fn(),
  signOut: signOutMock,
}))

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, apiCall: apiCallMock }
})

const PERSONAL_WHO = {
  identity: 'max' as const,
  displayName: 'Max',
  email: 'max@x.com',
  needsActingPerson: false,
  sessionToken: 'hqs1.fresh.sig',
}
const SHARED_WHO = {
  identity: 'shared' as const,
  displayName: 'Household',
  email: 'h@x.com',
  needsActingPerson: true,
  sessionToken: 'hqs1.fresh.sig',
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  localStorage.clear()
  fetchWhoAmIMock.mockReset()
  setupGisMock.mockReset()
  signOutMock.mockReset()
  apiCallMock.mockReset()
  setupGisMock.mockImplementation(async () => {})
})

describe('boot restore', () => {
  it('goes straight to signed-out when no session token is stored', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    expect(fetchWhoAmIMock).not.toHaveBeenCalled()
  })

  it('restores to signed-in from the stored session token and persists the renewed one', async () => {
    sessionStore.setSessionToken('hqs1.stored.sig')
    fetchWhoAmIMock.mockResolvedValue(PERSONAL_WHO)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    expect(fetchWhoAmIMock).toHaveBeenCalledWith('hqs1.stored.sig')
    // The freshly minted token from whoami replaces the presented one everywhere.
    expect(result.current.session?.token).toBe('hqs1.fresh.sig')
    expect(sessionStore.getSessionToken()).toBe('hqs1.fresh.sig')
  })

  it('seeds the remembered acting person on restore for the shared account', async () => {
    sessionStore.setSessionToken('hqs1.stored.sig')
    sessionStore.setActingPerson('jaz')
    fetchWhoAmIMock.mockResolvedValue(SHARED_WHO)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    expect(result.current.session?.actingPerson).toBe('jaz')
  })

  it('clears an expired stored token and lands on the wall (no loop, no Google prompt)', async () => {
    sessionStore.setSessionToken('hqs1.expired.sig')
    fetchWhoAmIMock.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'Session expired.'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    expect(sessionStore.getSessionToken()).toBeNull()
    expect(fetchWhoAmIMock).toHaveBeenCalledTimes(1)
  })

  it('lands on forbidden (and clears the token) when the account left the allowlist', async () => {
    sessionStore.setSessionToken('hqs1.stored.sig')
    fetchWhoAmIMock.mockRejectedValue(new ApiError('FORBIDDEN', 'Not allowed'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('forbidden'))
    expect(sessionStore.getSessionToken()).toBeNull()
  })

  it('auto-retries a transient network failure, then lands on restore-error with the token preserved (feature 030 FR-007)', async () => {
    sessionStore.setSessionToken('hqs1.stored.sig')
    fetchWhoAmIMock.mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('restore-error'), { timeout: 4000 })

    // Initial attempt + 2 bounded backoff retries — never the sign-in wall (FR-007).
    expect(fetchWhoAmIMock).toHaveBeenCalledTimes(3)
    expect(sessionStore.getSessionToken()).toBe('hqs1.stored.sig')
  })

  it('recovers to signed-in from restore-error via retryRestore, with no Google re-auth', async () => {
    sessionStore.setSessionToken('hqs1.stored.sig')
    fetchWhoAmIMock.mockRejectedValue(new ApiError('NETWORK_ERROR', 'offline'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('restore-error'), { timeout: 4000 })

    fetchWhoAmIMock.mockResolvedValue(PERSONAL_WHO)
    await act(async () => {
      await result.current.retryRestore()
    })

    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    expect(result.current.session?.token).toBe('hqs1.fresh.sig')
    expect(sessionStore.getSessionToken()).toBe('hqs1.fresh.sig')
    // No Google sign-in flow was ever invoked — recovery is whoami-only.
    expect(setupGisMock).not.toHaveBeenCalled()
  })
})

describe('interactive sign-in', () => {
  it('persists the minted session token after a Google button sign-in', async () => {
    fetchWhoAmIMock.mockResolvedValue(PERSONAL_WHO)
    let credentialCallback: ((token: string) => void) | undefined
    setupGisMock.mockImplementation(async (onCredential: (token: string) => void) => {
      credentialCallback = onCredential
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))

    await act(async () => {
      await result.current.initSignInButton(document.createElement('div'))
      credentialCallback?.('google-id-token')
    })

    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    expect(fetchWhoAmIMock).toHaveBeenCalledWith('google-id-token')
    expect(result.current.session?.token).toBe('hqs1.fresh.sig')
    expect(sessionStore.getSessionToken()).toBe('hqs1.fresh.sig')
  })
})

describe('authedCall', () => {
  async function renderSignedIn() {
    sessionStore.setSessionToken('hqs1.stored.sig')
    fetchWhoAmIMock.mockResolvedValue(PERSONAL_WHO)
    const rendered = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(rendered.result.current.status).toBe('signed-in'))
    return rendered
  }

  it('calls the API with the current session token', async () => {
    const { result } = await renderSignedIn()
    apiCallMock.mockResolvedValue({ tasks: [] })

    const response = await act(() => result.current.authedCall('tasks.list'))
    expect(response).toEqual({ tasks: [] })
    expect(apiCallMock).toHaveBeenCalledWith('tasks.list', {}, { token: 'hqs1.fresh.sig', actingPerson: undefined })
  })

  it('drops the session and falls back to the wall when the token is rejected', async () => {
    const { result } = await renderSignedIn()
    apiCallMock.mockRejectedValue(new ApiError('UNAUTHENTICATED', 'expired'))

    await act(async () => {
      await expect(result.current.authedCall('tasks.list')).rejects.toThrow()
    })
    expect(result.current.status).toBe('signed-out')
    expect(sessionStore.getSessionToken()).toBeNull()
  })

  it('keeps the session on non-auth errors', async () => {
    const { result } = await renderSignedIn()
    apiCallMock.mockRejectedValue(new ApiError('VALIDATION_FAILED', 'bad field'))

    await act(async () => {
      await expect(result.current.authedCall('tasks.create')).rejects.toThrow('bad field')
    })
    expect(result.current.status).toBe('signed-in')
    expect(sessionStore.getSessionToken()).toBe('hqs1.fresh.sig')
  })
})

describe('sign-out', () => {
  it('clears everything so the next boot is signed-out with no auto re-entry', async () => {
    sessionStore.setSessionToken('hqs1.stored.sig')
    sessionStore.setActingPerson('max')
    fetchWhoAmIMock.mockResolvedValue(PERSONAL_WHO)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))

    act(() => result.current.signOut())

    expect(signOutMock).toHaveBeenCalled()
    expect(sessionStore.getSessionToken()).toBeNull()
    expect(sessionStore.getActingPerson()).toBeNull()
    expect(result.current.status).toBe('signed-out')
  })
})
