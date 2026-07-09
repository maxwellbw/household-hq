// Google Identity Services (GIS) wiring (research R3). The backend verifies
// a Google ID token's claims directly — no OAuth access-token flow, no
// server-side session. The token lives in memory only; on expiry the app
// re-prompts rather than persisting/refreshing silently.

import { apiCall } from './api'
import type { WhoAmI } from '@/types/domain'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

function waitForGis(): Promise<NonNullable<Window['google']>> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) {
      resolve(window.google)
      return
    }
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval)
        resolve(window.google)
      }
    }, 50)
  })
}

/** Register the callback GIS invokes once a user completes sign-in. Idempotent per session. */
export async function setupGis(onCredential: (token: string) => void): Promise<void> {
  const google = await waitForGis()
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (response) => onCredential(response.credential),
    cancel_on_tap_outside: false,
  })
}

/** Render the actual "Sign in with Google" button into `el` (must run after setupGis). */
export async function renderSignInButton(el: HTMLElement): Promise<void> {
  const google = await waitForGis()
  google.accounts.id.renderButton(el, {
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: 'signin_with',
  })
}

export async function signOut(): Promise<void> {
  const google = await waitForGis()
  google.accounts.id.disableAutoSelect()
}

/** `auth.whoami` — who the caller is, and whether the client must confirm Max/Jaz. */
export function fetchWhoAmI(token: string): Promise<WhoAmI> {
  return apiCall<WhoAmI>('auth.whoami', {}, { token })
}
