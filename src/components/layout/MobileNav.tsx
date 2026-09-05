import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Bell, CheckSquare, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

const items = [
  { key: 'dashboard', path: '/', icon: LayoutDashboard, labelKey: 'nav.commandCenter' },
  { key: 'requests', path: '/requests', icon: ClipboardList, labelKey: 'nav.workRequests' },
  { key: 'alerts', path: '/notifications', icon: Bell, labelKey: 'nav.notifications' },
  { key: 'approvals', path: '/allocation', icon: CheckSquare, labelKey: 'nav.allocationWorkspace' },
  { key: 'resources', path: '/resources', icon: Users, labelKey: 'nav.resources' },
]

export function MobileNav() {
  const { t } = useI18n()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200/70 bg-white md:hidden">
      {items.map((item) => (
        <NavLink
          key={item.key}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-slate-500',
              isActive && 'text-brand-700',
            )
          }
        >
          <item.icon className="h-5 w-5" />
          <span className="truncate px-1">{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
