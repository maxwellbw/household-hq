import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Star, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/useToast'
import { useLists, useListItems } from '@/hooks/useLists'
import { useCreateList, useDeleteList, useCreateListItem } from '@/hooks/useListMutations'
import { filterItemsByName, groupNeededBySection, LIST_SECTION_LABELS } from '@/lib/lists'
import { ListItemRow } from '@/components/lists/ListItemRow'
import { ErrorState } from '@/components/shell/ErrorState'
import { ApiError } from '@/lib/api'

type ViewMode = 'needed' | 'all'

interface ListsViewProps {
  /** Feature 032 US2 (FR-010, audit F-31): selects the named list (by exact name match) on
   *  mount instead of the default first-list fallback — the dashboard's grocery nudge uses
   *  this to jump straight to "Groceries". Falls back to the first list if no match. */
  focusListName?: string
}

/** Grocery & household Lists screen (feature 024): list switcher, low-friction
 *  add-by-name, and a Needed (aisle-order) / All (management) view toggle. */
export function ListsView({ focusListName }: ListsViewProps = {}) {
  const listsQuery = useLists()
  const itemsQuery = useListItems()
  const createList = useCreateList()
  const deleteList = useDeleteList()
  const toast = useToast()

  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [creatingList, setCreatingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('needed')
  const [newItemName, setNewItemName] = useState('')
  const [confirmDeleteList, setConfirmDeleteList] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const lists = listsQuery.data ?? []

  // Default to the first list once lists load (or the requested focusListName, if it
  // matches one), without stomping a user's later selection.
  useEffect(() => {
    if (!selectedListId && lists.length > 0) {
      const focused = focusListName
        ? lists.find((l) => l.name.toLowerCase() === focusListName.toLowerCase())
        : undefined
      setSelectedListId(focused?.id ?? lists[0].id)
    }
    if (selectedListId && !lists.some((l) => l.id === selectedListId)) {
      setSelectedListId(lists[0]?.id ?? null)
    }
  }, [lists, selectedListId, focusListName])

  const itemsForList = useMemo(
    () => (itemsQuery.data ?? []).filter((item) => item.listId === selectedListId),
    [itemsQuery.data, selectedListId],
  )
  const filteredItemsForList = useMemo(
    () => filterItemsByName(itemsForList, searchQuery),
    [itemsForList, searchQuery],
  )
  const neededGroups = useMemo(() => groupNeededBySection(filteredItemsForList), [filteredItemsForList])
  const searchHasNoMatches = searchQuery.trim().length > 0 && filteredItemsForList.length === 0

  const isPending = listsQuery.isPending || itemsQuery.isPending
  const isError = listsQuery.isError || itemsQuery.isError

  const createListItem = useCreateListItem()

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault()
    const name = newListName.trim()
    if (!name) return
    try {
      const { list } = await createList.mutateAsync(name)
      setSelectedListId(list.id)
      setNewListName('')
      setCreatingList(false)
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Could not create the list.')
    }
  }

  async function handleDeleteList(id: string, name: string) {
    await deleteList.mutateAsync(id)
    setConfirmDeleteList(false)
    toast.show(`"${name}" deleted`)
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    const name = newItemName.trim()
    if (!name || !selectedListId) return
    setNewItemName('')
    try {
      await createListItem.mutateAsync({ listId: selectedListId, name })
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : 'Could not add the item.')
    }
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-2 px-4 py-6" aria-busy="true" aria-label="Loading lists">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-card bg-surface-alt" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load your lists"
        copy="Check your connection and try again."
        onRetry={() => {
          void listsQuery.refetch()
          void itemsQuery.refetch()
        }}
        busy={listsQuery.isFetching || itemsQuery.isFetching}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* List switcher */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lists">
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            aria-pressed={selectedListId === list.id}
            onClick={() => {
              setSelectedListId(list.id)
              setConfirmDeleteList(false)
              setSearchQuery('')
            }}
            className={cn(
              'min-h-[44px] rounded-full border px-3 text-sm font-medium',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              selectedListId === list.id
                ? 'border-accent bg-accent-soft text-ink'
                : 'border-border bg-surface text-ink-muted',
            )}
          >
            {list.name}
          </button>
        ))}
        {creatingList ? (
          <form onSubmit={handleCreateList} className="flex items-center gap-1">
            <input
              autoFocus
              aria-label="List name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onBlur={() => !newListName.trim() && setCreatingList(false)}
              placeholder="List name"
              className="min-h-[44px] w-32 rounded-control border border-border bg-surface px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreatingList(true)}
            aria-label="New list"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-ink-muted hover:border-accent hover:text-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {lists.length === 0 && !creatingList && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="font-display text-lg text-ink">No lists yet</p>
          <p className="text-sm text-ink-muted">Create your first list to start adding items.</p>
          <button
            type="button"
            onClick={() => setCreatingList(true)}
            className="mt-2 min-h-[44px] rounded-control bg-accent px-4 text-sm font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Create a list
          </button>
        </div>
      )}

      {selectedListId && (
        <>
          {/* Low-friction add bar (US2, SC-001) */}
          <form onSubmit={handleAddItem} className="flex items-center gap-2">
            <input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Add an item…"
              aria-label="Add an item"
              className="min-h-[44px] flex-1 rounded-control border border-border bg-surface px-3 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <button
              type="submit"
              disabled={!newItemName.trim() || createListItem.isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-accent text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
              aria-label="Add item"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          {/* Needed / All toggle */}
          <div className="flex gap-1 rounded-control bg-surface-alt p-1" role="group" aria-label="View">
            {(['needed', 'all'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'min-h-[44px] flex-1 rounded-control text-sm font-medium capitalize',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  viewMode === mode ? 'bg-surface text-ink shadow-card' : 'text-ink-muted',
                )}
              >
                {mode === 'needed' ? 'Needed' : 'All'}
              </button>
            ))}
          </div>

          {/* Search (US5, FR-017/018): filters the active view's items by name. */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items…"
              aria-label="Search items"
              className="min-h-[44px] w-full rounded-control border border-border bg-surface py-2 pl-9 pr-11 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-control text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Feature 032 US5 (FR-021, audit F-15): the staple star has no explanation
              anywhere else in the product — a quiet, always-visible legend beats a
              first-use-only tooltip nobody triggers on a touch device. */}
          <p className="flex items-center gap-1 px-1 text-xs text-ink-faint">
            <Star className="h-3 w-3 shrink-0 fill-accent text-accent" aria-hidden="true" />
            Staple — stays on the list and counts toward the shopping nudge
          </p>

          {searchHasNoMatches ? (
            <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
              <p className="text-sm font-medium text-ink">No items match "{searchQuery.trim()}"</p>
              <p className="text-xs text-ink-muted">Try a different search.</p>
            </div>
          ) : viewMode === 'needed' ? (
            neededGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
                <p className="text-sm font-medium text-ink">Nothing needed</p>
                <p className="text-xs text-ink-muted">Everything on this list is stocked.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {neededGroups.map((group) => (
                  <section key={group.section}>
                    <h3 className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
                      {LIST_SECTION_LABELS[group.section]}
                    </h3>
                    <ul className="rounded-card bg-surface shadow-card">
                      {group.items.map((item) => (
                        <ListItemRow key={item.id} item={item} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )
          ) : filteredItemsForList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
              <p className="text-sm font-medium text-ink">No items yet</p>
              <p className="text-xs text-ink-muted">Add one above to get started.</p>
            </div>
          ) : (
            <ul className="rounded-card bg-surface shadow-card">
              {filteredItemsForList.map((item) => (
                <ListItemRow key={item.id} item={item} />
              ))}
            </ul>
          )}

          {confirmDeleteList ? (
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-xs text-ink-muted">Delete this list and all its items?</span>
              <button
                type="button"
                onClick={() => setConfirmDeleteList(false)}
                className="min-h-[36px] rounded-control px-2 text-xs text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const list = lists.find((l) => l.id === selectedListId)
                  if (list) void handleDeleteList(list.id, list.name)
                }}
                disabled={deleteList.isPending}
                className="min-h-[36px] rounded-control bg-danger px-2 text-xs font-medium text-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-50"
              >
                {deleteList.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteList(true)}
              className="mt-2 flex min-h-[44px] items-center justify-center gap-2 self-center rounded-control px-3 text-xs text-danger hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete this list
            </button>
          )}
        </>
      )}
    </div>
  )
}
