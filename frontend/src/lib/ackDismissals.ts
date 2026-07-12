// Per-device dismissal of acknowledge notices ("X has it", feature 019 research R4). Not
// household data — dismissal state lives only in this browser, mirroring session-store.ts's
// UI-hint pattern. The durable, cross-device signal is the ntfy ping; this just keeps a
// dismissed notice from reappearing on this device on reload.

const DISMISSED_KEY = 'hq.ackDismissed'

/** A stable per-acknowledgement key: reassign→re-acknowledge produces a new ackAt, so a
 *  fresh commitment always surfaces a fresh notice even if the prior one was dismissed. */
export function ackNoticeKey(taskId: string, ackAt: string): string {
  return `${taskId}:${ackAt}`
}

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

export function isDismissed(key: string): boolean {
  return readDismissed().has(key)
}

export function dismiss(key: string): void {
  const dismissed = readDismissed()
  dismissed.add(key)
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(dismissed)))
}
