// Google Identity Services (GIS) wiring (research R3; feature 018 revised
// 2026-07-12). GIS is now only the *first* sign-in: the interactive button
// yields a Google ID token, the backend verifies it and answers with a
// long-lived household session token (see session-store.ts), and every later
// visit restores from that token instead of asking Google again. The silent
// One Tap re-auth path from the original 018 was removed — it failed
// routinely on iOS Safari (ITP) and Chrome (FedCM declines).

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
