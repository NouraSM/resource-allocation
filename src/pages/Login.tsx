import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

const DEMO_ACCOUNTS = [
  { role: 'admin', email: 'admin@racopilot.demo' },
  { role: 'resource_manager', email: 'manager@racopilot.demo' },
  { role: 'consultant', email: 'consultant@racopilot.demo' },
  { role: 'executive_viewer', email: 'executive@racopilot.demo' },
]

export function Login() {
  const { t } = useI18n()
  const { signIn, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (session) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'
    navigate(redirectTo, { replace: true })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) setFormError(t('auth.signInError'))
    else navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] bg-brand-700 text-white">
            <Compass className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{t('auth.title')}</h1>
          <p className="text-sm text-slate-500">{t('auth.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-[var(--radius-card)] border border-slate-200/70 bg-white p-6">
          <div>
            <Label htmlFor="email">{t('common.email')}</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">{t('common.password')}</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {formError && <p className="text-xs font-medium text-status-critical">{formError}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? t('common.loading') : t('common.signIn')}
          </Button>
        </form>
        <div className="mt-5 rounded-[var(--radius-card)] border border-dashed border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">{t('auth.demoAccounts')}</p>
          <ul className="space-y-1 text-xs text-slate-500">
            {DEMO_ACCOUNTS.map((acc) => (
              <li key={acc.email} className="flex items-center justify-between gap-2">
                <span>{t(`roles.${acc.role}`)}</span>
                <button
                  type="button"
                  className="font-mono text-brand-700 hover:underline"
                  onClick={() => setEmail(acc.email)}
                >
                  {acc.email}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">
            Password for all demo accounts: <span className="font-mono">RaCopilot!Demo1</span>
          </p>
        </div>
      </div>
    </div>
  )
}
