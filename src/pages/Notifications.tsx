import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCheck, Info } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types/database'

const SEVERITY_ICON = { info: Info, warning: AlertTriangle, critical: AlertTriangle }
const SEVERITY_CLASS = { info: 'text-status-info', warning: 'text-status-attention', critical: 'text-status-critical' }

export function Notifications() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()

  async function markRead(n: Notification) {
    await supabase.from('notifications').update({ read: true }).eq('id', n.id)
    refetch()
  }

  async function markAllRead() {
    if (!data) return
    const unread = data.notifications.filter((n) => !n.read)
    await Promise.all(unread.map((n) => supabase.from('notifications').update({ read: true }).eq('id', n.id)))
    refetch()
  }

  function goToEntity(n: Notification) {
    if (!n.read) markRead(n)
    if (n.entity_type === 'work_request' && n.entity_id) navigate(`/requests/${n.entity_id}`)
    else if (n.entity_type === 'resource' && n.entity_id) navigate(`/resources/${n.entity_id}`)
  }

  if (loading) return <AppShell title={t('notifications.title')}><LoadingState /></AppShell>
  if (error) return <AppShell title={t('notifications.title')}><ErrorState message={error} onRetry={refetch} /></AppShell>
  if (!data || data.notifications.length === 0) {
    return (
      <AppShell title={t('notifications.title')}>
        <EmptyState title={t('notifications.empty')} icon={<Bell className="h-8 w-8" />} />
      </AppShell>
    )
  }

  const unreadCount = data.notifications.filter((n) => !n.read).length

  return (
    <AppShell title={t('notifications.title')}>
      <div className="mx-auto max-w-2xl space-y-3">
        {unreadCount > 0 && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" />
              {t('notifications.markAllRead')}
            </Button>
          </div>
        )}
        {data.notifications.map((n) => {
          const Icon = SEVERITY_ICON[n.severity]
          return (
            <Card
              key={n.id}
              className={cn('cursor-pointer p-3', !n.read && 'border-brand-200 bg-brand-50/40')}
              onClick={() => goToEntity(n)}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', SEVERITY_CLASS[n.severity])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{n.title}</p>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                  </div>
                  <p className="text-xs text-slate-500">{n.message}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{formatDate(n.created_at, locale)}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </AppShell>
  )
}
