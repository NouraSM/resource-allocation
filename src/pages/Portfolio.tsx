import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, SlidersHorizontal } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { BUCKET_ORDER, deriveRequestRiskSeverities, portfolioBucket } from '@/engine/dashboardMetrics'
import type { PortfolioBucket } from '@/engine/dashboardMetrics'
import { priorityTone, riskTone, PROMINENT_PRIORITIES } from '@/lib/statusDisplay'
import { entityShortLabel } from '@/lib/entityDisplay'
import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import type { PriorityLevel, RequestStatus, RiskSeverity, WorkRequest } from '@/types/database'

const BUCKET_LABELS: Record<PortfolioBucket, string> = {
  new: 'New',
  ready_for_allocation: 'Ready for Allocation',
  allocated: 'Allocated',
  in_progress: 'In Progress',
  at_risk: 'At Risk',
  completed: 'Completed',
}

function nextAction(status: RequestStatus): { label: string; nextStatus: RequestStatus } | null {
  if (status === 'draft') return { label: 'Submit', nextStatus: 'submitted' }
  if (status === 'submitted' || status === 'under_review') return { label: 'Mark Ready for Allocation', nextStatus: 'ready_for_allocation' }
  if (status === 'allocated') return { label: 'Start Work', nextStatus: 'in_progress' }
  if (status === 'in_progress' || status === 'at_risk') return { label: 'Mark Completed', nextStatus: 'completed' }
  return null
}

export function Portfolio() {
  const { t, locale } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()

  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | 'all'>('all')
  const [riskFilter, setRiskFilter] = useState<RiskSeverity | 'all'>('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeSecondaryFilters = (priorityFilter !== 'all' ? 1 : 0) + (riskFilter !== 'all' ? 1 : 0)

  const canManage = profile?.role === 'admin' || profile?.role === 'resource_manager'

  const severityByRequest = useMemo(() => (data ? deriveRequestRiskSeverities(data.requests, data.risks) : new Map<string, RiskSeverity>()), [data])
  const entities = useMemo(() => Array.from(new Set((data?.requests ?? []).map((r) => r.requesting_entity))).sort(), [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.requests.filter((r) => {
      if (r.status === 'cancelled') return false
      if (priorityFilter !== 'all' && r.priority_level !== priorityFilter) return false
      if (entityFilter !== 'all' && r.requesting_entity !== entityFilter) return false
      if (riskFilter !== 'all' && severityByRequest.get(r.id) !== riskFilter) return false
      return true
    })
  }, [data, priorityFilter, entityFilter, riskFilter, severityByRequest])

  async function handleAdvance(request: WorkRequest, newStatus: RequestStatus) {
    if (!profile) return
    await supabase.from('work_requests').update({ status: newStatus }).eq('id', request.id)
    await logAudit({
      organizationId: profile.organization_id,
      userId: profile.id,
      action: 'request_status_changed',
      entityType: 'work_request',
      entityId: request.id,
      oldValue: { status: request.status },
      newValue: { status: newStatus },
    })
    refetch()
  }

  if (loading) return <AppShell title={t('portfolio.title')}><LoadingState /></AppShell>
  if (error) return <AppShell title={t('portfolio.title')}><ErrorState message={error} onRetry={refetch} /></AppShell>
  if (!data || data.requests.length === 0) return <AppShell title={t('portfolio.title')}><EmptyState title={t('requests.empty')} body={t('requests.emptyBody')} /></AppShell>

  const grouped = BUCKET_ORDER.reduce<Record<PortfolioBucket, WorkRequest[]>>((acc, bucket) => {
    acc[bucket] = filtered.filter((r) => portfolioBucket(r.status) === bucket)
    return acc
  }, { new: [], ready_for_allocation: [], allocated: [], in_progress: [], at_risk: [], completed: [] })

  const sortedByDeadline = [...filtered].sort((a, b) => new Date(a.requested_deadline).getTime() - new Date(b.requested_deadline).getTime())
  const minDate = sortedByDeadline.length ? new Date(sortedByDeadline[0].requested_deadline) : new Date()
  const maxDate = sortedByDeadline.length ? new Date(sortedByDeadline[sortedByDeadline.length - 1].requested_deadline) : new Date()
  const totalSpan = Math.max(1, maxDate.getTime() - minDate.getTime())

  return (
    <AppShell title={t('portfolio.title')}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="w-56">
            <option value="all">{t('requests.table.entity')}: {t('common.all')}</option>
            {entities.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <SlidersHorizontal className="h-4 w-4" />
            {activeSecondaryFilters > 0 ? `${t('common.filters')} (${activeSecondaryFilters})` : t('common.filters')}
          </Button>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-slate-100/50 p-3">
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as PriorityLevel | 'all')} className="w-40">
              <option value="all">{t('requests.table.priority')}: {t('common.all')}</option>
              {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
                <option key={p} value={p}>{t(`priority.${p}`)}</option>
              ))}
            </Select>
            <Select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskSeverity | 'all')} className="w-40">
              <option value="all">{t('requests.table.risk')}: {t('common.all')}</option>
              {(['critical', 'high', 'medium', 'low'] as const).map((r) => (
                <option key={r} value={r}>{t(`risk.${r}`)}</option>
              ))}
            </Select>
          </div>
        )}

        <Tabs defaultValue="table">
          <TabsList>
            <TabsTrigger value="table">{t('portfolio.table')}</TabsTrigger>
            <TabsTrigger value="timeline">{t('portfolio.timeline')}</TabsTrigger>
            <TabsTrigger value="kanban">{t('portfolio.kanban')}</TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="mt-3">
            <Card>
              <Table>
                <THead>
                  <TR>
                    <TH>{t('requests.table.request')}</TH>
                    <TH>{t('requests.table.entity')}</TH>
                    <TH>{t('requests.table.priority')}</TH>
                    <TH>{t('requests.table.deadline')}</TH>
                    <TH>{t('requests.table.risk')}</TH>
                    <TH>{t('common.status')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {filtered.map((r) => (
                    <TR key={r.id} className="cursor-pointer" onClick={() => navigate(`/requests/${r.id}`)}>
                      <TD className="font-medium text-slate-800">{r.title}</TD>
                      <TD className="whitespace-nowrap" title={r.requesting_entity}>{entityShortLabel(r.requesting_entity)}</TD>
                      <TD>
                        {PROMINENT_PRIORITIES.includes(r.priority_level) ? (
                          <Badge tone={priorityTone[r.priority_level]}>{t(`priority.${r.priority_level}`)}</Badge>
                        ) : (
                          <span className="text-sm text-slate-500">{t(`priority.${r.priority_level}`)}</span>
                        )}
                      </TD>
                      <TD>{formatDate(r.requested_deadline, locale)}</TD>
                      <TD>
                        {severityByRequest.get(r.id) ? (
                          <Badge tone={riskTone[severityByRequest.get(r.id)!]}>{t(`risk.${severityByRequest.get(r.id)!}`)}</Badge>
                        ) : (
                          <span className="text-sm text-slate-400">{t('risk.none')}</span>
                        )}
                      </TD>
                      <TD>{BUCKET_LABELS[portfolioBucket(r.status) ?? 'new']}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-3">
            <Card className="space-y-3 p-4">
              {sortedByDeadline.map((r) => {
                const pct = ((new Date(r.requested_deadline).getTime() - minDate.getTime()) / totalSpan) * 100
                return (
                  <button key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="block w-full text-start">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{r.title}</span>
                      <span className="text-slate-400">{formatDate(r.requested_deadline, locale)}</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-slate-100">
                      <div
                        className={`absolute top-0 h-2 w-2 rounded-full ${r.priority_level === 'critical' ? 'bg-status-critical' : r.priority_level === 'high' ? 'bg-status-attention' : 'bg-brand-500'}`}
                        style={{ left: `calc(${Math.min(98, Math.max(0, pct))}% - 4px)` }}
                      />
                    </div>
                  </button>
                )
              })}
              {sortedByDeadline.length === 0 && <p className="text-sm text-slate-400">{t('common.noData')}</p>}
            </Card>
          </TabsContent>

          <TabsContent value="kanban" className="mt-3">
            <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-6">
              {BUCKET_ORDER.map((bucket) => (
                <div key={bucket} className="min-w-[220px] rounded-lg bg-slate-100/60 p-2">
                  <p className="mb-2 px-1 text-xs font-semibold text-slate-500">
                    {BUCKET_LABELS[bucket]} ({grouped[bucket].length})
                  </p>
                  <div className="space-y-2">
                    {grouped[bucket].map((r) => {
                      const action = nextAction(r.status)
                      return (
                        <Card key={r.id} className="p-2.5">
                          <button onClick={() => navigate(`/requests/${r.id}`)} className="mb-1.5 block text-start text-xs font-medium text-slate-800 hover:underline">
                            {r.title}
                          </button>
                          <div className="mb-1.5 flex items-center gap-1.5">
                            {PROMINENT_PRIORITIES.includes(r.priority_level) ? (
                              <Badge tone={priorityTone[r.priority_level]}>{t(`priority.${r.priority_level}`)}</Badge>
                            ) : (
                              <span className="text-[11px] text-slate-500">{t(`priority.${r.priority_level}`)}</span>
                            )}
                            {severityByRequest.get(r.id) && <Badge tone={riskTone[severityByRequest.get(r.id)!]}>{t(`risk.${severityByRequest.get(r.id)!}`)}</Badge>}
                          </div>
                          <p className="mb-1.5 text-[10px] text-slate-400">{formatDate(r.requested_deadline, locale)}</p>
                          {canManage && bucket === 'ready_for_allocation' && (
                            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate(`/allocation/${r.id}`)}>
                              {t('requestDetail.generateAllocation')} <ArrowRight className="h-3 w-3 rtl:-scale-x-100" />
                            </Button>
                          )}
                          {canManage && action && bucket !== 'ready_for_allocation' && (
                            <Button size="sm" variant="secondary" className="w-full" onClick={() => handleAdvance(r, action.nextStatus)}>
                              {action.label}
                            </Button>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
