// Minimal typing for the Google Identity Services (GIS) browser library we
// load via <script> in index.html — just the surface auth.ts uses.

interface GoogleIdConfiguration {
  client_id: string
  callback: (response: { credential: string }) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
}

interface PromptMomentNotification {
  isNotDisplayed(): boolean
  isSkippedMoment(): boolean
  isDismissedMoment(): boolean
}

interface GoogleAccountsId {
  initialize(config: GoogleIdConfiguration): void
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void
  prompt(momentListener?: (notification: PromptMomentNotification) => void): void
  disableAutoSelect(): void
}

interface Window {
  google?: {
    accounts: {
      id: GoogleAccountsId
    }
  }
}
