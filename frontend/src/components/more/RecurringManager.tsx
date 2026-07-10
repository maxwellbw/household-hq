import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  useRecurring,
  useCreateRecurringRule,
  useUpdateRecurringRule,
  useDeleteRecurringRule,
} from '@/hooks/useRecurring'
import { useToast } from '@/hooks/useToast'
import { ownerStyle, ALL_OWNERS } from '@/lib/owners'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Cadence, Owner, RecurringRule } from '@/types/domain'

const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CADENCES: Cadence[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']

type FormMode = { type: 'create' } | { type: 'edit'; rule: RecurringRule }

interface RuleFormState {
  title: string
  cadence: Cadence
  anchorDate: string
  defaultOwner: Owner
  seasonStart: string // '' | '1'–'12'
  seasonEnd: string
}

function emptyForm(): RuleFormState {
  return { title: '', cadence: 'weekly', anchorDate: '', defaultOwner: 'both', seasonStart: '', seasonEnd: '' }
}

function ruleToForm(rule: RecurringRule): RuleFormState {
  return {
    title: rule.title,
    cadence: rule.cadence,
    anchorDate: rule.anchorDate,
    defaultOwner: rule.defaultOwner,
    seasonStart: rule.seasonStart ?? '',
    seasonEnd: rule.seasonEnd ?? '',
  }
}

function RuleForm({
  mode,
  onDone,
}: {
  mode: FormMode
  onDone: () => void
}) {
  const create = useCreateRecurringRule()
  const update = useUpdateRecurringRule()
  const toast = useToast()

  const [form, setForm] = useState<RuleFormState>(
    mode.type === 'edit' ? ruleToForm(mode.rule) : emptyForm(),
  )
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)

  const isPending = create.isPending || update.isPending

  function setField<K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    if (!form.title.trim()) {
      setFieldError({ field: 'title', message: 'Give it a title.' })
      return
    }
    if (!form.anchorDate) {
      setFieldError({ field: 'anchorDate', message: 'Pick an anchor date.' })
      return
    }
    const hasSeason = form.seasonStart !== '' || form.seasonEnd !== ''
    if (hasSeason && (form.seasonStart === '' || form.seasonEnd === '')) {
      setFieldError({
        field: form.seasonStart === '' ? 'seasonStart' : 'seasonEnd',
        message: 'Set both season months or neither.',
      })
      return
    }

    const payload: Omit<RecurringRule, 'id' | 'lastGenerated'> = {
      title: form.title.trim(),
      cadence: form.cadence,
      anchorDate: form.anchorDate,
      defaultOwner: form.defaultOwner,
      ...(form.seasonStart ? { seasonStart: form.seasonStart, seasonEnd: form.seasonEnd } : {}),
    }

    try {
      if (mode.type === 'create') {
        await create.mutateAsync(payload)
        toast.show('Recurring rule added')
      } else {
        await update.mutateAsync({ id: mode.rule.id, ...payload })
        toast.show('Recurring rule updated')
      }
      onDone()
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldError({ field: err.field, message: err.message })
      } else {
        setFieldError({ message: 'Something went wrong. Please try again.' })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-5">
      {/* Title */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">Title</span>
        <input
          autoFocus
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          placeholder="e.g. Clean bathroom"
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {fieldError?.field === 'title' && (
          <p className="mt-1 text-xs text-danger">{fieldError.message}</p>
        )}
      </label>

      {/* Cadence */}
      <div>
        <span className="mb-1 block text-xs font-medium text-ink-muted">Cadence</span>
        <select
          value={form.cadence}
          onChange={(e) => setField('cadence', e.target.value as Cadence)}
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {CADENCES.map((c) => (
            <option key={c} value={c}>{CADENCE_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Anchor date */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">Anchor date</span>
        <input
          type="date"
          value={form.anchorDate}
          onChange={(e) => setField('anchorDate', e.target.value)}
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {fieldError?.field === 'anchorDate' && (
          <p className="mt-1 text-xs text-danger">{fieldError.message}</p>
        )}
      </label>

      {/* Owner */}
      <div>
        <span className="mb-1 block text-xs font-medium text-ink-muted">Who</span>
        <div className="flex gap-2">
          {ALL_OWNERS.map((o) => {
            const style = ownerStyle(o)
            const selected = form.defaultOwner === o
            return (
              <button
                key={o}
                type="button"
                onClick={() => setField('defaultOwner', o)}
                className={cn(
                  'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-control border px-2 text-sm font-medium',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  selected ? 'border-accent bg-accent-soft text-ink' : 'border-border text-ink-muted',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-surface',
                    o === 'max' && 'bg-owner-max',
                    o === 'jaz' && 'bg-owner-jaz',
                    o === 'both' && 'bg-owner-both',
                  )}
                  aria-hidden="true"
                >
                  {style.initial}
                </span>
                {style.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Season (optional) */}
      <div>
        <span className="mb-1 block text-xs font-medium text-ink-muted">
          Season <span className="font-normal text-ink-faint">(optional)</span>
        </span>
        <div className="flex items-center gap-2">
          <select
            value={form.seasonStart}
            onChange={(e) => setField('seasonStart', e.target.value)}
            className="min-h-[44px] flex-1 rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Any</option>
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={String(i + 1)}>{name}</option>
            ))}
          </select>
          <span className="shrink-0 text-xs text-ink-faint">to</span>
          <select
            value={form.seasonEnd}
            onChange={(e) => setField('seasonEnd', e.target.value)}
            className="min-h-[44px] flex-1 rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">Any</option>
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={String(i + 1)}>{name}</option>
            ))}
          </select>
        </div>
        {(fieldError?.field === 'seasonStart' || fieldError?.field === 'seasonEnd') && (
          <p className="mt-1 text-xs text-danger">{fieldError.message}</p>
        )}
      </div>

      {fieldError && !fieldError.field && (
        <p className="text-sm text-danger">{fieldError.message}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] w-full rounded-control bg-accent px-4 font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        {isPending ? 'Saving…' : mode.type === 'create' ? 'Add rule' : 'Save changes'}
      </button>
    </form>
  )
}

function RuleRow({
  rule,
  onEdit,
}: {
  rule: RecurringRule
  onEdit: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteRule = useDeleteRecurringRule()
  const toast = useToast()
  const ownerSt = ownerStyle(rule.defaultOwner)

  async function handleDelete() {
    await deleteRule.mutateAsync(rule.id)
    toast.show(`"${rule.title}" deleted`)
  }

  const seasonLabel =
    rule.seasonStart && rule.seasonEnd
      ? `${MONTH_NAMES[Number(rule.seasonStart) - 1]}–${MONTH_NAMES[Number(rule.seasonEnd) - 1]}`
      : null

  return (
    <li className="border-b border-border last:border-b-0">
      {confirmDelete ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <p className="flex-1 text-sm text-ink">Delete &ldquo;{rule.title}&rdquo;?</p>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="min-h-[44px] min-w-[44px] rounded-control px-3 text-sm text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteRule.isPending}
            className="min-h-[44px] rounded-control bg-danger px-3 text-sm font-medium text-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-50"
          >
            {deleteRule.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{rule.title}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {CADENCE_LABELS[rule.cadence]}
              {' · '}
              <span
                className={cn(
                  'inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium text-surface',
                  rule.defaultOwner === 'max' && 'bg-owner-max',
                  rule.defaultOwner === 'jaz' && 'bg-owner-jaz',
                  rule.defaultOwner === 'both' && 'bg-owner-both',
                )}
                aria-label={ownerSt.label}
              >
                {ownerSt.initial}
              </span>
              {' '}{ownerSt.label}
              {seasonLabel && ` · ${seasonLabel}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${rule.title}`}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete ${rule.title}`}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-danger hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  )
}

/** Full recurring-rule manager: list + create/edit form + delete-with-confirm (T030). */
export function RecurringManager() {
  const { data: rules, isPending, isError } = useRecurring()
  const [formMode, setFormMode] = useState<FormMode | null>(null)

  if (formMode) {
    const heading = formMode.type === 'create' ? 'New recurring rule' : 'Edit rule'
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <button
            type="button"
            onClick={() => setFormMode(null)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Back to rules"
          >
            ←
          </button>
          <h3 className="font-display text-lg text-ink">{heading}</h3>
        </div>
        <RuleForm mode={formMode} onDone={() => setFormMode(null)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      <button
        type="button"
        onClick={() => setFormMode({ type: 'create' })}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-control border border-dashed border-border',
          'text-sm text-ink-muted hover:border-accent hover:text-accent',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add recurring rule
      </button>

      {isPending && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading rules">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-card bg-surface-alt" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-danger">Could not load rules. Check your connection.</p>
      )}

      {!isPending && !isError && rules && (
        rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
            <p className="text-sm font-medium text-ink">No recurring rules yet</p>
            <p className="text-xs text-ink-muted">Add one above to schedule repeating tasks.</p>
          </div>
        ) : (
          <ul className="rounded-card bg-surface shadow-card">
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onEdit={() => setFormMode({ type: 'edit', rule })}
              />
            ))}
          </ul>
        )
      )}
    </div>
  )
}
