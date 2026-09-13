import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { HeroMetric, StatInline } from '@/components/dashboard/KpiCard'
import { calculateCapabilityPressure } from '@/engine/capacityOutlook'
import { computeResourceUtilizations, departmentCapacity } from '@/engine/dashboardMetrics'
import { utilizationTone } from '@/lib/statusDisplay'

const HORIZONS = [
  { days: 28, key: 'horizon4' as const },
  { days: 56, key: 'horizon8' as const },
  { days: 84, key: 'horizon12' as const },
]

// Bands with real pressure — everything else (healthy/underutilized) reads as calm.
const PRESSURE_STATUSES = new Set(['high', 'overloaded', 'critical'])
const CRITICAL_STATUSES = new Set(['overloaded', 'critical'])

export function CapacityOutlook() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()
  const [horizonDays, setHorizonDays] = useState(56)

  const today = useMemo(() => new Date(), [])

  const computed = useMemo(() => {
    if (!data) return null
    const horizonEnd = new Date(today)
    horizonEnd.setDate(horizonEnd.getDate() + horizonDays)

    const rows = calculateCapabilityPressure({
      requests: data.requests,
      requestSkills: data.requestSkills,
      skills: data.skills,
      resources: data.engineResources,
      assignments: data.engineAssignments,
      availability: data.engineAvailability,
      org: data.orgSettings,
      today,
      horizonDays,
    }).filter((r) => r.requestCount > 0)

    // Org-wide available capacity is computed independently (not summed
    // from the per-capability rows above, which can overlap when a
    // resource holds more than one capability) so this headline figure is
    // never double-counted.
    const orgUtilizations = computeResourceUtilizations(data.engineResources, data.resources, data.orgSettings, data.engineAssignments, data.engineAvailability, today, horizonEnd)
    const totalAvailableCapacity = orgUtilizations.reduce((sum, r) => sum + Math.max(0, r.availableCapacityHours), 0)
    const totalDemand = rows.reduce((sum, r) => sum + r.estimatedDemandHours, 0)
    const pressureCount = rows.filter((r) => PRESSURE_STATUSES.has(r.status)).length
    const criticalCount = rows.filter((r) => CRITICAL_STATUSES.has(r.status)).length

    const deptRows = departmentCapacity(orgUtilizations)

    return { rows, totalAvailableCapacity, totalDemand, pressureCount, criticalCount, deptRows }
  }, [data, today, horizonDays])

  if (loading) return <AppShell title={t('capacityOutlook.title')} subtitle={t('capacityOutlook.subtitle')}><LoadingState /></AppShell>
  if (error) return <AppShell title={t('capacityOutlook.title')} subtitle={t('capacityOutlook.subtitle')}><ErrorState message={error} onRetry={refetch} /></AppShell>
  if (!data || !computed) return <AppShell title={t('capacityOutlook.title')}><EmptyState title={t('requests.empty')} body={t('requests.emptyBody')} /></AppShell>

  const { rows, totalAvailableCapacity, totalDemand, pressureCount, criticalCount, deptRows } = computed

  return (
    <AppShell title={t('capacityOutlook.title')} subtitle={t('capacityOutlook.subtitle')}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={String(horizonDays)} onValueChange={(v) => setHorizonDays(Number(v))}>
            <TabsList>
              {HORIZONS.map((h) => (
                <TabsTrigger key={h.days} value={String(h.days)}>
                  {t(`capacityOutlook.${h.key}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <InfoTooltip
            text={[t('capacityOutlook.methodologyDemand'), t('capacityOutlook.methodologyCapacity'), t('capacityOutlook.methodologyHorizon')].join(' ')}
          />
        </div>

        <section className="flex flex-wrap gap-x-14 gap-y-6">
          <HeroMetric label={t('capacityOutlook.capacityPressure')} value={pressureCount} tone={pressureCount > 0 ? 'attention' : 'calm'} size="lg" />
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <HeroMetric label={t('capacityOutlook.criticalGaps')} value={criticalCount} tone={criticalCount > 0 ? 'critical' : 'calm'} size="sm" />
            <HeroMetric label={t('capacityOutlook.upcomingDemand')} value={`${Math.round(totalDemand)}${t('capacityOutlook.estHours')}`} tone="calm" size="sm" />
            <HeroMetric label={t('capacityOutlook.availableCapacity')} value={`${Math.round(totalAvailableCapacity)}${t('common.hours')}`} tone="calm" size="sm" />
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{t('capacityOutlook.tableCapability')}</CardTitle>
          </CardHeader>
          {rows.length === 0 ? (
            <CardContent>
              <p className="text-sm text-slate-500">{t('capacityOutlook.noPressure')}</p>
            </CardContent>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t('capacityOutlook.tableCapability')}</TH>
                  <TH>{t('capacityOutlook.tableRequests')}</TH>
                  <TH>{t('capacityOutlook.tableDemand')}</TH>
                  <TH>{t('capacityOutlook.tableCapacity')}</TH>
                  <TH>{t('capacityOutlook.tableQualified')}</TH>
                  <TH>{t('capacityOutlook.tableStatus')}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.skillId}>
                    <TD className="font-medium text-slate-800">{row.skillName}</TD>
                    <TD>{row.requestCount}</TD>
                    <TD>{Math.round(row.estimatedDemandHours)}{t('capacityOutlook.estHours')}</TD>
                    <TD className={row.availableCapacityHours < 0 ? 'font-semibold text-status-critical' : ''}>{Math.round(row.availableCapacityHours)}{t('common.hours')}</TD>
                    <TD>
                      {row.qualifiedResourceCount}
                      {row.qualifiedResourceCount > 0 && (
                        <span className="ms-1 text-xs text-slate-400">
                          ({row.seniorQualifiedResourceCount} {t('capacityOutlook.tableSenior')})
                        </span>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={utilizationTone[row.status]}>{t(`utilization.${row.status}`)}</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader className="items-center gap-2">
            <CardTitle>{t('capacityOutlook.departmentSupply')}</CardTitle>
            <InfoTooltip text={t('capacityOutlook.departmentSupplyHint')} />
          </CardHeader>
          <CardContent className="space-y-2">
            {deptRows.map((d) => (
              <button
                key={d.department}
                onClick={() => navigate('/resources')}
                className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] px-2 py-1.5 text-start transition-colors hover:bg-slate-50"
              >
                <span className="text-sm text-slate-700">{d.department}</span>
                <span className="flex items-center gap-3">
                  <StatInline label={t('capacityOutlook.headcount')} value={d.headcount} />
                  <StatInline label={t('commandCenter.teamUtilization')} value={`${Math.round(d.avgUtilization * 100)}%`} emphasize />
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
