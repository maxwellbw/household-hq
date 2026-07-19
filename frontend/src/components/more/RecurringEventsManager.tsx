import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  useRecurringEvents,
  useCreateRecurringEventRule,
  useUpdateRecurringEventRule,
  useDeleteRecurringEventRule,
} from '@/hooks/useRecurringEvents'
import { useTemplates } from '@/hooks/useTemplates'
import { useToast } from '@/hooks/useToast'
import { ownerStyle, ALL_OWNERS } from '@/lib/owners'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ErrorState } from '@/components/shell/ErrorState'
import type { Cadence, Owner, RecurringEventRule } from '@/types/domain'

const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  monthly: 'Monthly',
  sixweekly: 'Every six weeks',
  eightweekly: 'Every eight weeks',
  quarterly: 'Quarterly',
  annually: 'Annually',
  semiannually: 'Every 6 months',
  'thanksgiving-sat': 'Weekend before Thanksgiving',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CADENCES: Cadence[] = ['weekly', 'biweekly', 'monthly', 'sixweekly', 'eightweekly', 'quarterly', 'annually', 'semiannually', 'thanksgiving-sat']

type FormMode = { type: 'create' } | { type: 'edit'; rule: RecurringEventRule }

interface RuleFormState {
  title: string
  cadence: Cadence
  anchorDate: string
  startTime: string // '' ⇒ all-day
  durationMinutes: string
  defaultOwner: Owner
  templateId: string // '' ⇒ no prep
  location: string
  notes: string
  seasonStart: string // '' | '1'–'12'
  seasonEnd: string
}

function emptyForm(): RuleFormState {
  return {
    title: '', cadence: 'weekly', anchorDate: '', startTime: '', durationMinutes: '',
    defaultOwner: 'both', templateId: '', location: '', notes: '', seasonStart: '', seasonEnd: '',
  }
}

function ruleToForm(rule: RecurringEventRule): RuleFormState {
  return {
    title: rule.title,
    cadence: rule.cadence,
    anchorDate: rule.anchorDate,
    startTime: rule.startTime ?? '',
    durationMinutes: rule.durationMinutes ?? '',
    defaultOwner: rule.defaultOwner,
    templateId: rule.templateId ?? '',
    location: rule.location ?? '',
    notes: rule.notes ?? '',
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
  const create = useCreateRecurringEventRule()
  const update = useUpdateRecurringEventRule()
  const { data: templates } = useTemplates()
  const toast = useToast()

  const [form, setForm] = useState<RuleFormState>(
    mode.type === 'edit' ? ruleToForm(mode.rule) : emptyForm(),
  )
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)

  const isPending = create.isPending || update.isPending
  const templateOptions = Array.from(new Set((templates ?? []).map((t) => t.eventType))).sort()

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

    const payload: Omit<RecurringEventRule, 'id' | 'lastGenerated'> = {
      title: form.title.trim(),
      cadence: form.cadence,
      anchorDate: form.anchorDate,
      defaultOwner: form.defaultOwner,
      ...(form.startTime ? { startTime: form.startTime, durationMinutes: form.durationMinutes || '60' } : {}),
      ...(form.templateId ? { templateId: form.templateId } : {}),
      ...(form.location.trim() ? { location: form.location.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      ...(form.seasonStart ? { seasonStart: form.seasonStart, seasonEnd: form.seasonEnd } : {}),
    }

    try {
      if (mode.type === 'create') {
        await create.mutateAsync(payload)
        toast.show('Recurring event added')
      } else {
        await update.mutateAsync({ id: mode.rule.id, ...payload })
        toast.show('Recurring event updated')
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
          placeholder="e.g. Mom's birthday"
          aria-invalid={fieldError?.field === 'title' ? true : undefined}
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {fieldError?.field === 'title' && (
          <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>
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
          aria-invalid={fieldError?.field === 'anchorDate' ? true : undefined}
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {fieldError?.field === 'anchorDate' && (
          <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>
        )}
      </label>

      {/* Timing (optional — blank time means all-day) */}
      <div>
        <span className="mb-1 block text-xs font-medium text-ink-muted">
          Time <span className="font-normal text-ink-faint">(optional — leave blank for all-day)</span>
        </span>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => setField('startTime', e.target.value)}
            aria-label="Start time"
            className="min-h-[44px] flex-1 rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <input
            type="number"
            min={1}
            step={1}
            value={form.durationMinutes}
            onChange={(e) => setField('durationMinutes', e.target.value)}
            disabled={!form.startTime}
            placeholder="60"
            aria-label="Duration in minutes"
            className="min-h-[44px] w-24 rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          />
          <span className="shrink-0 text-xs text-ink-faint">min</span>
        </div>
      </div>

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
                aria-pressed={selected}
                className={cn(
                  'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-control border px-2 text-sm font-medium',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  selected ? 'border-accent bg-accent-soft text-ink' : 'border-border text-ink-muted',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-surface',
                    o === 'max' && 'bg-owner-max',
                    o === 'jaz' && 'bg-owner-jaz',
                    o === 'both' && 'bg-owner-both',
                  )}
                >
                  {style.initial}
                </span>
                {style.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Prep template (optional) */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">
          Prep checklist <span className="font-normal text-ink-faint">(optional)</span>
        </span>
        <select
          value={form.templateId}
          onChange={(e) => setField('templateId', e.target.value)}
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="">None</option>
          {templateOptions.map((eventType) => (
            <option key={eventType} value={eventType}>{eventType}</option>
          ))}
        </select>
      </label>

      {/* Location (optional) */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">
          Location <span className="font-normal text-ink-faint">(optional)</span>
        </span>
        <input
          value={form.location}
          onChange={(e) => setField('location', e.target.value)}
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>

      {/* Notes (optional) */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">
          Notes <span className="font-normal text-ink-faint">(optional)</span>
        </span>
        <textarea
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          rows={2}
          className="w-full rounded-control border border-border bg-surface px-3 py-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>

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
          <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>
        )}
      </div>

      {fieldError && !fieldError.field && (
        <p role="alert" className="text-sm text-danger">{fieldError.message}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] w-full rounded-control bg-accent px-4 font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        {isPending ? 'Saving…' : mode.type === 'create' ? 'Add recurring event' : 'Save changes'}
      </button>
    </form>
  )
}

function RuleRow({
  rule,
  onEdit,
}: {
  rule: RecurringEventRule
  onEdit: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteRule = useDeleteRecurringEventRule()
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
  const timingLabel = rule.startTime ? rule.startTime : 'All-day'

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
              {timingLabel}
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
              {rule.templateId && ` · ${rule.templateId} prep`}
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

/** Full recurring-event manager: list + create/edit form + delete-with-confirm (feature 025). */
export function RecurringEventsManager() {
  const { data: rules, isPending, isError, isFetching, refetch } = useRecurringEvents()
  const [formMode, setFormMode] = useState<FormMode | null>(null)

  if (formMode) {
    const heading = formMode.type === 'create' ? 'New recurring event' : 'Edit recurring event'
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <button
            type="button"
            onClick={() => setFormMode(null)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Back to recurring events"
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
        Add recurring event
      </button>

      {isPending && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading recurring events">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-card bg-surface-alt" />
          ))}
        </div>
      )}

      {isError && (
        <ErrorState
          title="Could not load recurring events"
          copy="Check your connection and try again."
          onRetry={() => void refetch()}
          busy={isFetching}
        />
      )}

      {!isPending && !isError && rules && (
        rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
            <p className="text-sm font-medium text-ink">No recurring events yet</p>
            <p className="text-xs text-ink-muted">Add one above for birthdays, checkups, and other repeating dates.</p>
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
