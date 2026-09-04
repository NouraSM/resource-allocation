import { useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'

function summarizeValue(value: Record<string, unknown> | null): string {
  if (!value) return '—'
  return Object.entries(value)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(', ')
}

export function AuditLog() {
  const { t, locale } = useI18n()
  const { data, loading, error, refetch } = useOrgData()
  const [actionFilter, setActionFilter] = useState('all')

  const actions = useMemo(() => Array.from(new Set((data?.auditLogs ?? []).map((a) => a.action))).sort(), [data])
  const filtered = useMemo(() => (data ? data.auditLogs.filter((a) => actionFilter === 'all' || a.action === actionFilter) : []), [data, actionFilter])

  if (loading) return <AppShell title={t('auditLog.title')}><LoadingState /></AppShell>
  if (error) return <AppShell title={t('auditLog.title')}><ErrorState message={error} onRetry={refetch} /></AppShell>
  if (!data || data.auditLogs.length === 0) return <AppShell title={t('auditLog.title')}><EmptyState title={t('auditLog.empty')} /></AppShell>

  return (
    <AppShell title={t('auditLog.title')}>
      <div className="space-y-3">
        <Card className="flex gap-3 p-3">
          <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-64">
            <option value="all">{t('auditLog.action')}: {t('common.all')}</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </Card>
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>{t('auditLog.date')}</TH>
                <TH>{t('auditLog.user')}</TH>
                <TH>{t('auditLog.action')}</TH>
                <TH>{t('auditLog.entity')}</TH>
                <TH>{t('auditLog.before')}</TH>
                <TH>{t('auditLog.after')}</TH>
                <TH>{t('auditLog.reason')}</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((a) => {
                const user = data.profiles.find((p) => p.id === a.user_id)
                return (
                  <TR key={a.id}>
                    <TD className="whitespace-nowrap text-xs">{formatDate(a.created_at, locale)}</TD>
                    <TD className="text-xs">{user?.full_name ?? '—'}</TD>
                    <TD className="whitespace-nowrap text-xs capitalize">{a.action.replace(/_/g, ' ')}</TD>
                    <TD className="text-xs">{a.entity_type}</TD>
                    <TD className="max-w-[160px] truncate text-xs text-slate-500" title={summarizeValue(a.old_value)}>
                      {summarizeValue(a.old_value)}
                    </TD>
                    <TD className="max-w-[160px] truncate text-xs text-slate-500" title={summarizeValue(a.new_value)}>
                      {summarizeValue(a.new_value)}
                    </TD>
                    <TD className="text-xs text-slate-500">{a.reason ?? '—'}</TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  )
}
