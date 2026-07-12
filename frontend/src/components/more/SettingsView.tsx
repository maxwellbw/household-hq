import { useEffect, useState } from 'react'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  DIGEST_HOUR_OPTIONS,
  MONTHLY_DAY_OPTIONS,
  TIMEZONE_OPTIONS,
  WEEKDAYS,
  validateSettingField,
  type EditableSettings,
  type EditableSettingsKey,
} from '@/lib/settings'

const DEFAULTS: EditableSettings = {
  digestWeeklyEnabled: 'TRUE',
  digestWeeklyDay: 'Sunday',
  digestMonthlyEnabled: 'TRUE',
  digestMonthlyDay: 'last',
  digestHour: '7',
  ntfyEnabled: 'TRUE',
  gcalEventReminderMin: '30',
  timezone: 'America/Los_Angeles',
}

function toFormValues(settings: Record<string, string> | undefined): EditableSettings {
  if (!settings) return DEFAULTS
  const out = { ...DEFAULTS }
  ;(Object.keys(DEFAULTS) as EditableSettingsKey[]).forEach((key) => {
    if (settings[key]) out[key] = settings[key]
  })
  return out
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative min-h-[28px] w-12 shrink-0 rounded-full transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        checked ? 'bg-accent' : 'bg-border',
      )}
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-surface shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}

function FieldRow({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink">{label}</span>
        {children}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  )
}

const selectClass =
  'min-h-[40px] rounded-control border border-border bg-surface px-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** Curated Settings editor under More (feature 020) — labeled controls, not a raw
 *  key-value editor. Only the eight household-preference fields are exposed; emails, ntfy
 *  topics, calendar IDs, and weather keys stay Sheet-only (FR-013). */
export function SettingsView() {
  const { data, isPending, isError } = useSettings()
  const update = useUpdateSettings()
  const toast = useToast()

  const [form, setForm] = useState<EditableSettings>(DEFAULTS)
  const [saved, setSaved] = useState<EditableSettings>(DEFAULTS)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditableSettingsKey, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (data?.settings) {
      const values = toFormValues(data.settings)
      setForm(values)
      setSaved(values)
    }
  }, [data])

  function setField<K extends EditableSettingsKey>(key: K, value: EditableSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setFieldErrors((e) => ({ ...e, [key]: undefined }))
  }

  const changedKeys = (Object.keys(form) as EditableSettingsKey[]).filter(
    (key) => form[key] !== saved[key],
  )
  const isDirty = changedKeys.length > 0

  async function handleSave() {
    setFormError(null)
    const errors: Partial<Record<EditableSettingsKey, string>> = {}
    changedKeys.forEach((key) => {
      const message = validateSettingField(key, form[key])
      if (message) errors[key] = message
    })
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    if (!isDirty) return

    const payload: Partial<EditableSettings> = {}
    changedKeys.forEach((key) => {
      payload[key] = form[key]
    })

    try {
      await update.mutateAsync(payload)
      toast.show('Settings saved')
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        setFieldErrors({ [err.field as EditableSettingsKey]: err.message })
      } else {
        setFormError('Could not save settings. Please try again.')
      }
    }
  }

  if (isPending) {
    return <p className="px-4 py-6 text-sm text-ink-muted">Loading settings…</p>
  }
  if (isError) {
    return <p className="px-4 py-6 text-sm text-danger">Could not load settings.</p>
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <section aria-labelledby="settings-digest-heading">
        <h2
          id="settings-digest-heading"
          className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint"
        >
          Digest emails
        </h2>
        <div className="rounded-card bg-surface shadow-card">
          <FieldRow label="Weekly digest">
            <Toggle
              checked={form.digestWeeklyEnabled === 'TRUE'}
              onChange={(checked) => setField('digestWeeklyEnabled', checked ? 'TRUE' : 'FALSE')}
              label="Weekly digest"
            />
          </FieldRow>
          <FieldRow label="Weekly digest day" error={fieldErrors.digestWeeklyDay}>
            <select
              value={form.digestWeeklyDay}
              disabled={form.digestWeeklyEnabled !== 'TRUE'}
              onChange={(e) => setField('digestWeeklyDay', e.target.value)}
              className={cn(selectClass, 'disabled:opacity-50')}
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Monthly digest">
            <Toggle
              checked={form.digestMonthlyEnabled === 'TRUE'}
              onChange={(checked) => setField('digestMonthlyEnabled', checked ? 'TRUE' : 'FALSE')}
              label="Monthly digest"
            />
          </FieldRow>
          <FieldRow label="Monthly digest day" error={fieldErrors.digestMonthlyDay}>
            <select
              value={form.digestMonthlyDay}
              disabled={form.digestMonthlyEnabled !== 'TRUE'}
              onChange={(e) => setField('digestMonthlyDay', e.target.value)}
              className={cn(selectClass, 'disabled:opacity-50')}
            >
              {MONTHLY_DAY_OPTIONS.map((day) => (
                <option key={day} value={day}>{day === 'last' ? 'Last day' : day}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Digest send hour" error={fieldErrors.digestHour}>
            <select
              value={form.digestHour}
              onChange={(e) => setField('digestHour', e.target.value)}
              className={selectClass}
            >
              {DIGEST_HOUR_OPTIONS.map((hour) => (
                <option key={hour} value={hour}>{hour}:00</option>
              ))}
            </select>
          </FieldRow>
        </div>
      </section>

      <section aria-labelledby="settings-notifications-heading">
        <h2
          id="settings-notifications-heading"
          className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint"
        >
          Notifications
        </h2>
        <div className="rounded-card bg-surface shadow-card">
          <FieldRow label="Instant completion pings">
            <Toggle
              checked={form.ntfyEnabled === 'TRUE'}
              onChange={(checked) => setField('ntfyEnabled', checked ? 'TRUE' : 'FALSE')}
              label="Instant completion pings"
            />
          </FieldRow>
          <FieldRow label="Calendar reminder minutes" error={fieldErrors.gcalEventReminderMin}>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={form.gcalEventReminderMin}
              onChange={(e) => setField('gcalEventReminderMin', e.target.value)}
              className={cn(selectClass, 'w-20 text-right')}
            />
          </FieldRow>
        </div>
      </section>

      <section aria-labelledby="settings-household-heading">
        <h2
          id="settings-household-heading"
          className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint"
        >
          Household
        </h2>
        <div className="rounded-card bg-surface shadow-card">
          <FieldRow label="Timezone" error={fieldErrors.timezone}>
            <select
              value={form.timezone}
              onChange={(e) => setField('timezone', e.target.value)}
              className={selectClass}
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </FieldRow>
        </div>
      </section>

      {formError && (
        <p role="alert" className="text-sm text-danger">{formError}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!isDirty || update.isPending}
        className="min-h-[44px] w-full rounded-control bg-accent px-4 font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
      >
        {update.isPending ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}
