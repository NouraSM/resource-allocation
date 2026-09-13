import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { formatDate } from '@/lib/utils'
import { priorityTone, riskTone } from '@/lib/statusDisplay'
import type { TeamScenario } from '@/engine/teamBuilder'
import type { PortfolioImpact } from '@/engine/portfolioImpact'
import type { WorkRequest } from '@/types/database'
import { PortfolioImpactPanel } from './PortfolioImpactPanel'

const SCENARIO_LABEL: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' }

/** Picks the metric that differs most from the recommended scenario, for a one-line, evidence-based "how does this alternative differ" summary. */
function describeDifference(recommended: TeamScenario, alt: TeamScenario): string {
  const dims: { label: string; recommended: number; alt: number }[] = [
    { label: 'skill coverage', recommended: recommended.skillCoverageScore, alt: alt.skillCoverageScore },
    { label: 'capacity feasibility', recommended: recommended.capacityScore, alt: alt.capacityScore },
    { label: 'deadline feasibility', recommended: recommended.deadlineFeasibilityScore, alt: alt.deadlineFeasibilityScore },
    { label: 'workload balance', recommended: recommended.loadBalanceScore, alt: alt.loadBalanceScore },
  ]
  const biggest = dims.reduce((a, b) => (Math.abs(b.alt - b.recommended) > Math.abs(a.alt - a.recommended) ? b : a))
  const diff = biggest.alt - biggest.recommended
  if (Math.abs(diff) < 3) return 'Very similar profile to the recommended option.'
  return `${diff > 0 ? 'Higher' : 'Lower'} ${biggest.label} (${biggest.alt.toFixed(0)} vs ${biggest.recommended.toFixed(0)}).`
}

export function DecisionBrief({
  open,
  onClose,
  request,
  scenarios,
  recommendedScenarioNumber,
  portfolioImpactByScenario,
  onCompare,
  onModify,
  onApprove,
  onReject,
  canManage,
}: {
  open: boolean
  onClose: () => void
  request: WorkRequest
  scenarios: TeamScenario[]
  recommendedScenarioNumber: number
  portfolioImpactByScenario: Map<number, PortfolioImpact | null>
  onCompare: () => void
  onModify: () => void
  onApprove: () => void
  onReject: () => void
  canManage: boolean
}) {
  const { t, locale } = useI18n()
  const recommended = scenarios.find((s) => s.scenarioNumber === recommendedScenarioNumber) ?? scenarios[0]
  if (!recommended) return null
  const alternatives = scenarios.filter((s) => s.scenarioNumber !== recommended.scenarioNumber && s.members.length > 0)
  const impact = portfolioImpactByScenario.get(recommended.scenarioNumber) ?? null

  return (
    <Dialog open={open} onClose={onClose} title={t('decisionBrief.title')} className="max-w-2xl">
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('decisionBrief.decisionRequired')}</p>
          <p className="mt-0.5 text-sm text-slate-800">
            {t('decisionBrief.decisionRequiredText')} <span className="font-medium">{request.title}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-slate-100 p-3 text-xs sm:grid-cols-4">
          <div>
            <p className="text-slate-400">{t('requests.table.entity')}</p>
            <p className="font-medium text-slate-700">{request.requesting_entity}</p>
          </div>
          <div>
            <p className="text-slate-400">{t('requests.table.priority')}</p>
            <Badge tone={priorityTone[request.priority_level]}>{t(`priority.${request.priority_level}`)}</Badge>
          </div>
          <div>
            <p className="text-slate-400">{t('requestDetail.deadline')}</p>
            <p className="font-medium text-slate-700">{formatDate(request.requested_deadline, locale)}</p>
          </div>
          <div>
            <p className="text-slate-400">{t('requestDetail.effort')}</p>
            <p className="font-medium text-slate-700">{request.estimated_effort_hours}{t('common.hours')}</p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('decisionBrief.recommendedScenario')}</p>
            <p className="text-lg font-semibold text-brand-700">{SCENARIO_LABEL[recommended.scenarioNumber]} · {recommended.teamScore.toFixed(0)}</p>
          </div>
          <p className="text-xs text-slate-600">{recommended.members.map((m) => `${m.fullName} (${m.jobRole}, ${m.allocationPercentage}%)`).join(' · ')}</p>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('decisionBrief.why')}</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-600">
            {recommended.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('decisionBrief.keyTradeoff')}</p>
          <p className="text-xs text-status-attention">{recommended.tradeoffs[0] ?? t('decisionBrief.noTradeoff')}</p>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('decisionBrief.portfolioImpact')}</p>
          <PortfolioImpactPanel impact={impact} />
        </div>

        {alternatives.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('decisionBrief.alternatives')}</p>
            <ul className="space-y-1 text-xs text-slate-600">
              {alternatives.map((alt) => (
                <li key={alt.scenarioNumber} className="flex items-start gap-2">
                  <Badge tone={riskTone[alt.deliveryRisk.severity]} className="mt-0.5 shrink-0">
                    {SCENARIO_LABEL[alt.scenarioNumber]} · {alt.teamScore.toFixed(0)}
                  </Badge>
                  <span>{describeDifference(recommended, alt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canManage && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="ghost" size="sm" onClick={onCompare}>
              {t('allocation.compareScenarios')}
            </Button>
            <Button variant="secondary" size="sm" onClick={onModify}>
              {t('allocation.modifyTeam')}
            </Button>
            <Button variant="danger" size="sm" onClick={onReject}>
              {t('common.reject')}
            </Button>
            <Button size="sm" onClick={onApprove}>
              {t('common.approve')}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  )
}
