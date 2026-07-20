// Field metadata + client-side validation for the curated Settings editor (feature 020).
// Mirrors the backend allow-set/validation in backend/Config.js (EDITABLE_SETTINGS,
// SETTINGS_TIMEZONES) and backend/Api.js (validateSettingValue_) — kept in sync by hand,
// the backend is the source of truth and re-validates every field.

export const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

export interface TimezoneOption {
  label: string
  value: string
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { label: 'Pacific', value: 'America/Los_Angeles' },
  { label: 'Mountain', value: 'America/Denver' },
  { label: 'Central', value: 'America/Chicago' },
  { label: 'Eastern', value: 'America/New_York' },
  { label: 'Arizona (no DST)', value: 'America/Phoenix' },
  { label: 'Hawaii', value: 'Pacific/Honolulu' },
]

export const MONTHLY_DAY_OPTIONS = ['last', ...Array.from({ length: 28 }, (_, i) => String(i + 1))]

export const DIGEST_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i))

/** The Settings-tab keys this editor may write; must match backend EDITABLE_SETTINGS. */
export const EDITABLE_SETTINGS_KEYS = [
  'digestWeeklyEnabled', 'digestWeeklyDay', 'digestMonthlyEnabled', 'digestMonthlyDay',
  'digestHour', 'pushEnabled', 'gcalEventReminderMin', 'timezone',
  'morningOverduePushHour', 'eveningWalkPushHour',
] as const

export type EditableSettingsKey = (typeof EDITABLE_SETTINGS_KEYS)[number]

export type EditableSettings = Record<EditableSettingsKey, string>

/** Field-level validation message, or null if valid. Mirrors validateSettingValue_ (Api.js). */
export function validateSettingField(key: EditableSettingsKey, value: string): string | null {
  switch (key) {
    case 'digestWeeklyEnabled':
    case 'digestMonthlyEnabled':
    case 'pushEnabled':
      return value === 'TRUE' || value === 'FALSE' ? null : 'Must be on or off.'
    case 'digestWeeklyDay':
      return WEEKDAYS.some((d) => d.toLowerCase() === value.toLowerCase())
        ? null
        : 'Pick a day of the week.'
    case 'digestMonthlyDay': {
      if (value.toLowerCase() === 'last') return null
      const n = Number(value)
      return /^\d{1,2}$/.test(value) && n >= 1 && n <= 28 ? null : 'Pick "last" or a day 1-28.'
    }
    case 'digestHour': {
      const n = Number(value)
      return /^\d{1,2}$/.test(value) && n <= 23 ? null : 'Pick an hour 0-23.'
    }
    case 'morningOverduePushHour':
    case 'eveningWalkPushHour': {
      const n = Number(value)
      return /^\d{1,2}$/.test(value) && n <= 23 ? null : 'Pick an hour 0-23.'
    }
    case 'gcalEventReminderMin':
      return /^\d+$/.test(value) ? null : 'Must be a non-negative number of minutes.'
    case 'timezone':
      return TIMEZONE_OPTIONS.some((tz) => tz.value === value) ? null : 'Pick a supported timezone.'
    default:
      return null
  }
}
