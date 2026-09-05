import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { deriveRequestRiskSeverities, isUnallocated } from '@/engine/dashboardMetrics'
import { priorityTone, riskTone, statusTone, PROMINENT_PRIORITIES } from '@/lib/statusDisplay'
import { entityShortLabel } from '@/lib/entityDisplay'
import { formatDate } from '@/lib/utils'
import type { PriorityLevel, RequestStatus, RiskSeverity } from '@/types/database'

// Work Requests is a passive overview — only At Risk needs a pill here.
// (Allocation Workspace treats Ready for Allocation as prominent too, since
// there it directly implies the next action; that's a page-level choice.)
const PROMINENT_STATUSES: readonly RequestStatus[] = ['at_risk']

export function WorkRequests() {
  const { t, locale } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()

  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all')
  const [riskFilter, setRiskFilter] = useState<RiskSeverity | 'all'>('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [unallocatedOnly, setUnallocatedOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const canCreate = profile?.role === 'admin' || profile?.role === 'resource_manager'
  const activeSecondaryFilters = (priorityFilter !== 'all' ? 1 : 0) + (riskFilter !== 'all' ? 1 : 0) + (unallocatedOnly ? 1 : 0)

  const severityByRequest = useMemo(
    () => (data ? deriveRequestRiskSeverities(data.requests, data.risks) : new Map<string, RiskSeverity>()),
    [data],
  )

  const entities = useMemo(() => Array.from(new Set((data?.requests ?? []).map((r) => r.requesting_entity))).sort(), [data])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.requests.filter((r) => {
      if (priorityFilter !== 'all' && r.priority_level !== priorityFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (entityFilter !== 'all' && r.requesting_entity !== entityFilter) return false
      if (riskFilter !== 'all' && severityByRequest.get(r.id) !== riskFilter) return false
      if (unallocatedOnly && !isUnallocated(r, data.assignments)) return false
      if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.request_number.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [data, priorityFilter, statusFilter, entityFilter, riskFilter, unallocatedOnly, search, severityByRequest])

  return (
    <AppShell title={t('requests.title')} subtitle={t('requests.subtitle')}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'all')} className="w-48">
            <option value="all">{t('requests.table.status')}: {t('common.all')}</option>
            {(['draft', 'submitted', 'under_review', 'ready_for_allocation', 'allocated', 'in_progress', 'at_risk', 'completed', 'cancelled'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>
          <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="w-56">
            <option value="all">{t('requests.table.entity')}: {t('common.all')}</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <SlidersHorizontal className="h-4 w-4" />
            {activeSecondaryFilters > 0 ? `${t('common.filters')} (${activeSecondaryFilters})` : t('common.filters')}
          </Button>
          <div className="flex-1" />
          {canCreate && (
            <Button onClick={() => navigate('/requests/new')}>
              <Plus className="h-4 w-4" />
              {t('requests.newRequest')}
            </Button>
          )}
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-slate-100/50 p-3">
            <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as PriorityLevel | 'all')} className="w-40">
              <option value="all">{t('requests.table.priority')}: {t('common.all')}</option>
              {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
                <option key={p} value={p}>
                  {t(`priority.${p}`)}
                </option>
              ))}
            </Select>
            <Select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskSeverity | 'all')} className="w-40">
              <option value="all">{t('requests.table.risk')}: {t('common.all')}</option>
              {(['critical', 'high', 'medium', 'low'] as const).map((r) => (
                <option key={r} value={r}>
                  {t(`risk.${r}`)}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={unallocatedOnly} onChange={(e) => setUnallocatedOnly(e.target.checked)} />
              {t('requests.unallocatedOnly')}
            </label>
          </div>
        )}

        {loading && <LoadingState />}
        {error && <ErrorState message={error} onRetry={refetch} />}
        {!loading && !error && data && data.requests.length === 0 && (
          <EmptyState
            title={t('requests.empty')}
            body={t('requests.emptyBody')}
            action={canCreate ? <Button onClick={() => navigate('/requests/new')}>{t('requests.newRequest')}</Button> : undefined}
          />
        )}
        {!loading && !error && data && data.requests.length > 0 && (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>{t('requests.table.request')}</TH>
                  <TH>{t('requests.table.entity')}</TH>
                  <TH>{t('requests.table.priority')}</TH>
                  <TH>{t('requests.table.deadline')}</TH>
                  <TH>{t('requests.table.effort')}</TH>
                  <TH>{t('requests.table.allocation')}</TH>
                  <TH>{t('requests.table.risk')}</TH>
                  <TH>{t('requests.table.status')}</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((r) => {
                  const severity = severityByRequest.get(r.id)
                  const assignedCount = data.assignments.filter((a) => a.request_id === r.id && a.status !== 'cancelled').length
                  return (
                    <TR key={r.id} className="cursor-pointer" onClick={() => navigate(`/requests/${r.id}`)}>
                      <TD>
                        <Link
                          to={`/requests/${r.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-slate-800 hover:text-brand-700 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                        >
                          {r.title}
                        </Link>
                        <p className="text-xs text-slate-400">{r.request_number}</p>
                      </TD>
                      <TD className="whitespace-nowrap" title={r.requesting_entity}>
                        {entityShortLabel(r.requesting_entity)}
                      </TD>
                      <TD>
                        {PROMINENT_PRIORITIES.includes(r.priority_level) ? (
                          <Badge tone={priorityTone[r.priority_level]}>{t(`priority.${r.priority_level}`)}</Badge>
                        ) : (
                          <span className="text-sm text-slate-500">{t(`priority.${r.priority_level}`)}</span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">{formatDate(r.requested_deadline, locale)}</TD>
                      <TD className="whitespace-nowrap">
                        {r.estimated_effort_hours} {t('common.hours')}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {assignedCount === 0 ? (
                          <Badge tone="attention">{t('allocationQueue.unallocated')}</Badge>
                        ) : (
                          <span className="text-sm text-slate-500">{`${assignedCount} ${t('allocationQueue.assignedLabel')}`}</span>
                        )}
                      </TD>
                      <TD>
                        {severity ? (
                          <Badge tone={riskTone[severity]}>{t(`risk.${severity}`)}</Badge>
                        ) : (
                          <span className="text-sm text-slate-400">{t('risk.none')}</span>
                        )}
                      </TD>
                      <TD>
                        {PROMINENT_STATUSES.includes(r.status) ? (
                          <Badge tone={statusTone[r.status]}>{t(`status.${r.status}`)}</Badge>
                        ) : (
                          <span className="text-sm text-slate-500">{t(`status.${r.status}`)}</span>
                        )}
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
            {filtered.length === 0 && <p className="p-6 text-center text-sm text-slate-400">{t('common.noData')}</p>}
          </Card>
        )}
      </div>
    </AppShell>
  )
}
