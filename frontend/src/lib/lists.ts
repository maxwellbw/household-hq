import type { ListItem, ListSection } from '@/types/domain'

/** Fixed grouping/display order for the needed view (FR-011, clarified 2026-07-12). */
export const LIST_SECTIONS: ListSection[] = ['produce', 'dairy', 'frozen', 'pantry', 'household', 'other']

export const LIST_SECTION_LABELS: Record<ListSection, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  frozen: 'Frozen',
  pantry: 'Pantry',
  household: 'Household',
  other: 'Other',
  '': 'Other',
}

/** Default nudge threshold when Settings' groceryStapleNudgeThreshold is blank/invalid,
 *  mirroring the backend's own fallback (Config.js SETTINGS_SEED default). */
export const DEFAULT_GROCERY_NUDGE_THRESHOLD = 3

export interface NeededSectionGroup {
  section: ListSection
  items: ListItem[]
}

/**
 * Needed-only items for a list, grouped and ordered by store section (US3, FR-011):
 * unsectioned items (`section === ''`) group under 'other'; empty groups are omitted so
 * the view only shows sections that actually have something needed.
 */
export function groupNeededBySection(items: ListItem[]): NeededSectionGroup[] {
  const needed = items.filter((item) => item.status === 'need')
  return LIST_SECTIONS
    .map((section) => ({
      section,
      items: needed.filter((item) => (item.section || 'other') === section),
    }))
    .filter((group) => group.items.length > 0)
}

/** Count of staple items marked "need", across all lists combined (FR-013). */
export function groceryNeededStapleCount(items: ListItem[]): number {
  return items.filter((item) => item.staple === 'TRUE' && item.status === 'need').length
}

/**
 * Whether the Home dashboard's "time to shop" nudge should show (US5, FR-013/014).
 * `thresholdSetting` is the raw Settings string; a blank/non-positive value falls back
 * to the same default the backend seeds (Config.js).
 */
export function shouldShowGroceryNudge(items: ListItem[], thresholdSetting: string | undefined): boolean {
  const parsed = Number(thresholdSetting)
  const threshold = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GROCERY_NUDGE_THRESHOLD
  return groceryNeededStapleCount(items) >= threshold
}

/**
 * Needed-item count per list, for the Lists tab pills (US8, FR-026). Lists with zero
 * needed items are absent from the map (not present with value 0), so callers hide the
 * count rather than rendering "0".
 */
export function neededCountByList(items: ListItem[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (item.status !== 'need') continue
    counts.set(item.listId, (counts.get(item.listId) ?? 0) + 1)
  }
  return counts
}

/**
 * Filters items to those whose name contains `query`, case-insensitively, with both sides
 * trimmed so incidental whitespace never hides an otherwise-matching item (feature 027 US5,
 * FR-017/018). A blank/whitespace-only query returns every item unchanged.
 */
export function filterItemsByName(items: ListItem[], query: string): ListItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter((item) => item.name.toLowerCase().includes(needle))
}
