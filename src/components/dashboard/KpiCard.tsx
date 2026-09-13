import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

type HeroTone = 'calm' | 'attention' | 'critical' | 'brand'
type HeroSize = 'lg' | 'sm'

const HERO_TONE_CLASSES: Record<HeroTone, string> = {
  calm: 'text-slate-900',
  attention: 'text-status-attention',
  critical: 'text-status-critical',
  brand: 'text-brand-700',
}

// lg ≈ 48–56px (the single anchor metric), sm ≈ 28–32px (still legible and
// present, not an afterthought — "secondary" is a hierarchy choice, not a
// smallness contest).
const HERO_SIZE_CLASSES: Record<HeroSize, string> = {
  lg: 'text-[44px] leading-none sm:text-[52px]',
  sm: 'text-[28px] leading-none sm:text-[30px]',
}

/** A top-level executive number — typography carries the hierarchy, not a container. */
export function HeroMetric({
  label,
  value,
  tone = 'calm',
  size = 'lg',
}: {
  label: string
  value: string | number
  tone?: HeroTone
  size?: HeroSize
}) {
  return (
    <div>
      <p className={cn('font-semibold tabular-nums tracking-tight', HERO_SIZE_CLASSES[size], HERO_TONE_CLASSES[tone])}>{value}</p>
      <p className={cn('mt-1 font-medium text-slate-500', size === 'lg' ? 'text-sm' : 'text-xs')}>{label}</p>
    </div>
  )
}

type KpiStatTone = 'calm' | 'attention' | 'critical'

const KPI_STAT_NUMBER_CLASSES: Record<KpiStatTone, string> = {
  calm: 'text-slate-900',
  attention: 'text-status-attention',
  critical: 'text-status-critical',
}

// A restrained left-edge accent only — never a full colored background —
// so four peer KPIs stay calm even when one is flagged.
const KPI_STAT_ACCENT_CLASSES: Record<KpiStatTone, string> = {
  calm: 'border-s-transparent',
  attention: 'border-s-status-attention',
  critical: 'border-s-status-critical',
}

/**
 * One of a row of equal-weight executive KPIs — same card, same number
 * size/weight, same label size, differing only by a subtle left accent and
 * number color when a metric needs attention. Used where several KPIs must
 * read as peers rather than one dominant hero metric (see HeroMetric for
 * that layout instead).
 */
export function KpiStatCard({ label, value, tone = 'calm' }: { label: string; value: string | number; tone?: KpiStatTone }) {
  return (
    <Card className={cn('border-s-[3px] p-5', KPI_STAT_ACCENT_CLASSES[tone])}>
      <p className={cn('text-[34px] font-semibold leading-none tabular-nums', KPI_STAT_NUMBER_CLASSES[tone])}>{value}</p>
      <p className="mt-2 text-sm font-medium text-slate-500">{label}</p>
    </Card>
  )
}

/** A quieter, inline secondary figure for the supporting-metrics strip. */
export function StatInline({ label, value, emphasize = false }: { label: string; value: string | number; emphasize?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn('text-sm font-semibold tabular-nums', emphasize ? 'text-brand-700' : 'text-slate-700')}>{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}
