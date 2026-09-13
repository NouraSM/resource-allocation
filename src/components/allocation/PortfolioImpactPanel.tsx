import { TrendingDown, TrendingUp } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { PortfolioImpact } from '@/engine/portfolioImpact'
import { cn } from '@/lib/utils'

/**
 * Deliberately visually distinct from the request-level score grid above
 * it (Metric/ProgressBar) — this is a separate lens ("best for this
 * request" is not the same question as "best for the organization"), and
 * it must never be folded into a single combined number.
 */
export function PortfolioImpactPanel({ impact }: { impact: PortfolioImpact | null }) {
  const { t } = useI18n()

  if (!impact) {
    return <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[11px] text-slate-400">{t('portfolioImpact.notApplicable')}</p>
  }

  const overloadDelta = impact.overloadedResourcesAfter - impact.overloadedResourcesBefore
  const capacityDelta = impact.relevantRemainingCapacityAfterHours - impact.relevantRemainingCapacityBeforeHours

  return (
    <div className="space-y-1.5 rounded-md bg-slate-50 p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('portfolioImpact.title')}</p>
      <ImpactRow
        label={t('portfolioImpact.overloadedResources')}
        before={impact.overloadedResourcesBefore}
        after={impact.overloadedResourcesAfter}
        worse={overloadDelta > 0}
      />
      <ImpactRow
        label={t('portfolioImpact.remainingCapacity')}
        before={`${Math.round(impact.relevantRemainingCapacityBeforeHours)}${t('common.hours')}`}
        after={`${Math.round(impact.relevantRemainingCapacityAfterHours)}${t('common.hours')}`}
        worse={capacityDelta < 0 && Math.abs(capacityDelta) > 0}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{t('portfolioImpact.affectedCommitments')}</span>
        <span className="font-medium text-slate-700">{impact.affectedActiveCommitments}</span>
      </div>
    </div>
  )
}

function ImpactRow({ label, before, after, worse }: { label: string; before: string | number; after: string | number; worse: boolean }) {
  const changed = String(before) !== String(after)
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={cn('flex items-center gap-1 font-medium', changed && worse ? 'text-status-attention' : 'text-slate-700')}>
        {before} <span className="text-slate-300">→</span> {after}
        {changed && (worse ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3 text-status-healthy" />)}
      </span>
    </div>
  )
}
