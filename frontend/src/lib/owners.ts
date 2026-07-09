import type { Owner } from '@/types/domain'

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
