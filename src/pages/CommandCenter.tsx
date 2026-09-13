import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, CheckCircle2, Gauge, Users, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { KpiStatCard, StatInline } from '@/components/dashboard/KpiCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  commandCenterKpis,
  computeResourceUtilizations,
  departmentCapacity,
  departmentCapacityInsight,
  priorityBacklog,
  priorityBacklogInsight,
  upcomingDeadlines,
} from '@/engine/dashboardMetrics'
import { utilizationStatus } from '@/engine/capacity'
import { deriveExecutiveDecisions } from '@/engine/executiveDecisions'
import type { ExecutiveDecisionType } from '@/engine/executiveDecisions'
import { formatDate, formatHours, formatNumber, formatPercent, cn } from '@/lib/utils'
import { priorityTone, PROMINENT_PRIORITIES } from '@/lib/statusDisplay'
import type { PriorityLevel } from '@/types/database'

const DECISION_ICON: Record<ExecutiveDecisionType, LucideIcon> = {
  capacity_pressure: Gauge,
  allocation_decision: Workflow,
  workload_pressure: Users,
}
const DECISION_LABEL_KEY: Record<ExecutiveDecisionType, string> = {
  capacity_pressure: 'commandCenter.decisionTypeCapacityPressure',
  allocation_decision: 'commandCenter.decisionTypeAllocationDecision',
  workload_pressure: 'commandCenter.decisionTypeWorkloadPressure',
}
// Restrained semantic mapping by decision type. This is safe as a type-based
// mapping (not a hardcoded severity) because deriveExecutiveDecisions only
// ever emits each type when its own real, data-verified condition already
// holds — e.g. workload_pressure only fires for persistent overload — so the
// type itself already reflects a data-checked severity band, not an assumed one.
const DECISION_BADGE_TONE: Record<ExecutiveDecisionType, 'attention' | 'info' | 'critical'> = {
  capacity_pressure: 'attention',
  allocation_decision: 'info',
  workload_pressure: 'critical',
}
const DECISION_ICON_CLASSES: Record<ExecutiveDecisionType, string> = {
  capacity_pressure: 'bg-status-attention-bg text-status-attention',
  allocation_decision: 'bg-status-info-bg text-status-info',
  workload_pressure: 'bg-status-critical-bg text-status-critical',
}

// Chart fills (Recharts needs literal color values, not Tailwind classes) —
// matching the same semantic hex values used for badges/text elsewhere
// (src/index.css), so a department's bar color always agrees with what
// utilizationTone/utilizationTextClass would show for the same status.
const UTILIZATION_CHART_COLOR: Record<string, string> = {
  underutilized: '#94a3b8',
  healthy: '#1a7f4f',
  high: '#b5760a',
  overloaded: '#b3261e',
  critical: '#b3261e',
}

const PRIORITY_CHART_COLOR: Record<PriorityLevel, string> = {
  critical: '#b3261e',
  high: '#b5760a',
  medium: '#1f4c7a',
  low: '#5f6b7a',
}

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
    const deadlines = upcomingDeadlines(data.requests, today)
    const deptCapacity = departmentCapacity(resourceUtilizations)
    const deptCapacityInsight = departmentCapacityInsight(deptCapacity, data.orgSettings)
    const backlog = priorityBacklog(data.requests, data.assignments)
    const backlogInsight = priorityBacklogInsight(backlog)
    const decisions = deriveExecutiveDecisions({
      requests: data.requests,
      requestSkills: data.requestSkills,
      skills: data.skills,
      resources: data.engineResources,
      assignments: data.engineAssignments,
      availability: data.engineAvailability,
      historicalProjects: data.engineHistoricalProjects,
      org: data.orgSettings,
      today,
    })

    return { kpis, decisions, deadlines, deptCapacity, deptCapacityInsight, backlog, backlogInsight }
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

  const { kpis, decisions, deadlines, deptCapacity, deptCapacityInsight, backlog, backlogInsight } = computed

  // Four peer executive indicators — same card, same number size/weight, same
  // label size, always in the same fixed order so the layout never reshuffles
  // as data changes. Only the accent/number color reacts to the value.
  const kpiCards = [
    { key: 'critical', label: t('commandCenter.criticalRequests'), value: kpis.criticalRequests, tone: kpis.criticalRequests > 0 ? ('critical' as const) : ('calm' as const) },
    { key: 'atRisk', label: t('commandCenter.atRiskRequests'), value: kpis.atRiskRequests, tone: kpis.atRiskRequests > 0 ? ('attention' as const) : ('calm' as const) },
    { key: 'unallocated', label: t('commandCenter.unallocatedRequests'), value: kpis.unallocatedRequests, tone: kpis.unallocatedRequests > 0 ? ('attention' as const) : ('calm' as const) },
    { key: 'overloaded', label: t('commandCenter.overloadedResources'), value: kpis.overloadedResources, tone: kpis.overloadedResources > 0 ? ('critical' as const) : ('calm' as const) },
  ]

  return (
    <AppShell title={t('commandCenter.title')} subtitle={t('commandCenter.subtitle')}>
      <div className="space-y-10">
        {/* Four peer KPIs answering "what needs attention now" — equal weight, no single dominant number */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((k) => (
            <KpiStatCard key={k.key} label={k.label} value={k.value} tone={k.tone} />
          ))}
        </section>

        {/* Supporting context — deliberately quieter than the hero row above */}
        <section className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-slate-200/70 pt-6">
          <StatInline label={t('commandCenter.activeRequests')} value={kpis.activeRequests} />
          <StatInline label={t('commandCenter.teamUtilization')} value={formatPercent(kpis.teamUtilization * 100, locale)} emphasize />
          <StatInline label={t('commandCenter.availableCapacity')} value={`${Math.round(kpis.availableCapacityNext2Weeks)} ${t('common.hours')}`} />
          <StatInline label={t('commandCenter.upcomingDeadlines')} value={deadlines.length} />
        </section>

        {decisions.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-300" />
            {t('commandCenter.executiveAttentionEmpty')}
          </div>
        ) : (
          <Card>
            <CardHeader className="items-center gap-2">
              <CardTitle>{t('commandCenter.executiveAttention')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {decisions.map((decision, i) => {
                const Icon = DECISION_ICON[decision.type]
                return (
                  <button
                    key={i}
                    onClick={() => navigate(decision.ctaPath)}
                    className="flex w-full items-start gap-3 rounded-[var(--radius-control)] bg-slate-50 p-3.5 text-start transition-colors hover:bg-slate-100"
                  >
                    <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', DECISION_ICON_CLASSES[decision.type])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Badge tone={DECISION_BADGE_TONE[decision.type]} className="mb-1.5 font-normal normal-case">
                        {t(DECISION_LABEL_KEY[decision.type])}
                      </Badge>
                      <p className="text-sm font-medium text-slate-800">{decision.headline}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-400">{t('commandCenter.whyItMatters')}: </span>
                        {decision.why}
                      </p>
                    </div>
                    <span className="mt-1 flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700">
                      {decision.ctaLabel}
                      <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                    </span>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        )}

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
                        {PROMINENT_PRIORITIES.includes(r.priority_level) ? (
                          <Badge tone={priorityTone[r.priority_level]} className="mt-0.5">
                            {t(`priority.${r.priority_level}`)}
                          </Badge>
                        ) : (
                          <p className="mt-0.5 text-xs text-slate-400">{t(`priority.${r.priority_level}`)}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-col items-start gap-0.5">
              <CardTitle>{t('commandCenter.teamCapacity')}</CardTitle>
              <p className="text-xs text-slate-400">{t('commandCenter.teamCapacityHint')}</p>
            </CardHeader>
            <CardContent>
              {deptCapacity.length === 0 ? (
                <p className="text-sm text-slate-500">{t('common.noData')}</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(180, deptCapacity.length * 34 + 30)}>
                    <BarChart
                      data={deptCapacity.map((d) => ({ ...d, avgUtilizationPct: Math.round(d.avgUtilization * 100) }))}
                      layout="vertical"
                      margin={{ top: 4, right: 40, bottom: 24, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis
                        type="number"
                        domain={[0, 120]}
                        tickFormatter={(v) => `${v}%`}
                        fontSize={11}
                        label={{ value: t('commandCenter.utilizationAxisLabel'), position: 'insideBottom', offset: -8, fontSize: 11, fill: '#94a3b8' }}
                      />
                      <YAxis type="category" dataKey="department" width={140} fontSize={11} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <ReferenceLine
                        x={100}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        label={{ value: t('commandCenter.capacityLimitLabel'), position: 'insideTopRight', fontSize: 10, fill: '#64748b' }}
                      />
                      <Bar dataKey="avgUtilizationPct" radius={[0, 4, 4, 0]}>
                        {deptCapacity.map((d) => (
                          <Cell key={d.department} fill={UTILIZATION_CHART_COLOR[utilizationStatus(d.avgUtilization, data.orgSettings)]} />
                        ))}
                        <LabelList dataKey="avgUtilizationPct" position="right" formatter={(v) => `${v}%`} fontSize={11} fill="#475569" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {deptCapacityInsight && <p className="mt-1 text-xs text-slate-500">{deptCapacityInsight}</p>}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('commandCenter.priorityVsCapacity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={backlog.map((b) => ({ ...b, label: t(`priority.${b.priority}`) }))} margin={{ top: 16, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  fontSize={12}
                  label={{ value: t('commandCenter.priorityAxisLabel'), position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8' }}
                />
                <YAxis
                  fontSize={11}
                  tickFormatter={(v: number) => formatNumber(v, locale)}
                  label={{ value: t('commandCenter.backlogAxisLabel'), angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8' }}
                />
                <Tooltip formatter={(v) => formatHours(Number(v), locale)} />
                <Bar dataKey="backlogHours" radius={[4, 4, 0, 0]}>
                  {backlog.map((b) => (
                    <Cell key={b.priority} fill={PRIORITY_CHART_COLOR[b.priority]} />
                  ))}
                  <LabelList dataKey="backlogHours" position="top" formatter={(v) => formatNumber(Number(v), locale)} fontSize={11} fill="#475569" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {backlogInsight && <p className="mt-1 text-xs text-slate-500">{backlogInsight}</p>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
