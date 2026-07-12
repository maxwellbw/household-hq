import { Home, Calendar, ListChecks, ShoppingCart, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavSection = 'home' | 'calendar' | 'tasks' | 'lists' | 'more'

export interface NavItem {
  key: NavSection
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'tasks', label: 'Tasks', icon: ListChecks },
  { key: 'lists', label: 'Lists', icon: ShoppingCart },
  { key: 'more', label: 'More', icon: MoreHorizontal },
]
