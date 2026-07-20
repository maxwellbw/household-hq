import { useState } from 'react'
import { Pencil, Trash2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToggleListItem, useUpdateListItem, useDeleteListItem, useCreateListItem } from '@/hooks/useListMutations'
import { useUndoableMutation } from '@/hooks/useUndoableMutation'
import { LIST_SECTIONS, LIST_SECTION_LABELS } from '@/lib/lists'
import type { ListItem, ListSection } from '@/types/domain'

interface ListItemRowProps {
  item: ListItem
}

/** One list item: one-tap need⇄stocked toggle (US1, optimistic via useToggleListItem),
 *  plus an expandable edit panel for section/staple/note and delete (US2/Polish). */
export function ListItemRow({ item }: ListItemRowProps) {
  const [editing, setEditing] = useState(false)
  const toggle = useToggleListItem()
  const isStocked = item.status === 'stocked'

  return (
    // <li>, not <div>: both call sites render these inside a <ul>, and a <ul>
    // with direct <div> children breaks list semantics for screen readers
    // (axe `list`, T033).
    <li className="border-b border-border last:border-b-0">
      <div className="flex min-h-[44px] items-center gap-3 px-1 py-2">
        <button
          type="button"
          onClick={() => toggle.mutate(item.id)}
          aria-pressed={isStocked}
          aria-label={isStocked ? `Mark ${item.name} needed` : `Mark ${item.name} stocked`}
          className="flex h-11 w-11 shrink-0 -m-2.5 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors duration-200',
              isStocked ? 'border-success bg-success' : 'border-border hover:border-accent',
            )}
          >
            {isStocked && (
              <svg viewBox="0 0 12 12" className="h-3 w-3 text-surface" fill="none">
                <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="flex-1 text-left text-sm"
        >
          <span className={cn(isStocked ? 'text-ink-faint line-through' : 'text-ink')}>{item.name}</span>
          {item.staple === 'TRUE' && (
            <span className="ml-1.5 inline-block align-middle" title="Staple — stays on the list">
              <Star className="h-3 w-3 shrink-0 fill-accent text-accent" aria-label="Staple" />
            </span>
          )}
          {item.note && <span className="ml-2 text-xs text-ink-muted">{item.note}</span>}
        </button>

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label={`Edit ${item.name}`}
          aria-expanded={editing}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {editing && <ListItemEditPanel item={item} onDone={() => setEditing(false)} />}
    </li>
  )
}

function ListItemEditPanel({ item, onDone }: { item: ListItem; onDone: () => void }) {
  const [section, setSection] = useState<ListSection>(item.section)
  const [staple, setStaple] = useState(item.staple === 'TRUE')
  const [note, setNote] = useState(item.note ?? '')
  const update = useUpdateListItem()
  const del = useDeleteListItem()
  const create = useCreateListItem()
  // Feature 032 US3 (contract C3, FR-013): delete is undoable instead of a blocking
  // two-tap confirm — re-add recreates the item (new id; same list/name/section/staple/note).
  const commitDelete = useUndoableMutation(del, create, { label: `Deleted — ${item.name}` })

  function handleSave() {
    update.mutate(
      { id: item.id, section, staple: staple ? 'TRUE' : 'FALSE', note },
      { onSuccess: onDone },
    )
  }

  function handleDelete() {
    commitDelete(item.id, {
      listId: item.listId,
      name: item.name,
      section: item.section,
      staple: item.staple,
      note: item.note,
    })
    onDone()
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-surface-alt px-4 py-3">
      <div className="flex items-center gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-muted">Section</span>
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as ListSection)}
            className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Unsectioned</option>
            {LIST_SECTIONS.filter((s) => s !== 'other').map((s) => (
              <option key={s} value={s}>{LIST_SECTION_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex min-h-[44px] shrink-0 items-center gap-1.5 self-end pb-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={staple}
            onChange={(e) => setStaple(e.target.checked)}
            className="h-4 w-4 rounded border-border text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          Staple
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">Note / quantity</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. 2 bags, the good brand"
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={update.isPending}
          className="min-h-[44px] flex-1 rounded-control bg-accent px-3 text-sm font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-[44px] rounded-control px-3 text-sm text-ink-muted hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`Delete ${item.name}`}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-danger hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
