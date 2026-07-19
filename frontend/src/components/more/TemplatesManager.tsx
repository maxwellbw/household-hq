import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '@/hooks/useTemplates'
import { useToast } from '@/hooks/useToast'
import { ownerStyle, ALL_OWNERS } from '@/lib/owners'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ErrorState } from '@/components/shell/ErrorState'
import type { Owner, TaskTemplate } from '@/types/domain'

type FormMode = { type: 'create' } | { type: 'edit'; template: TaskTemplate }

interface TemplateFormState {
  eventType: string
  taskTitle: string
  offsetDays: string // string in the form for easy editing; coerced to int on submit
  defaultOwner: Owner
}

function emptyForm(): TemplateFormState {
  return { eventType: '', taskTitle: '', offsetDays: '0', defaultOwner: 'both' }
}

function templateToForm(t: TaskTemplate): TemplateFormState {
  return {
    eventType: t.eventType,
    taskTitle: t.taskTitle,
    offsetDays: String(t.offsetDays),
    defaultOwner: t.defaultOwner,
  }
}

function offsetLabel(days: number): string {
  if (days === 0) return 'Day of event'
  if (days === -1) return '1 day before'
  if (days < 0) return `${Math.abs(days)} days before`
  if (days === 1) return '1 day after'
  return `${days} days after`
}

function TemplateForm({
  mode,
  onDone,
}: {
  mode: FormMode
  onDone: () => void
}) {
  const create = useCreateTemplate()
  const update = useUpdateTemplate()
  const toast = useToast()

  const [form, setForm] = useState<TemplateFormState>(
    mode.type === 'edit' ? templateToForm(mode.template) : emptyForm(),
  )
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)

  const isPending = create.isPending || update.isPending

  function setField<K extends keyof TemplateFormState>(key: K, value: TemplateFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    if (!form.eventType.trim()) {
      setFieldError({ field: 'eventType', message: 'Enter an event type.' })
      return
    }
    if (!form.taskTitle.trim()) {
      setFieldError({ field: 'taskTitle', message: 'Enter a task title.' })
      return
    }
    const offsetNum = parseInt(form.offsetDays, 10)
    if (isNaN(offsetNum)) {
      setFieldError({ field: 'offsetDays', message: 'Enter a whole number (can be negative).' })
      return
    }

    const payload: Omit<TaskTemplate, 'id'> = {
      eventType: form.eventType.trim(),
      taskTitle: form.taskTitle.trim(),
      offsetDays: offsetNum,
      defaultOwner: form.defaultOwner,
    }

    try {
      if (mode.type === 'create') {
        await create.mutateAsync(payload)
        toast.show('Template added')
      } else {
        await update.mutateAsync({ id: mode.template.id, ...payload })
        toast.show('Template updated')
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
      {/* Event type */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">Event type</span>
        <input
          autoFocus
          value={form.eventType}
          onChange={(e) => setField('eventType', e.target.value)}
          placeholder="e.g. camping, dinner party"
          aria-invalid={fieldError?.field === 'eventType' ? true : undefined}
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {fieldError?.field === 'eventType' && (
          <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>
        )}
      </label>

      {/* Task title */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">Task to create</span>
        <input
          value={form.taskTitle}
          onChange={(e) => setField('taskTitle', e.target.value)}
          placeholder="e.g. Pack sleeping bags"
          aria-invalid={fieldError?.field === 'taskTitle' ? true : undefined}
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {fieldError?.field === 'taskTitle' && (
          <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>
        )}
      </label>

      {/* Offset days */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">
          Due offset{' '}
          <span className="font-normal text-ink-faint">(days before/after event; 0 = day-of)</span>
        </span>
        <input
          type="number"
          value={form.offsetDays}
          onChange={(e) => setField('offsetDays', e.target.value)}
          aria-invalid={fieldError?.field === 'offsetDays' ? true : undefined}
          className="min-h-[44px] w-full rounded-control border border-border bg-surface px-3 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {!isNaN(parseInt(form.offsetDays, 10)) && (
          <p className="mt-1 text-xs text-ink-faint">{offsetLabel(parseInt(form.offsetDays, 10))}</p>
        )}
        {fieldError?.field === 'offsetDays' && (
          <p role="alert" className="mt-1 text-xs text-danger">{fieldError.message}</p>
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

      {fieldError && !fieldError.field && (
        <p role="alert" className="text-sm text-danger">{fieldError.message}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] w-full rounded-control bg-accent px-4 font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        {isPending ? 'Saving…' : mode.type === 'create' ? 'Add template' : 'Save changes'}
      </button>
    </form>
  )
}

function TemplateRow({
  template,
  onEdit,
}: {
  template: TaskTemplate
  onEdit: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteTemplate = useDeleteTemplate()
  const toast = useToast()
  const ownerSt = ownerStyle(template.defaultOwner)

  async function handleDelete() {
    await deleteTemplate.mutateAsync(template.id)
    toast.show(`"${template.taskTitle}" template deleted`)
  }

  return (
    <li className="border-b border-border last:border-b-0">
      {confirmDelete ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <p className="flex-1 text-sm text-ink">Delete &ldquo;{template.taskTitle}&rdquo;?</p>
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
            disabled={deleteTemplate.isPending}
            className="min-h-[44px] rounded-control bg-danger px-3 text-sm font-medium text-surface hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-50"
          >
            {deleteTemplate.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{template.taskTitle}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {template.eventType}
              {' · '}
              {offsetLabel(template.offsetDays)}
              {' · '}
              <span
                className={cn(
                  'inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-medium text-surface',
                  template.defaultOwner === 'max' && 'bg-owner-max',
                  template.defaultOwner === 'jaz' && 'bg-owner-jaz',
                  template.defaultOwner === 'both' && 'bg-owner-both',
                )}
                aria-label={ownerSt.label}
              >
                {ownerSt.initial}
              </span>
              {' '}{ownerSt.label}
            </p>
          </div>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${template.taskTitle}`}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete ${template.taskTitle}`}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-danger hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  )
}

/** Full template manager: list + create/edit form + delete-with-confirm (T031). */
export function TemplatesManager() {
  const { data: templates, isPending, isError, isFetching, refetch } = useTemplates()
  const [formMode, setFormMode] = useState<FormMode | null>(null)

  if (formMode) {
    const heading = formMode.type === 'create' ? 'New prep template' : 'Edit template'
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <button
            type="button"
            onClick={() => setFormMode(null)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-control text-ink-muted hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Back to templates"
          >
            ←
          </button>
          <h3 className="font-display text-lg text-ink">{heading}</h3>
        </div>
        <TemplateForm mode={formMode} onDone={() => setFormMode(null)} />
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
        Add prep template
      </button>

      {isPending && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading templates">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-card bg-surface-alt" />
          ))}
        </div>
      )}

      {isError && (
        <ErrorState
          title="Could not load templates"
          copy="Check your connection and try again."
          onRetry={() => void refetch()}
          busy={isFetching}
        />
      )}

      {!isPending && !isError && templates && (
        templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
            <p className="text-sm font-medium text-ink">No templates yet</p>
            <p className="text-xs text-ink-muted">
              Templates auto-generate prep tasks when you add a matching event.
            </p>
          </div>
        ) : (
          <ul className="rounded-card bg-surface shadow-card">
            {templates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                onEdit={() => setFormMode({ type: 'edit', template })}
              />
            ))}
          </ul>
        )
      )}
    </div>
  )
}
