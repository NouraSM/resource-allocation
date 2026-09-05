import { useNavigate } from 'react-router-dom'
import { Globe, LogOut, User } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

export function Topbar({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { locale, setLocale, t } = useI18n()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200/70 bg-white px-4 py-4 md:px-8 md:py-5">
      <div className="min-w-0">
        {title && <h1 className="truncate text-[22px] font-semibold tracking-tight text-slate-900">{title}</h1>}
        {subtitle && <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
          aria-label="Toggle language"
        >
          <Globe className="h-4 w-4" />
          {locale === 'en' ? 'العربية' : 'English'}
        </Button>
        {profile && (
          <div className="hidden items-center gap-2 rounded-[var(--radius-control)] bg-slate-100/70 px-2.5 py-1.5 sm:flex">
            <User className="h-4 w-4 text-slate-400" />
            <div className="text-xs leading-tight">
              <p className="font-medium text-slate-800">{profile.full_name}</p>
              <p className="text-slate-500">{t(`roles.${profile.role}`)}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut()
            navigate('/login')
          }}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t('common.signOut')}</span>
        </Button>
      </div>
    </header>
  )
}
