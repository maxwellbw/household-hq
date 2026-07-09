// Mirrors backend/Config.js enums and HEADERS — field names match the Sheet
// columns exactly (feature 006 data-model.md).

export type Owner = 'max' | 'jaz' | 'both'
export type TaskStatus = 'open' | 'done' | 'snoozed'
export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'

export interface Event {
  id: string
  title: string
  start: string // ISO 8601 datetime
  end: string // ISO 8601 datetime
  owner: Owner
  type?: string
  notes?: string
  templateId?: string
  gcalEventId?: string
  prepGeneratedFor?: string
}

export interface Task {
  id: string
  title: string
  dueDate?: string // ISO date
  owner: Owner
  status: TaskStatus
  eventId?: string
  recurringId?: string
  completedBy?: Owner
  completedAt?: string // ISO datetime
  snoozeHistory?: string
  listItems?: string
}

export interface Settings {
  timezone: string
  [key: string]: string
}

export interface WhoAmI {
  identity: 'max' | 'jaz' | 'shared'
  displayName: string
  email: string
  needsActingPerson: boolean
}

export interface Session {
  token: string
  who: WhoAmI
  actingPerson?: 'max' | 'jaz'
}
