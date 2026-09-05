import { Clock, Scale, Star, Target, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress'
import { riskTone } from '@/lib/statusDisplay'
import { useI18n } from '@/lib/i18n'
import type { TeamScenario } from '@/engine/teamBuilder'
import type { ScenarioBadgeKey } from '@/lib/allocationDisplay'
import { cn } from '@/lib/utils'

const BADGE_META: Record<ScenarioBadgeKey, { icon: typeof Star; labelKey: string }> = {
  recommended: { icon: Star, labelKey: 'scenarioBadges.recommended' },
  bestSkillFit: { icon: Target, labelKey: 'scenarioBadges.bestSkillFit' },
  bestWorkloadBalance: { icon: Scale, labelKey: 'scenarioBadges.bestWorkloadBalance' },
  bestDeadlineFeasibility: { icon: Clock, labelKey: 'scenarioBadges.bestDeadlineFeasibility' },
}

export function ScenarioCard({
  scenario,
  badges,
  onApprove,
  onModify,
  onWhatIf,
  canManage,
}: {
  scenario: TeamScenario
  badges: ScenarioBadgeKey[]
  onApprove: () => void
  onModify: () => void
  onWhatIf: () => void
  canManage: boolean
}) {
  const { t } = useI18n()
  const scenarioLabelKey = { 1: 'allocation.scenarioA', 2: 'allocation.scenarioB', 3: 'allocation.scenarioC' } as const
  const isRecommended = badges.includes('recommended')

  return (
    <Card className={cn('flex flex-col', isRecommended && 'border-brand-400 ring-1 ring-brand-200')}>
      <CardHeader className="flex-col items-start gap-2">
        <div className="flex w-full items-center justify-between">
          <CardTitle>{t(scenarioLabelKey[scenario.scenarioNumber])}</CardTitle>
          <p className="text-2xl font-semibold text-brand-700">{scenario.teamScore.toFixed(0)}</p>
        </div>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {badges.map((key) => {
              const { icon: Icon, labelKey } = BADGE_META[key]
              return (
                <Badge key={key} tone={key === 'recommended' ? 'healthy' : 'info'}>
                  <Icon className="h-3 w-3" /> {t(labelKey)}
                </Badge>
              )
            })}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Metric label={t('allocation.skillCoverage')} value={scenario.skillCoverageScore} />
          <Metric label={t('compare.capacityFeasibility')} value={scenario.capacityScore} />
          <Metric label={t('allocation.deadlineFeasibility')} value={scenario.deadlineFeasibilityScore} />
          <div>
            <p className="mb-0.5 text-slate-500">{t('allocation.deliveryRisk')}</p>
            <Badge tone={riskTone[scenario.deliveryRisk.severity]}>{t(`risk.${scenario.deliveryRisk.severity}`)}</Badge>
          </div>
        </div>

        <div className="space-y-2">
          {scenario.members.length === 0 && <p className="text-xs text-slate-400">{t('allocation.notFeasible')}</p>}
          {scenario.members.map((m) => (
            <div key={m.resourceId} className="rounded-md border border-slate-100 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-slate-800">
                  <User className="h-3 w-3 text-slate-400" />
                  {m.fullName}
                </span>
                <span className="capitalize text-slate-500">{m.jobRole}</span>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-slate-500">
                <span>{m.allocationPercentage}% · {m.allocatedHours}h</span>
                <span>{t('allocation.skillFit')}: {m.skillFitScore.toFixed(0)}</span>
                <span className={m.projectedUtilization > 100 ? 'font-semibold text-status-critical' : ''}>
                  {t('allocation.projectedUtilization')}: {m.projectedUtilization.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {scenario.reasons.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-400">{t('allocation.reasons')}</p>
            <ul className="list-inside list-disc space-y-0.5 text-[11px] text-slate-600">
              {scenario.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {scenario.tradeoffs.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold text-status-attention">{t('allocation.tradeoffs')}</p>
            <ul className="list-inside list-disc space-y-0.5 text-[11px] text-slate-600">
              {scenario.tradeoffs.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      {canManage && (
        <div className="flex gap-2 border-t border-slate-100 p-3">
          <Button size="sm" className="flex-1" onClick={onApprove} disabled={scenario.members.length === 0}>
            {t('common.approve')}
          </Button>
          <Button size="sm" variant="secondary" onClick={onModify} disabled={scenario.members.length === 0}>
            {t('allocation.modifyTeam')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onWhatIf}>
            {t('allocation.runWhatIf')}
          </Button>
        </div>
      )}
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="mb-0.5 flex items-center justify-between text-slate-500">
        <span>{label}</span>
        <span className="font-medium text-slate-700">{value.toFixed(0)}</span>
      </p>
      <ProgressBar value={value} />
    </div>
  )
}
