// Per-device dismissal of dog-walk needs-decision notices (feature 011, mirroring feature
// 019's ackDismissals.ts pattern). Not household data — dismissal state lives only in this
// browser. The day resurfaces if the backend re-flags it with a different reason, or if the
// engine resolves it (the row leaves needs-decision) and later flags it again.

const DISMISSED_KEY = 'hq.dogWalkDismissed'

/** A stable per-flag key: a changed reason is a fresh notice even if the prior one (for a
 *  different reason on the same day) was dismissed. */
export function dogWalkNoticeKey(date: string, slot: string, reason: string): string {
  return `${date}:${slot}:${reason}`
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
