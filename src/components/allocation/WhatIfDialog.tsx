import { useEffect, useMemo, useRef } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import type { TeamScenario } from '@/engine/teamBuilder'
import type { EngineAssignment, EngineResource, OrgSettings } from '@/engine/types'
import { applyWhatIfChanges, compareUtilization, recommendationFromComparisons } from '@/engine/scenario'
import { utilizationTone } from '@/lib/statusDisplay'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export function WhatIfDialog({
  open,
  onClose,
  scenario,
  alternativeScenario,
  resources,
  assignments,
  org,
  requestId,
}: {
  open: boolean
  onClose: () => void
  scenario: TeamScenario | null
  alternativeScenario: TeamScenario | null
  resources: EngineResource[]
  assignments: EngineAssignment[]
  org: OrgSettings
  requestId: string
}) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const persistedFor = useRef<string | null>(null)
  const today = useMemo(() => new Date(), [])
  const rangeEnd = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 60)
    return d
  }, [today])

  const comparisons = useMemo(() => {
    if (!scenario) return []
    const changes = scenario.members.map((m, i) => ({
      kind: 'assign_resource' as const,
      assignment: {
        id: `whatif-${i}`,
        resourceId: m.resourceId,
        requestId,
        allocationPercentage: m.allocationPercentage,
        allocatedHours: m.allocatedHours,
        startDate: today.toISOString().slice(0, 10),
        endDate: rangeEnd.toISOString().slice(0, 10),
        status: 'proposed' as const,
      },
    }))
    const after = applyWhatIfChanges({ assignments, availability: [], changes })
    return scenario.members
      .map((m) => {
        const resource = resources.find((r) => r.id === m.resourceId)
        if (!resource) return null
        return { member: m, ...compareUtilization(resource, org, { assignments, availability: [] }, after, today, rangeEnd) }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
  }, [scenario, resources, assignments, org, today, rangeEnd, requestId])

  const recommendation = useMemo(() => recommendationFromComparisons(comparisons, []), [comparisons])
  // Status is already computed against the org's real overload threshold
  // (utilizationStatus() in the engine), so this stays in sync with whatever
  // threshold is configured — unlike a raw ">100%" check.
  const anyCritical = comparisons.some((c) => c.after.status === 'critical')
  const anyOverThreshold = comparisons.some((c) => c.after.status === 'overloaded' || c.after.status === 'critical')
  const overThresholdOnly = anyOverThreshold && !anyCritical

  // Persist the simulation as a scenario_run (never touches live assignments)
  // so what-if exploration leaves an audit trail, once per scenario per open.
  useEffect(() => {
    if (!open || !profile || !scenario || comparisons.length === 0) return
    const key = `${scenario.scenarioNumber}-${requestId}`
    if (persistedFor.current === key) return
    persistedFor.current = key
    supabase
      .from('scenario_runs')
      .insert({
        organization_id: profile.organization_id,
        created_by: profile.id,
        request_id: requestId,
        scenario_name: `What-if: ${scenario.strategyLabel}`,
        scenario_data: { scenarioNumber: scenario.scenarioNumber, members: scenario.members } as unknown as Record<string, unknown>,
        scenario_result: { comparisons, recommendation } as unknown as Record<string, unknown>,
      })
      .then(() => undefined)
  }, [open, profile, scenario, comparisons, recommendation, requestId])

  return (
    <Dialog open={open} onClose={onClose} title={t('whatif.title')} className="max-w-2xl">
      <div className="space-y-4">
        <div className="space-y-2">
          {comparisons.map((c) => (
            <div key={c.member.resourceId} className="rounded-md border border-slate-100 p-3">
              <p className="mb-1 text-sm font-medium text-slate-800">{c.member.fullName}</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">
                  {t('whatif.before')}: <span className="font-semibold text-slate-700">{c.before.utilization}%</span>
                </span>
                <span>→</span>
                <span className="text-slate-500">
                  {t('whatif.after')}:{' '}
                  <span className={`font-semibold ${c.after.utilization > 100 ? 'text-status-critical' : 'text-slate-700'}`}>{c.after.utilization}%</span>
                </span>
                <Badge tone={utilizationTone[c.after.status]}>{t(`utilization.${c.after.status}`)}</Badge>
              </div>
            </div>
          ))}
        </div>

        <div
          className={cn(
            'rounded-md p-3 text-sm',
            anyCritical ? 'bg-status-critical-bg text-status-critical' : overThresholdOnly ? 'bg-status-attention-bg text-status-attention' : 'bg-status-healthy-bg text-status-healthy',
          )}
        >
          <p className="font-semibold">{t('whatif.recommendation')}</p>
          <p className="mt-0.5 text-xs">{overThresholdOnly ? t('whatif.overloadWarning') : recommendation}</p>
        </div>

        {anyOverThreshold && alternativeScenario && (
          <div className="rounded-md border border-slate-200 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">{t('whatif.alternative')}</p>
            <p className="mt-1">
              {alternativeScenario.strategyLabel}:{' '}
              {alternativeScenario.members.map((m) => `${m.fullName} ${m.allocationPercentage}%`).join(' + ')}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
