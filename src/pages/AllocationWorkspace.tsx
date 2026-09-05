import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useOrgData } from '@/hooks/useOrgData'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buildTeamScenarios } from '@/engine/teamBuilder'
import { calculateCapacity, utilizationStatus } from '@/engine/capacity'
import type { TeamMember, TeamScenario } from '@/engine/teamBuilder'
import { priorityTone } from '@/lib/statusDisplay'
import { formatDate } from '@/lib/utils'
import { deriveScenarioBadges } from '@/lib/allocationDisplay'
import { ScenarioCard } from '@/components/allocation/ScenarioCard'
import { ScenarioCompareTable } from '@/components/allocation/ScenarioCompareTable'
import { EligibleRequestsPanel } from '@/components/allocation/EligibleRequestsPanel'
import { NoScenariosExplainer } from '@/components/allocation/NoScenariosExplainer'
import { AllocationStepper } from '@/components/allocation/AllocationStepper'
import type { AllocationStep } from '@/components/allocation/AllocationStepper'
import { ApprovalDialog } from '@/components/allocation/ApprovalDialog'
import type { ApprovalAction, ApprovalReasonCode } from '@/components/allocation/ApprovalDialog'
import { ModifyTeamDialog } from '@/components/allocation/ModifyTeamDialog'
import { WhatIfDialog } from '@/components/allocation/WhatIfDialog'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export function AllocationWorkspace() {
  const { requestId } = useParams<{ requestId: string }>()
  const { t, locale } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()

  const [selectedRequestId, setSelectedRequestId] = useState(requestId ?? '')
  const [activeScenario, setActiveScenario] = useState<TeamScenario | null>(null)
  const [dialogAction, setDialogAction] = useState<ApprovalAction | null>(null)
  const [modifyOpen, setModifyOpen] = useState(false)
  const [whatIfOpen, setWhatIfOpen] = useState(false)
  const [persisted, setPersisted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelectedRequestId(requestId ?? '')
  }, [requestId])

  const today = useMemo(() => new Date(), [])

  const request = useMemo(() => data?.requests.find((r) => r.id === selectedRequestId), [data, selectedRequestId])
  const requiredSkills = useMemo(
    () => (data && request ? data.requestSkills.filter((rs) => rs.request_id === request.id).map((rs) => ({ skillId: rs.skill_id, requiredLevel: rs.required_level, importanceWeight: rs.importance_weight, mandatory: rs.mandatory })) : []),
    [data, request],
  )

  const builderResult = useMemo(() => {
    if (!data || !request) return null
    return buildTeamScenarios({
      request: {
        id: request.id,
        estimatedEffortHours: request.estimated_effort_hours,
        requestedDeadline: request.requested_deadline,
        priorityLevel: request.priority_level,
        complexity: request.complexity,
        requestingEntitySector: request.request_type,
        requestType: request.request_type,
      },
      requiredSkills,
      resources: data.engineResources,
      assignments: data.engineAssignments,
      availability: data.engineAvailability,
      historicalProjects: data.engineHistoricalProjects,
      org: data.orgSettings,
      today,
    })
  }, [data, request, requiredSkills, today])

  // Persist the generated recommendations once per request visit (audit trail /
  // schema fulfillment) without spamming inserts on every re-render.
  useEffect(() => {
    setPersisted(false)
  }, [selectedRequestId])

  useEffect(() => {
    if (!builderResult || persisted || !profile || !request) return
    setPersisted(true)
    supabase
      .from('allocation_recommendations')
      .insert(
        builderResult.scenarios.map((s) => ({
          organization_id: profile.organization_id,
          request_id: request.id,
          scenario_number: s.scenarioNumber,
          team_score: s.teamScore,
          skill_coverage_score: s.skillCoverageScore,
          capacity_score: s.capacityScore,
          workload_balance_score: s.loadBalanceScore,
          seniority_score: s.seniorityMixScore,
          deadline_feasibility_score: s.deadlineFeasibilityScore,
          risk_score: s.deliveryRisk.score,
          explanation: s.reasons.join(' '),
          recommendation_data: s as unknown as Record<string, unknown>,
        })),
      )
      .then(() => undefined)

    if (request.priority_level === 'critical' || request.priority_level === 'high') {
      supabase
        .from('notifications')
        .insert({
          organization_id: profile.organization_id,
          user_id: null,
          notification_type: 'allocation_approval_required',
          severity: 'info',
          title: `${request.title} is ready for allocation review`,
          message: 'Allocation scenarios have been generated and are waiting for approval.',
          entity_type: 'work_request',
          entity_id: request.id,
        })
        .then(() => undefined)
    }
  }, [builderResult, persisted, profile, request])

  async function createAssignments(members: TeamMember[], status: 'active' = 'active') {
    if (!profile || !request || !data) return
    const rows = members.map((m) => ({
      organization_id: profile.organization_id,
      request_id: request.id,
      resource_id: m.resourceId,
      assignment_role: m.jobRole,
      allocation_percentage: m.allocationPercentage,
      allocated_hours: m.allocatedHours,
      start_date: today.toISOString().slice(0, 10),
      end_date: request.requested_deadline,
      status,
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    }))
    await supabase.from('assignments').insert(rows)
    await supabase.from('work_requests').update({ status: 'allocated' }).eq('id', request.id)

    // Same capacity engine the rest of the app uses — no duplicated formula,
    // just checking the post-approval result against the org's threshold.
    const projectedAssignments = [
      ...data.engineAssignments,
      ...members.map((m) => ({
        id: `new-${m.resourceId}`,
        resourceId: m.resourceId,
        requestId: request.id,
        allocationPercentage: m.allocationPercentage,
        allocatedHours: m.allocatedHours,
        startDate: today.toISOString().slice(0, 10),
        endDate: request.requested_deadline,
        status: 'active' as const,
      })),
    ]
    const fourWeeksOut = new Date(today)
    fourWeeksOut.setDate(fourWeeksOut.getDate() + 28)
    for (const m of members) {
      const resource = data.engineResources.find((r) => r.id === m.resourceId)
      if (!resource) continue
      const capacity = calculateCapacity({ resource, org: data.orgSettings, assignments: projectedAssignments, availability: data.engineAvailability, rangeStart: today, rangeEnd: fourWeeksOut })
      if (utilizationStatus(capacity.utilization, data.orgSettings) === 'overloaded' || utilizationStatus(capacity.utilization, data.orgSettings) === 'critical') {
        await supabase.from('notifications').insert({
          organization_id: profile.organization_id,
          user_id: null,
          notification_type: 'resource_overloaded',
          severity: 'critical',
          title: `${m.fullName} is overloaded`,
          message: `Approving this allocation puts ${m.fullName} at ${Math.round(capacity.utilization * 100)}% utilization.`,
          entity_type: 'resource',
          entity_id: m.resourceId,
        })
      }
    }
  }

  async function handleConfirm(reasonCode: ApprovalReasonCode | null, note: string) {
    if (!profile || !request || !activeScenario) return
    setSaving(true)
    const action = dialogAction

    if (action === 'reject') {
      await supabase.from('work_requests').update({ status: 'under_review' }).eq('id', request.id)
      await logAudit({
        organizationId: profile.organization_id,
        userId: profile.id,
        action: 'allocation_rejected',
        entityType: 'work_request',
        entityId: request.id,
        reason: `${reasonCode}: ${note}`,
      })
    } else {
      await createAssignments(activeScenario.members)
      await logAudit({
        organizationId: profile.organization_id,
        userId: profile.id,
        action: action === 'modify' ? 'allocation_modified' : 'allocation_approved',
        entityType: 'work_request',
        entityId: request.id,
        newValue: { members: activeScenario.members, teamScore: activeScenario.teamScore },
        reason: action === 'modify' ? `${reasonCode}: ${note}` : note || null,
      })
    }

    setSaving(false)
    setDialogAction(null)
    refetch()
    navigate(`/requests/${request.id}`)
  }

  const canManage = profile?.role === 'admin' || profile?.role === 'resource_manager'

  if (loading) return <AppShell title={t('allocation.title')}><LoadingState /></AppShell>
  if (error) return <AppShell title={t('allocation.title')}><ErrorState message={error} onRetry={refetch} /></AppShell>
  if (!data) return <AppShell title={t('allocation.title')}><LoadingState /></AppShell>

  if (!request) {
    return (
      <AppShell title={t('allocation.title')}>
        <AllocationStepper current="request" />
        <EligibleRequestsPanel data={data} onSelect={setSelectedRequestId} />
      </AppShell>
    )
  }

  const recommendedScenario = builderResult?.scenarios[0]?.scenarioNumber ?? 1
  const badgesByScenario = builderResult ? deriveScenarioBadges(builderResult.scenarios, recommendedScenario) : {}
  const blocked = !builderResult || builderResult.scenarios.every((s) => s.members.length === 0)
  const currentStep: AllocationStep = blocked ? 'scenarios' : dialogAction || saving ? 'approve' : 'compare'

  return (
    <AppShell title={t('allocation.title')} subtitle={request.title}>
      <div className="mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/allocation')}>
          <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
          {t('allocation.backToQueue')}
        </Button>
      </div>
      <AllocationStepper current={currentStep} />
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="h-fit lg:col-span-1">
          <CardHeader>
            <CardTitle>{t('allocation.requestSummary')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Badge tone={priorityTone[request.priority_level]}>{t(`priority.${request.priority_level}`)}</Badge>
            <p className="text-sm font-medium text-slate-800">{request.title}</p>
            <div className="grid grid-cols-2 gap-2 text-slate-500">
              <div>
                <p className="text-slate-400">{t('requestDetail.deadline')}</p>
                <p className="text-slate-700">{formatDate(request.requested_deadline, locale)}</p>
              </div>
              <div>
                <p className="text-slate-400">{t('requestDetail.effort')}</p>
                <p className="text-slate-700">{request.estimated_effort_hours}h</p>
              </div>
              <div>
                <p className="text-slate-400">{t('newRequest.complexity')}</p>
                <p className="capitalize text-slate-700">{request.complexity.replace('_', ' ')}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-slate-400">{t('requestDetail.requiredSkills')}</p>
              <div className="flex flex-wrap gap-1">
                {requiredSkills.map((rs) => {
                  const skill = data.skills.find((s) => s.id === rs.skillId)
                  return (
                    <span key={rs.skillId} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                      {skill?.name} L{rs.requiredLevel}
                    </span>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          {blocked ? (
            <NoScenariosExplainer
              notFeasible={builderResult?.notFeasible ?? []}
              evaluatedCount={builderResult?.candidates.length ?? 0}
              onViewRequest={() => navigate(`/requests/${request.id}`)}
              onViewResources={() => navigate('/resources')}
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {builderResult.scenarios.map((s) => (
                  <ScenarioCard
                    key={s.scenarioNumber}
                    scenario={s}
                    badges={badgesByScenario[s.scenarioNumber] ?? []}
                    canManage={!!canManage}
                    onApprove={() => {
                      setActiveScenario(s)
                      setDialogAction('approve')
                    }}
                    onModify={() => {
                      setActiveScenario(s)
                      setModifyOpen(true)
                    }}
                    onWhatIf={() => {
                      setActiveScenario(s)
                      setWhatIfOpen(true)
                    }}
                  />
                ))}
              </div>
              <ScenarioCompareTable scenarios={builderResult.scenarios} badgesByScenario={badgesByScenario} />

              {builderResult.notFeasible.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('allocation.notFeasible')}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2">
                    {builderResult.notFeasible.map((c) => (
                      <div key={c.resource.id} className="rounded-md border border-slate-100 p-2 text-xs">
                        <p className="font-medium text-slate-700">{c.resource.fullName}</p>
                        <p className="text-slate-500">{c.infeasibleReasons.join(' ')}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <ApprovalDialog
        open={dialogAction !== null}
        action={dialogAction ?? 'approve'}
        onClose={() => setDialogAction(null)}
        onConfirm={handleConfirm}
      />

      {activeScenario && (
        <ModifyTeamDialog
          open={modifyOpen}
          members={activeScenario.members}
          candidates={builderResult?.candidates.filter((c) => c.feasible) ?? []}
          onClose={() => setModifyOpen(false)}
          onSave={(members) => {
            setActiveScenario({ ...activeScenario, members })
            setModifyOpen(false)
            setDialogAction('modify')
          }}
        />
      )}

      <WhatIfDialog
        open={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        scenario={activeScenario}
        alternativeScenario={builderResult?.scenarios.find((s) => s.scenarioNumber !== activeScenario?.scenarioNumber) ?? null}
        resources={data.engineResources}
        assignments={data.engineAssignments}
        org={data.orgSettings}
        requestId={request.id}
      />

      {saving && <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60"><LoadingState /></div>}
    </AppShell>
  )
}
