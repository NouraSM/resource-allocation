import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Workflow } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { priorityBreakdown } from '@/engine/priority'
import { deriveRequestRiskSeverities } from '@/engine/dashboardMetrics'
import { priorityTone, riskTone, statusTone } from '@/lib/statusDisplay'
import { formatDate, formatNumber } from '@/lib/utils'
import { UrgencyOverrideDialog } from '@/components/requests/UrgencyOverrideDialog'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export function RequestDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, locale } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()
  const [overrideOpen, setOverrideOpen] = useState(false)

  const canManage = profile?.role === 'admin' || profile?.role === 'resource_manager'

  const request = useMemo(() => data?.requests.find((r) => r.id === id), [data, id])
  const skills = useMemo(() => (data && request ? data.requestSkills.filter((rs) => rs.request_id === request.id) : []), [data, request])
  const assignments = useMemo(() => (data && request ? data.assignments.filter((a) => a.request_id === request.id && a.status !== 'cancelled') : []), [data, request])
  const deliverables = useMemo(() => (data && request ? data.deliverables.filter((d) => d.request_id === request.id) : []), [data, request])
  const risks = useMemo(() => (data && request ? data.risks.filter((r) => r.request_id === request.id) : []), [data, request])
  const severity = useMemo(() => (data && request ? deriveRequestRiskSeverities(data.requests, data.risks).get(request.id) : undefined), [data, request])

  if (loading) return (
    <AppShell>
      <LoadingState />
    </AppShell>
  )
  if (error) return (
    <AppShell>
      <ErrorState message={error} onRetry={refetch} />
    </AppShell>
  )
  if (!request) {
    return (
      <AppShell>
        <EmptyState title="Request not found" body="It may have been removed, or you may not have access to it." />
      </AppShell>
    )
  }

  const breakdown = priorityBreakdown({
    urgencyScore: request.urgency_override ?? request.urgency_score,
    strategicImportance: request.strategic_importance,
    executiveSponsorship: request.executive_sponsorship,
    regulatoryImportance: request.regulatory_importance,
    publicImpact: request.public_impact,
    dependencyImpact: request.dependency_impact,
  })

  async function handleOverride(value: number, reason: string) {
    if (!request || !profile) return
    const oldValue = { urgency_override: request.urgency_override, urgency_score: request.urgency_score }
    const { error: updateError } = await supabase
      .from('work_requests')
      .update({ urgency_override: value, urgency_override_reason: reason })
      .eq('id', request.id)
    if (!updateError) {
      await logAudit({
        organizationId: profile.organization_id,
        userId: profile.id,
        action: 'urgency_override',
        entityType: 'work_request',
        entityId: request.id,
        oldValue,
        newValue: { urgency_override: value },
        reason,
      })
      refetch()
    }
    setOverrideOpen(false)
  }

  return (
    <AppShell title={request.title} subtitle={request.request_number}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('requestDetail.overview')}</CardTitle>
              <div className="flex gap-2">
                <Badge tone={priorityTone[request.priority_level]}>{t(`priority.${request.priority_level}`)}</Badge>
                <Badge tone={statusTone[request.status]}>{t(`status.${request.status}`)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 sm:grid-cols-3">
                <div>
                  <p className="font-medium text-slate-400">{t('requests.table.entity')}</p>
                  <p className="text-slate-700">{request.requesting_entity}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-400">{t('newRequest.requesterLabel')}</p>
                  <p className="text-slate-700">{request.requester_name}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-400">{t('newRequest.requestType')}</p>
                  <p className="text-slate-700">{request.request_type ?? '—'}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-400">{t('requestDetail.effort')}</p>
                  <p className="text-slate-700">{request.estimated_effort_hours} {t('common.hours')}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-400">{t('requestDetail.deadline')}</p>
                  <p className="text-slate-700">{formatDate(request.requested_deadline, locale)}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-400">{t('newRequest.complexity')}</p>
                  <p className="capitalize text-slate-700">{request.complexity.replace('_', ' ')}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-400">{t('requestDetail.description')}</p>
                <p className="whitespace-pre-wrap text-slate-700">{request.description || '—'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('requestDetail.requiredSkills')}</CardTitle>
            </CardHeader>
            <CardContent>
              {skills.length === 0 ? (
                <p className="text-sm text-slate-400">{t('common.noData')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skills.map((rs) => {
                    const skill = data?.skills.find((s) => s.id === rs.skill_id)
                    return (
                      <Badge key={rs.id} tone={rs.mandatory ? 'critical' : 'neutral'}>
                        {skill?.name ?? rs.skill_id} · L{rs.required_level} {rs.mandatory && `(${t('common.required')})`}
                      </Badge>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('requestDetail.currentAllocation')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {assignments.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">{t('requestDetail.noAssignments')}</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>{t('allocation.member')}</TH>
                      <TH>{t('allocation.memberRole')}</TH>
                      <TH>{t('allocation.allocationPct')}</TH>
                      <TH>{t('allocation.hours')}</TH>
                      <TH>{t('common.status')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {assignments.map((a) => {
                      const resource = data?.resources.find((r) => r.id === a.resource_id)
                      return (
                        <TR key={a.id} className="cursor-pointer" onClick={() => navigate(`/resources/${a.resource_id}`)}>
                          <TD>{resource?.full_name ?? a.resource_id}</TD>
                          <TD className="capitalize">{a.assignment_role}</TD>
                          <TD>{formatNumber(a.allocation_percentage, locale)}%</TD>
                          <TD>{a.allocated_hours}</TD>
                          <TD>
                            <Badge tone="info">{a.status}</Badge>
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('requestDetail.deliverables')}</CardTitle>
            </CardHeader>
            <CardContent>
              {deliverables.length === 0 ? (
                <p className="text-sm text-slate-400">{t('common.noData')}</p>
              ) : (
                <ul className="space-y-2">
                  {deliverables.map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{d.title}</span>
                      <span className="text-xs text-slate-400">{d.due_date ? formatDate(d.due_date, locale) : '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('requestDetail.priorityScore')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-brand-700">{formatNumber(request.priority_score, locale, 1)}</p>
              <p className="mb-3 text-xs text-slate-400">{t('requestDetail.priorityExplanation')}</p>
              <ul className="space-y-1.5">
                {breakdown.map((b) => (
                  <li key={b.key} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {b.label} ({Math.round(b.weight * 100)}%)
                    </span>
                    <span className="font-medium text-slate-700">{formatNumber(b.value, locale)}</span>
                  </li>
                ))}
              </ul>
              {request.urgency_override != null && (
                <p className="mt-2 rounded bg-status-attention-bg p-2 text-[11px] text-status-attention">
                  Urgency overridden to {request.urgency_override}: {request.urgency_override_reason}
                </p>
              )}
              {canManage && (
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setOverrideOpen(true)}>
                  Override Urgency
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('requestDetail.risk')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {severity && (
                <Badge tone={riskTone[severity]} className="mb-1">
                  {t(`risk.${severity}`)}
                </Badge>
              )}
              {risks.length === 0 ? (
                <p className="text-sm text-slate-400">{t('common.noData')}</p>
              ) : (
                risks.map((r) => (
                  <div key={r.id} className="rounded border border-slate-100 p-2 text-xs">
                    <p className="font-medium capitalize text-slate-700">{r.risk_type.replace('_', ' ')}</p>
                    <p className="text-slate-500">{r.description}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {canManage && (
            <Button className="w-full" onClick={() => navigate(`/allocation/${request.id}`)}>
              <Workflow className="h-4 w-4" />
              {t('requestDetail.generateAllocation')}
              <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </Button>
          )}
        </div>
      </div>

      <UrgencyOverrideDialog
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        currentScore={request.urgency_score}
        onSubmit={handleOverride}
      />
    </AppShell>
  )
}
