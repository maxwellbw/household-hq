import { Home, Calendar, ListChecks, Rss, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavSection = 'home' | 'calendar' | 'tasks' | 'feed' | 'more'

export interface NavItem {
  key: NavSection
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'tasks', label: 'Tasks', icon: ListChecks },
  { key: 'feed', label: 'Feed', icon: Rss },
  { key: 'more', label: 'More', icon: MoreHorizontal },
]
