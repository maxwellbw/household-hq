import { Calendar, ListChecks, Rss, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavSection = 'calendar' | 'tasks' | 'feed' | 'more'

export interface NavItem {
  key: NavSection
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'tasks', label: 'Tasks', icon: ListChecks },
  { key: 'feed', label: 'Feed', icon: Rss },
  { key: 'more', label: 'More', icon: MoreHorizontal },
]
