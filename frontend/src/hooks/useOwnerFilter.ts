import { useCallback, useSyncExternalStore } from 'react'
import { ALL_OWNERS } from '@/lib/owners'
import type { Owner } from '@/types/domain'

/**
 * Feature 032 US5 (FR-020, data-model OwnerFilterState) — one shared owner-filter
 * instance app-wide, mirroring useTheme's module-store + useSyncExternalStore pattern
 * so Calendar and Tasks always agree live, not just after a reload from shared
 * localStorage. Persisted per device at `hq.ownerFilter`; never synced to the household
 * Settings store.
 */
const STORAGE_KEY = 'hq.ownerFilter'

/** All-deselected is never a real state (edge case: "treat as everyone, not an empty
 *  view") — normalized back to all three, both when reading storage and when a toggle
 *  would otherwise empty the set. */
function normalize(owners: Set<Owner>): Set<Owner> {
  return owners.size === 0 ? new Set(ALL_OWNERS) : owners
}

function readStored(): Set<Owner> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set(ALL_OWNERS)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set(ALL_OWNERS)
    return normalize(new Set(parsed.filter((o): o is Owner => ALL_OWNERS.includes(o as Owner))))
  } catch {
    return new Set(ALL_OWNERS)
  }
}

type OwnerFilterStore = {
  visibleOwners: Set<Owner>
  listeners: Set<() => void>
}

let store: OwnerFilterStore | null = null

function getStore(): OwnerFilterStore {
  if (store) return store
  store = { visibleOwners: readStored(), listeners: new Set() }
  return store
}

function notify() {
  for (const listener of getStore().listeners) listener()
}

function subscribe(listener: () => void): () => void {
  const s = getStore()
  s.listeners.add(listener)
  return () => s.listeners.delete(listener)
}

function getSnapshot(): Set<Owner> {
  return getStore().visibleOwners
}

function persist(owners: Set<Owner>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...owners]))
  } catch {
    // Private-mode/quota failures degrade to session-only preference.
  }
}

function toggleOwner(owner: Owner) {
  const s = getStore()
  const next = new Set(s.visibleOwners)
  if (next.has(owner)) next.delete(owner)
  else next.add(owner)
  s.visibleOwners = normalize(next)
  persist(s.visibleOwners)
  notify()
}

/** Test-only: drop the module store so each test starts from clean storage. */
export function resetOwnerFilterStoreForTests() {
  store = null
}

/** Shared owner-filter chip state, consumed identically by every filterable view. */
export function useOwnerFilter() {
  const visibleOwners = useSyncExternalStore(subscribe, getSnapshot)
  const toggle = useCallback((owner: Owner) => toggleOwner(owner), [])
  return { visibleOwners, toggle }
}
