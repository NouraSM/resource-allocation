import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const actions = useMemo(() => Array.from(new Set((data?.auditLogs ?? []).map((a) => a.action))).sort(), [data])
  const filtered = useMemo(() => (data ? data.auditLogs.filter((a) => actionFilter === 'all' || a.action === actionFilter) : []), [data, actionFilter])

  if (loading) return <AppShell title={t('auditLog.title')}><LoadingState /></AppShell>
  if (error) return <AppShell title={t('auditLog.title')}><ErrorState message={error} onRetry={refetch} /></AppShell>
  if (!data || data.auditLogs.length === 0) return <AppShell title={t('auditLog.title')}><EmptyState title={t('auditLog.empty')} /></AppShell>

  return (
    <AppShell title={t('auditLog.title')}>
      <div className="space-y-3">
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-64">
          <option value="all">{t('auditLog.action')}: {t('common.all')}</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>{t('auditLog.date')}</TH>
                <TH>{t('auditLog.user')}</TH>
                <TH>{t('auditLog.action')}</TH>
                <TH>{t('auditLog.entity')}</TH>
                <TH>{t('auditLog.reason')}</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((a) => {
                const user = data.profiles.find((p) => p.id === a.user_id)
                const expanded = expandedId === a.id
                return (
                  <Fragment key={a.id}>
                    <TR className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : a.id)}>
                      <TD className="whitespace-nowrap text-xs">{formatDate(a.created_at, locale)}</TD>
                      <TD className="text-xs">{user?.full_name ?? '—'}</TD>
                      <TD className="whitespace-nowrap text-xs capitalize">{a.action.replace(/_/g, ' ')}</TD>
                      <TD className="text-xs">{a.entity_type}</TD>
                      <TD className="text-xs text-slate-500">{a.reason ?? '—'}</TD>
                      <TD className="whitespace-nowrap">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          {t('auditLog.before')}/{t('auditLog.after')}
                        </span>
                      </TD>
                    </TR>
                    {expanded && (
                      <TR className="bg-slate-50/60 hover:bg-slate-50/60">
                        <TD colSpan={6}>
                          <div className="grid gap-3 py-1 text-xs text-slate-600 sm:grid-cols-2">
                            <div>
                              <p className="mb-1 font-semibold text-slate-400">{t('auditLog.before')}</p>
                              <p className="break-words">{summarizeValue(a.old_value)}</p>
                            </div>
                            <div>
                              <p className="mb-1 font-semibold text-slate-400">{t('auditLog.after')}</p>
                              <p className="break-words">{summarizeValue(a.new_value)}</p>
                            </div>
                          </div>
                        </TD>
                      </TR>
                    )}
                  </Fragment>
                )
              })}
            </TBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  )
}
