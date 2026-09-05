import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Flag } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { HeroMetric, StatInline } from '@/components/dashboard/KpiCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  commandCenterKpis,
  computeResourceUtilizations,
  departmentCapacity,
  deriveRequestRiskSeverities,
  executiveAttentionRequests,
  priorityBacklog,
  upcomingDeadlines,
} from '@/engine/dashboardMetrics'
import { formatDate, formatPercent } from '@/lib/utils'
import { priorityTone, riskTone } from '@/lib/statusDisplay'

export function CommandCenter() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()

  const today = useMemo(() => new Date(), [])

  const computed = useMemo(() => {
    if (!data) return null
    const twoWeeksOut = new Date(today)
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)

    const resourceUtilizations = computeResourceUtilizations(
      data.engineResources,
      data.resources,
      data.orgSettings,
      data.engineAssignments,
      data.engineAvailability,
      today,
      twoWeeksOut,
    )
    const availableCapacityNext2Weeks = resourceUtilizations.reduce((sum, r) => sum + Math.max(0, r.availableCapacityHours), 0)
    const kpis = commandCenterKpis({ requests: data.requests, assignments: data.assignments, resourceUtilizations, availableCapacityNext2Weeks })
    const severityByRequest = deriveRequestRiskSeverities(data.requests, data.risks)
    const attentionRequests = executiveAttentionRequests(data.requests, severityByRequest)
    const deadlines = upcomingDeadlines(data.requests, today)
    const deptCapacity = departmentCapacity(resourceUtilizations)
    const backlog = priorityBacklog(data.requests, data.assignments)

    return { kpis, attentionRequests, deadlines, deptCapacity, backlog, severityByRequest }
  }, [data, today])

  if (loading) {
    return (
      <AppShell title={t('commandCenter.title')} subtitle={t('commandCenter.subtitle')}>
        <LoadingState />
      </AppShell>
    )
  }
  if (error) {
    return (
      <AppShell title={t('commandCenter.title')} subtitle={t('commandCenter.subtitle')}>
        <ErrorState message={error} onRetry={refetch} />
      </AppShell>
    )
  }
  if (!data || !computed) {
    return (
      <AppShell title={t('commandCenter.title')} subtitle={t('commandCenter.subtitle')}>
        <EmptyState title={t('requests.empty')} body={t('requests.emptyBody')} />
      </AppShell>
    )
  }

  const { kpis, attentionRequests, deadlines, deptCapacity, backlog } = computed

  return (
    <AppShell title={t('commandCenter.title')} subtitle={t('commandCenter.subtitle')}>
      <div className="space-y-10">
        {/* Hero: the few numbers that answer "what needs attention now" */}
        <section className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
          <HeroMetric label={t('commandCenter.criticalRequests')} value={kpis.criticalRequests} tone={kpis.criticalRequests > 0 ? 'critical' : 'calm'} />
          <HeroMetric label={t('commandCenter.atRiskRequests')} value={kpis.atRiskRequests} tone={kpis.atRiskRequests > 0 ? 'attention' : 'calm'} />
          <HeroMetric label={t('commandCenter.unallocatedRequests')} value={kpis.unallocatedRequests} tone={kpis.unallocatedRequests > 0 ? 'attention' : 'calm'} />
          <HeroMetric label={t('commandCenter.overloadedResources')} value={kpis.overloadedResources} tone={kpis.overloadedResources > 0 ? 'critical' : 'calm'} />
        </section>

        {/* Supporting context — deliberately quieter than the hero row above */}
        <section className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-slate-200/70 pt-6">
          <StatInline label={t('commandCenter.activeRequests')} value={kpis.activeRequests} />
          <StatInline label={t('commandCenter.teamUtilization')} value={formatPercent(kpis.teamUtilization * 100, locale)} emphasize />
          <StatInline label={t('commandCenter.availableCapacity')} value={`${Math.round(kpis.availableCapacityNext2Weeks)} ${t('common.hours')}`} />
          <StatInline label={t('commandCenter.upcomingDeadlines')} value={deadlines.length} />
        </section>

        <Card>
          <CardHeader className="items-center gap-2">
            <Flag className="h-4 w-4 shrink-0 text-gold-600" />
            <CardTitle>{t('commandCenter.executiveAttention')}</CardTitle>
          </CardHeader>
          <CardContent>
            {attentionRequests.length === 0 ? (
              <p className="text-sm text-slate-500">{t('commandCenter.executiveAttentionEmpty')}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {attentionRequests.map((r) => {
                  const severity = computed.severityByRequest.get(r.id) ?? 'high'
                  return (
                    <button
                      key={r.id}
                      onClick={() => navigate(`/requests/${r.id}`)}
                      className="rounded-[var(--radius-control)] bg-status-critical-bg/30 p-3 text-start transition-colors hover:bg-status-critical-bg/70"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge tone={priorityTone[r.priority_level]}>{t(`priority.${r.priority_level}`)}</Badge>
                        <Badge tone={riskTone[severity]}>{t(`risk.${severity}`)}</Badge>
                      </div>
                      <p className="text-sm font-medium text-slate-800">{r.title}</p>
                      <p className="text-xs text-slate-500">{r.requesting_entity}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('commandCenter.upcomingDeadlines')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {deadlines.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">{t('commandCenter.noDeadlines')}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {deadlines.slice(0, 8).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <button onClick={() => navigate(`/requests/${r.id}`)} className="min-w-0 text-start">
                        <p className="truncate text-sm font-medium text-slate-800 hover:underline">{r.title}</p>
                        <p className="text-xs text-slate-500">{r.requesting_entity}</p>
                      </button>
                      <div className="shrink-0 text-end">
                        <p className="text-xs font-medium text-slate-700">{formatDate(r.requested_deadline, locale)}</p>
                        <Badge tone={priorityTone[r.priority_level]} className="mt-0.5">
                          {t(`priority.${r.priority_level}`)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('commandCenter.teamCapacity')}</CardTitle>
            </CardHeader>
            <CardContent>
              {deptCapacity.length === 0 ? (
                <p className="text-sm text-slate-500">{t('common.noData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={deptCapacity.map((d) => ({ ...d, avgUtilizationPct: Math.round(d.avgUtilization * 100) }))} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 120]} tickFormatter={(v) => `${v}%`} fontSize={11} />
                    <YAxis type="category" dataKey="department" width={140} fontSize={11} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="avgUtilizationPct" radius={[0, 4, 4, 0]} fill="#114c07" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('commandCenter.priorityVsCapacity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={backlog.map((b) => ({ ...b, label: t(`priority.${b.priority}`) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => `${v} ${t('common.hours')}`} />
                <Bar dataKey="backlogHours" radius={[4, 4, 0, 0]} fill="#b5760a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
