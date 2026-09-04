import { useI18n } from '@/lib/i18n'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { TeamScenario } from '@/engine/teamBuilder'
import { riskTone } from '@/lib/statusDisplay'

export function ScenarioCompareTable({ scenarios, recommendedScenario }: { scenarios: TeamScenario[]; recommendedScenario: number }) {
  const { t } = useI18n()
  const scenarioLabelKey = { 1: 'allocation.scenarioA', 2: 'allocation.scenarioB', 3: 'allocation.scenarioC' } as const

  const avgUtilization = (s: TeamScenario) =>
    s.members.length ? s.members.reduce((sum, m) => sum + m.projectedUtilization, 0) / s.members.length : 0

  const rows: { label: string; render: (s: TeamScenario) => string }[] = [
    { label: t('allocation.teamFit'), render: (s) => s.teamScore.toFixed(0) },
    { label: t('allocation.skillCoverage'), render: (s) => s.skillCoverageScore.toFixed(0) },
    { label: t('compare.capacityFeasibility'), render: (s) => s.capacityScore.toFixed(0) },
    { label: t('compare.avgUtilization'), render: (s) => `${avgUtilization(s).toFixed(0)}%` },
    { label: t('allocation.deadlineFeasibility'), render: (s) => s.deadlineFeasibilityScore.toFixed(0) },
    { label: t('compare.seniorityCoverage'), render: (s) => s.seniorityMixScore.toFixed(0) },
    { label: t('compare.relevantExperience'), render: (s) => s.continuityScore.toFixed(0) },
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
                {t(scenarioLabelKey[s.scenarioNumber])}
                {s.scenarioNumber === recommendedScenario && (
                  <Badge tone="healthy" className="ms-2">
                    {t('allocation.recommended')}
                  </Badge>
                )}
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.label}>
              <TD className="font-medium text-slate-600">{row.label}</TD>
              {scenarios.map((s) => (
                <TD key={s.scenarioNumber}>{row.render(s)}</TD>
              ))}
            </TR>
          ))}
          <TR>
            <TD className="font-medium text-slate-600">{t('allocation.deliveryRisk')}</TD>
            {scenarios.map((s) => (
              <TD key={s.scenarioNumber}>
                <Badge tone={riskTone[s.deliveryRisk.severity]}>{t(`risk.${s.deliveryRisk.severity}`)}</Badge>
              </TD>
            ))}
          </TR>
        </TBody>
      </Table>
    </Card>
  )
}
