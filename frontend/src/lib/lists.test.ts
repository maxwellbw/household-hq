import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GROCERY_NUDGE_THRESHOLD,
  filterItemsByName,
  groceryNeededStapleCount,
  groupNeededBySection,
  neededCountByList,
  shouldShowGroceryNudge,
} from './lists'
import type { ListItem } from '@/types/domain'

function item(overrides: Partial<ListItem> & { id: string }): ListItem {
  return {
    listId: 'list-1',
    name: 'Test item',
    status: 'need',
    section: '',
    staple: 'FALSE',
    ...overrides,
  }
}

describe('groupNeededBySection', () => {
  it('groups needed items by section in the fixed order', () => {
    const items = [
      item({ id: '1', name: 'Milk', section: 'dairy' }),
      item({ id: '2', name: 'Apples', section: 'produce' }),
      item({ id: '3', name: 'Eggs', section: 'dairy' }),
    ]
    const groups = groupNeededBySection(items)
    expect(groups.map((g) => g.section)).toEqual(['produce', 'dairy'])
    expect(groups[0].items.map((i) => i.name)).toEqual(['Apples'])
    expect(groups[1].items.map((i) => i.name)).toEqual(['Milk', 'Eggs'])
  })

  it('groups unsectioned items under other', () => {
    const items = [item({ id: '1', name: 'Mystery item', section: '' })]
    const groups = groupNeededBySection(items)
    expect(groups).toEqual([{ section: 'other', items: [items[0]] }])
  })

  it('omits empty sections', () => {
    const items = [item({ id: '1', section: 'frozen' })]
    const groups = groupNeededBySection(items)
    expect(groups).toHaveLength(1)
    expect(groups[0].section).toBe('frozen')
  })

  it('excludes stocked items', () => {
    const items = [
      item({ id: '1', name: 'Needed', status: 'need' }),
      item({ id: '2', name: 'Stocked', status: 'stocked' }),
    ]
    const groups = groupNeededBySection(items)
    const names = groups.flatMap((g) => g.items.map((i) => i.name))
    expect(names).toEqual(['Needed'])
  })

  it('returns no groups when nothing is needed', () => {
    const items = [item({ id: '1', status: 'stocked' })]
    expect(groupNeededBySection(items)).toEqual([])
  })
})

describe('groceryNeededStapleCount', () => {
  it('counts only staple items marked need', () => {
    const items = [
      item({ id: '1', staple: 'TRUE', status: 'need' }),
      item({ id: '2', staple: 'TRUE', status: 'stocked' }),
      item({ id: '3', staple: 'FALSE', status: 'need' }),
      item({ id: '4', staple: 'TRUE', status: 'need' }),
    ]
    expect(groceryNeededStapleCount(items)).toBe(2)
  })
})

describe('shouldShowGroceryNudge', () => {
  const staples = (n: number) =>
    Array.from({ length: n }, (_, i) => item({ id: String(i), staple: 'TRUE', status: 'need' }))

  it('shows the nudge once the count reaches the threshold', () => {
    expect(shouldShowGroceryNudge(staples(3), '3')).toBe(true)
  })

  it('does not show the nudge one below the threshold', () => {
    expect(shouldShowGroceryNudge(staples(2), '3')).toBe(false)
  })

  it('falls back to the default threshold when the setting is blank', () => {
    expect(shouldShowGroceryNudge(staples(DEFAULT_GROCERY_NUDGE_THRESHOLD), undefined)).toBe(true)
    expect(shouldShowGroceryNudge(staples(DEFAULT_GROCERY_NUDGE_THRESHOLD - 1), '')).toBe(false)
  })

  it('falls back to the default threshold when the setting is invalid', () => {
    expect(shouldShowGroceryNudge(staples(DEFAULT_GROCERY_NUDGE_THRESHOLD), 'not-a-number')).toBe(true)
  })
})

describe('neededCountByList', () => {
  it('counts needed items per list', () => {
    const items = [
      item({ id: '1', listId: 'l1', status: 'need' }),
      item({ id: '2', listId: 'l1', status: 'need' }),
      item({ id: '3', listId: 'l2', status: 'need' }),
    ]
    const counts = neededCountByList(items)
    expect(counts.get('l1')).toBe(2)
    expect(counts.get('l2')).toBe(1)
  })

  it('excludes stocked items from the count', () => {
    const items = [
      item({ id: '1', listId: 'l1', status: 'need' }),
      item({ id: '2', listId: 'l1', status: 'stocked' }),
    ]
    expect(neededCountByList(items).get('l1')).toBe(1)
  })

  it('omits a list entirely when it has zero needed items', () => {
    const items = [item({ id: '1', listId: 'l1', status: 'stocked' })]
    const counts = neededCountByList(items)
    expect(counts.has('l1')).toBe(false)
    expect(counts.get('l1')).toBeUndefined()
  })

  it('returns an empty map for no items', () => {
    expect(neededCountByList([]).size).toBe(0)
  })
})

describe('filterItemsByName', () => {
  const items = [
    item({ id: '1', name: 'Coffee' }),
    item({ id: '2', name: 'Pumpkin (canned, for pup)' }),
    item({ id: '3', name: 'Frozen berries' }),
  ]

  it('matches case-insensitively on a substring', () => {
    expect(filterItemsByName(items, 'pump').map((i) => i.id)).toEqual(['2'])
    expect(filterItemsByName(items, 'PUMP').map((i) => i.id)).toEqual(['2'])
  })

  it('ignores leading/trailing whitespace in the query', () => {
    expect(filterItemsByName(items, '  coffee  ').map((i) => i.id)).toEqual(['1'])
  })

  it('returns every item when the query is blank', () => {
    expect(filterItemsByName(items, '')).toEqual(items)
    expect(filterItemsByName(items, '   ')).toEqual(items)
  })

  it('returns no items when nothing matches', () => {
    expect(filterItemsByName(items, 'xyz not present')).toEqual([])
  })
})
