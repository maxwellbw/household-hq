import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SettingsView } from './SettingsView'

const settingsData = {
  settings: {
    timezone: 'America/Los_Angeles',
    digestWeeklyEnabled: 'TRUE',
    digestWeeklyDay: 'Sunday',
    digestMonthlyEnabled: 'TRUE',
    digestMonthlyDay: 'last',
    digestHour: '7',
    ntfyEnabled: 'TRUE',
    gcalEventReminderMin: '30',
  },
}

const mutateAsync = vi.fn().mockResolvedValue({ settings: settingsData.settings, changed: [], digestTriggerReinstalled: false })
const toastShow = vi.fn()

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ data: settingsData, isPending: false, isError: false }),
  useUpdateSettings: () => ({ mutateAsync, isPending: false }),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ show: toastShow }),
}))

beforeEach(() => {
  mutateAsync.mockClear()
  toastShow.mockClear()
})

describe('SettingsView', () => {
  it('seeds fields from the current settings and disables Save until something changes', () => {
    render(<SettingsView />)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled()
    expect(screen.getByLabelText(/weekly digest$/i)).toHaveAttribute('aria-checked', 'true')
  })

  it('enables Save after a field changes and submits only the changed key', async () => {
    render(<SettingsView />)

    const reminderInput = screen.getByDisplayValue('30')
    fireEvent.change(reminderInput, { target: { value: '15' } })

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    expect(saveButton).toBeEnabled()
    fireEvent.click(saveButton)

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ gcalEventReminderMin: '15' }))
    await waitFor(() => expect(toastShow).toHaveBeenCalledWith('Settings saved'))
  })

  it('toggling ntfy pings off submits the flipped boolean', async () => {
    render(<SettingsView />)

    fireEvent.click(screen.getByLabelText(/instant completion pings/i))
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ ntfyEnabled: 'FALSE' }))
  })
})
