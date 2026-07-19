import { cloneElement, isValidElement, useEffect, useId, useState } from 'react'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import { ErrorState } from '@/components/shell/ErrorState'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  getCapability,
  isIos,
  isSubscribedThisDevice,
  subscribeThisDevice,
  unsubscribeThisDevice,
  type PushCapability,
} from '@/lib/push'
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
  pushEnabled: 'TRUE',
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
  id,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  /** Supplied by FieldRow so the row's <label> points at this control. */
  id?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative min-h-[28px] w-12 shrink-0 rounded-full border transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        // T033 / audit F-20: the knob was bg-surface on a bg-border track — nearly
        // invisible in light and worse in dark. The track now carries its own
        // border and the off state uses surface-alt, so knob-vs-track reads at a
        // glance in both themes; the accent-strong on state keeps the knob legible
        // against the fill too.
        checked ? 'border-accent-strong bg-accent-strong' : 'border-border bg-surface-alt',
      )}
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full border shadow transition-transform',
          checked ? 'translate-x-6 border-accent-strong bg-surface' : 'translate-x-1 border-ink-faint bg-surface',
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
  // T033 / FR-023: the row label used to be a bare <span>, so every select and the
  // number input in this view reached axe with *no* accessible name (5 critical
  // `label`/`select-name` violations). The row now mints an id, hands it to its
  // control, and renders a real <label htmlFor> — one fix covers every field, and
  // new fields get it for free rather than each remembering an aria-label.
  const controlId = useId()
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: controlId })
    : children

  return (
    <div className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={controlId} className="text-sm text-ink">
          {label}
        </label>
        {control}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  )
}

const selectClass =
  'min-h-[40px] rounded-control border border-border bg-surface px-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

/** Per-device push opt-in (feature 010 US2). Reflects the true capability state — on /
 *  off / blocked-by-OS / unsupported-on-this-platform — and explains the next step rather
 *  than offering a dead button (FR-012). Household-wide on/off lives in the toggle above,
 *  in the generic settings.update flow; this is a separate, device-scoped action. */
function DeviceNotificationControl() {
  const { authedCall } = useAuth()
  const toast = useToast()
  const [capability, setCapability] = useState<PushCapability | 'checking'>('checking')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cap = getCapability()
    setCapability(cap)
    if (cap === 'granted') {
      isSubscribedThisDevice().then(setSubscribed).catch(() => setSubscribed(false))
    }
  }, [])

  async function handleEnable() {
    setBusy(true)
    setError(null)
    try {
      await subscribeThisDevice(authedCall)
      setCapability(getCapability())
      setSubscribed(true)
      toast.show('Notifications enabled on this device')
    } catch (err) {
      setCapability(getCapability())
      setError(err instanceof Error ? err.message : 'Could not enable notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    setBusy(true)
    setError(null)
    try {
      await unsubscribeThisDevice(authedCall)
      setSubscribed(false)
      toast.show('Notifications disabled on this device')
    } catch {
      setError('Could not disable notifications. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  let body: React.ReactNode
  if (capability === 'checking') {
    body = <span className="text-sm text-ink-muted">Checking…</span>
  } else if (capability === 'unsupported') {
    body = (
      <p className="text-sm text-ink-muted">
        {isIos()
          ? 'Add Household HQ to your Home Screen first, then open it from there to enable notifications.'
          : 'Notifications aren’t supported in this browser.'}
      </p>
    )
  } else if (capability === 'blocked') {
    body = (
      <p className="text-sm text-ink-muted">
        Notifications are blocked for this app. Re-enable them in your device’s notification
        settings, then reopen Household HQ.
      </p>
    )
  } else if (subscribed) {
    body = (
      <button
        type="button"
        onClick={handleDisable}
        disabled={busy}
        className="min-h-[36px] rounded-control border border-border bg-surface px-3 text-sm text-ink hover:bg-canvas disabled:opacity-50"
      >
        {busy ? 'Disabling…' : 'Disable'}
      </button>
    )
  } else {
    body = (
      <button
        type="button"
        onClick={handleEnable}
        disabled={busy}
        className="min-h-[36px] rounded-control bg-accent-strong px-3 text-sm font-medium text-surface hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-ink-faint disabled:hover:bg-surface-alt"
      >
        {busy ? 'Enabling…' : 'Enable notifications'}
      </button>
    )
  }

  return (
    <FieldRow label="Notifications on this device">
      <div className="flex flex-col items-end gap-1">
        {body}
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </div>
    </FieldRow>
  )
}

/** Curated Settings editor under More (feature 020) — labeled controls, not a raw
 *  key-value editor. Only the eight household-preference fields are exposed; emails, VAPID
 *  keys, calendar IDs, and weather keys stay Sheet-only (FR-013). */
export function SettingsView() {
  const { data, isPending, isError, isFetching, refetch } = useSettings()
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
    return (
      <ErrorState
        title="Could not load settings"
        copy="Check your connection and try again."
        onRetry={() => void refetch()}
        busy={isFetching}
      />
    )
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
          <FieldRow label="Push notifications">
            <Toggle
              checked={form.pushEnabled === 'TRUE'}
              onChange={(checked) => setField('pushEnabled', checked ? 'TRUE' : 'FALSE')}
              label="Push notifications"
            />
          </FieldRow>
          <DeviceNotificationControl />
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
        // T033 / audit F-20: disabled was `opacity-50` over an accent fill —
        // washed terracotta under white text, well under 3:1. It now drops to a
        // flat inert surface with faint-but-readable ink, so "nothing to save"
        // reads as a state rather than as a broken button, in both themes.
        className="min-h-[44px] w-full rounded-control bg-accent-strong px-4 font-medium text-surface hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-ink-faint disabled:hover:bg-surface-alt"
      >
        {update.isPending ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}
