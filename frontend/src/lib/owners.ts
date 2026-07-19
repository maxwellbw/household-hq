import type { ActivityEntry, Owner } from '@/types/domain'

export interface OwnerStyle {
  owner: Owner
  color: string // Tailwind text/border/bg color class fragment, e.g. "owner-max"
  softColor: string // e.g. "owner-max-soft"
  label: string
  initial: string
}

const OWNER_STYLES: Record<Owner, OwnerStyle> = {
  max: { owner: 'max', color: 'owner-max', softColor: 'owner-max-soft', label: 'Max', initial: 'M' },
  jaz: { owner: 'jaz', color: 'owner-jaz', softColor: 'owner-jaz-soft', label: 'Jaz', initial: 'J' },
  both: { owner: 'both', color: 'owner-both', softColor: 'owner-both-soft', label: 'Both', initial: 'MJ' },
}

/** Owner → { color, softColor, label, initial } per DESIGN.md tokens. Color is never the only signal. */
export function ownerStyle(owner: Owner): OwnerStyle {
  return OWNER_STYLES[owner]
}

export const ALL_OWNERS: Owner[] = ['max', 'jaz', 'both']

export interface ActorStyle {
  bgClass: string
  label: string
  initial: string
}

const SYSTEM_ACTOR_STYLE: ActorStyle = { bgClass: 'bg-ink-faint', label: 'System', initial: '•' }

/** Activity-feed actor → badge style (feature 032 US2/US3): live data showed activity
 *  entries authored by values beyond the two people — 'system' (digests, push pings,
 *  dog-walk moves) and 'selftest' (backend self-test runs) were both observed — so any
 *  actor that isn't 'max'/'jaz' falls back to a neutral badge rather than assuming the
 *  backend's actor field is a closed set (unlike task/event `Owner`, which is). Shared by
 *  FeedView and the dashboard's LatelyStrip so the two surfaces render actors identically. */
export function activityActorStyle(actor: ActivityEntry['actor']): ActorStyle {
  if (actor === 'max') return { bgClass: 'bg-owner-max', label: 'Max', initial: 'M' }
  if (actor === 'jaz') return { bgClass: 'bg-owner-jaz', label: 'Jaz', initial: 'J' }
  return SYSTEM_ACTOR_STYLE
}
