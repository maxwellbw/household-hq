// Minimal typing for the Google Identity Services (GIS) browser library we
// load via <script> in index.html — just the surface auth.ts uses (the One
// Tap prompt() surface was removed with the 018 session-token revision).

interface GoogleIdConfiguration {
  client_id: string
  callback: (response: { credential: string }) => void
}

interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void
  disableAutoSelect(): void
}

interface Window {
  google?: {
    accounts: {
      id: GoogleAccountsId
    }
  }
}
