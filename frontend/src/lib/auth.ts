// Google Identity Services (GIS) wiring (research R3, extended by feature
// 018 research R1/R3). The backend verifies a Google ID token's claims
// directly — no OAuth access-token flow, no server-side session. The token
// itself always lives in memory only; auto_select + silent prompt() let the
// app re-acquire a fresh one without an interactive prompt in the common
// case (see session-store.ts for what little is persisted).

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
    auto_select: true,
    cancel_on_tap_outside: false,
  })
}

/**
 * Ask GIS to silently re-select the previously used account (auto-select /
 * One Tap, feature 018 research R1). Must run after `setupGis` has
 * registered the credential callback — success is observed by that
 * callback firing, not by this promise; this only resolves once GIS has
 * reported a *decline* (not displayed / skipped / dismissed) so the caller
 * can race it against the callback and fall back to interactive sign-in.
 * If GIS never reports a moment outcome (rare), this promise simply never
 * resolves — callers must race it with their own timeout.
 */
export async function promptSilent(): Promise<'declined'> {
  const google = await waitForGis()
  return new Promise((resolve) => {
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
        resolve('declined')
      }
    })
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
