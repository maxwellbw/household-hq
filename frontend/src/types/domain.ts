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

export interface RecurringRule {
  id: string
  title: string
  cadence: Cadence
  anchorDate: string     // YYYY-MM-DD
  defaultOwner: Owner
  lastGenerated?: string // YYYY-MM-DD
  seasonStart?: string   // '1'–'12'
  seasonEnd?: string     // '1'–'12'
}

export interface TaskTemplate {
  id: string
  eventType: string
  taskTitle: string
  offsetDays: number     // int; negative = before event, 0 = day-of, positive = after
  defaultOwner: Owner
}

export interface ActivityEntry {
  id?: string
  timestamp: string // ISO datetime
  actor: 'max' | 'jaz'
  action: string
  targetId?: string
  detail?: string
  summary: string // composed human-readable sentence from backend
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
