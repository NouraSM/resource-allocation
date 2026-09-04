import type { UserRole } from '@/types/database'
import {
  LayoutDashboard,
  ClipboardList,
  Workflow,
  Users,
  KanbanSquare,
  MessageSquareText,
  Bell,
  History,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  key: string
  labelKey: string
  path: string
  icon: LucideIcon
  roles: UserRole[]
}

const ALL_ROLES: UserRole[] = ['admin', 'resource_manager', 'consultant', 'executive_viewer']

export const navItems: NavItem[] = [
  { key: 'command-center', labelKey: 'nav.commandCenter', path: '/', icon: LayoutDashboard, roles: ALL_ROLES },
  {
    key: 'work-requests',
    labelKey: 'nav.workRequests',
    path: '/requests',
    icon: ClipboardList,
    roles: ['admin', 'resource_manager', 'executive_viewer'],
  },
  {
    key: 'allocation',
    labelKey: 'nav.allocationWorkspace',
    path: '/allocation',
    icon: Workflow,
    roles: ['admin', 'resource_manager'],
  },
  { key: 'resources', labelKey: 'nav.resources', path: '/resources', icon: Users, roles: ALL_ROLES },
  {
    key: 'portfolio',
    labelKey: 'nav.portfolio',
    path: '/portfolio',
    icon: KanbanSquare,
    roles: ['admin', 'resource_manager', 'executive_viewer'],
  },
  { key: 'copilot', labelKey: 'nav.copilot', path: '/copilot', icon: MessageSquareText, roles: ALL_ROLES },
  { key: 'notifications', labelKey: 'nav.notifications', path: '/notifications', icon: Bell, roles: ALL_ROLES },
  {
    key: 'audit-log',
    labelKey: 'nav.auditLog',
    path: '/audit-log',
    icon: History,
    roles: ['admin', 'resource_manager'],
  },
  { key: 'settings', labelKey: 'nav.settings', path: '/settings', icon: Settings, roles: ['admin'] },
]
