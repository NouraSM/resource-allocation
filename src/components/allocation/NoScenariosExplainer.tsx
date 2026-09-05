import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { summarizeInfeasibleReasons } from '@/lib/allocationDisplay'
import type { CandidateEvaluation } from '@/engine/teamBuilder'

export function NoScenariosExplainer({
  notFeasible,
  evaluatedCount,
  onViewRequest,
  onViewResources,
}: {
  notFeasible: CandidateEvaluation[]
  evaluatedCount: number
  onViewRequest: () => void
  onViewResources: () => void
}) {
  const { t } = useI18n()
  const reasons = summarizeInfeasibleReasons(notFeasible)

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-status-attention" />
        <CardTitle>{t('allocationBlocked.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          {evaluatedCount} {t('allocationBlocked.evaluatedLabel')}
        </p>

        {reasons.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500">{t('allocationBlocked.topReasons')}</p>
            <ul className="space-y-1.5">
              {reasons.map((r) => (
                <li key={r.reason} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 shrink-0 rounded bg-status-attention-bg px-1.5 py-0.5 font-semibold text-status-attention">
                    {r.count}×
                  </span>
                  <span>{r.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" size="sm" onClick={onViewRequest}>
            {t('allocationBlocked.viewRequest')}
          </Button>
          <Button variant="secondary" size="sm" onClick={onViewResources}>
            {t('allocationBlocked.viewResources')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
