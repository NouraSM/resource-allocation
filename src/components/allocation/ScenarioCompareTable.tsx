import { Clock, Scale, Star, Target } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { TeamScenario } from '@/engine/teamBuilder'
import type { ScenarioBadgeKey } from '@/lib/allocationDisplay'
import { riskTone } from '@/lib/statusDisplay'
import { cn } from '@/lib/utils'

const BADGE_META: Record<ScenarioBadgeKey, { icon: typeof Star; labelKey: string }> = {
  recommended: { icon: Star, labelKey: 'scenarioBadges.recommended' },
  bestSkillFit: { icon: Target, labelKey: 'scenarioBadges.bestSkillFit' },
  bestWorkloadBalance: { icon: Scale, labelKey: 'scenarioBadges.bestWorkloadBalance' },
  bestDeadlineFeasibility: { icon: Clock, labelKey: 'scenarioBadges.bestDeadlineFeasibility' },
}

const RISK_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }

export function ScenarioCompareTable({
  scenarios,
  badgesByScenario,
}: {
  scenarios: TeamScenario[]
  badgesByScenario: Record<number, ScenarioBadgeKey[]>
}) {
  const { t } = useI18n()
  const scenarioLabelKey = { 1: 'allocation.scenarioA', 2: 'allocation.scenarioB', 3: 'allocation.scenarioC' } as const

  const avgUtilization = (s: TeamScenario) =>
    s.members.length ? s.members.reduce((sum, m) => sum + m.projectedUtilization, 0) / s.members.length : 0

  // "higher is better" metric rows get the best cell(s) highlighted
  const higherIsBetterRows: { label: string; value: (s: TeamScenario) => number }[] = [
    { label: t('allocation.teamFit'), value: (s) => s.teamScore },
    { label: t('allocation.skillCoverage'), value: (s) => s.skillCoverageScore },
    { label: t('compare.capacityFeasibility'), value: (s) => s.capacityScore },
    { label: t('allocation.deadlineFeasibility'), value: (s) => s.deadlineFeasibilityScore },
    { label: t('compare.seniorityCoverage'), value: (s) => s.seniorityMixScore },
    { label: t('compare.relevantExperience'), value: (s) => s.continuityScore },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('compare.title')}</CardTitle>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH></TH>
            {scenarios.map((s) => (
              <TH key={s.scenarioNumber}>
                <div className="flex flex-col gap-1">
                  <span>{t(scenarioLabelKey[s.scenarioNumber])}</span>
                  <div className="flex flex-wrap gap-1">
                    {(badgesByScenario[s.scenarioNumber] ?? []).map((key) => {
                      const { icon: Icon, labelKey } = BADGE_META[key]
                      return (
                        <Badge key={key} tone={key === 'recommended' ? 'healthy' : 'info'} className="font-normal normal-case">
                          <Icon className="h-3 w-3" /> {t(labelKey)}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {higherIsBetterRows.map((row) => {
            const values = scenarios.map(row.value)
            const max = Math.max(...values)
            return (
              <TR key={row.label}>
                <TD className="font-medium text-slate-600">{row.label}</TD>
                {scenarios.map((s, i) => (
                  <TD key={s.scenarioNumber} className={cn(values[i] === max && 'font-semibold text-status-healthy')}>
                    {values[i].toFixed(0)}
                  </TD>
                ))}
              </TR>
            )
          })}
          <TR>
            <TD className="font-medium text-slate-600">{t('compare.avgUtilization')}</TD>
            {scenarios.map((s) => (
              <TD key={s.scenarioNumber}>{avgUtilization(s).toFixed(0)}%</TD>
            ))}
          </TR>
          <TR>
            <TD className="font-medium text-slate-600">{t('allocation.deliveryRisk')}</TD>
            {(() => {
              const ranks = scenarios.map((s) => RISK_RANK[s.deliveryRisk.severity])
              const minRank = Math.min(...ranks)
              return scenarios.map((s, i) => (
                <TD key={s.scenarioNumber}>
                  <Badge tone={riskTone[s.deliveryRisk.severity]} className={cn(ranks[i] === minRank && 'ring-1 ring-status-healthy')}>
                    {t(`risk.${s.deliveryRisk.severity}`)}
                  </Badge>
                </TD>
              ))
            })()}
          </TR>
        </TBody>
      </Table>
    </Card>
  )
}
