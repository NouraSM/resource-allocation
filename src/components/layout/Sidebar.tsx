import { NavLink } from 'react-router-dom'
import { navItems } from '@/lib/nav'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Compass } from 'lucide-react'

export function Sidebar() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const role = profile?.role ?? 'executive_viewer'
  const items = navItems.filter((item) => item.roles.includes(role))

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-e border-slate-200 bg-white md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white">
          <Compass className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{t('app.name')}</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {items.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900',
                isActive && 'bg-brand-50 text-brand-700',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
