import { useCallback, useEffect, useState } from 'react'
import { ALL_OWNERS } from '@/lib/owners'
import type { Owner } from '@/types/domain'

const STORAGE_KEY = 'household-hq.ownerFilter'

function loadInitial(): Set<Owner> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set(ALL_OWNERS)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set(ALL_OWNERS)
    // An empty array is a legitimate "user turned every chip off" state and
    // must survive reload — only fall back to all-owners when the stored
    // value itself is missing or malformed, not when it's validly empty.
    return new Set(parsed.filter((o): o is Owner => ALL_OWNERS.includes(o as Owner)))
  } catch {
    return new Set(ALL_OWNERS)
  }
}

/** Independent owner-filter chip state (FR-015), persisted as UI-only preference — never authoritative. */
export function useOwnerFilter() {
  const [visibleOwners, setVisibleOwners] = useState<Set<Owner>>(loadInitial)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visibleOwners]))
  }, [visibleOwners])

  const toggle = useCallback((owner: Owner) => {
    setVisibleOwners((prev) => {
      const next = new Set(prev)
      if (next.has(owner)) next.delete(owner)
      else next.add(owner)
      return next
    })
  }, [])

  return { visibleOwners, toggle }
}
