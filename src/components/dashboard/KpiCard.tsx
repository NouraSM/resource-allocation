import { cn } from '@/lib/utils'

type HeroTone = 'calm' | 'attention' | 'critical' | 'brand'

const HERO_TONE_CLASSES: Record<HeroTone, string> = {
  calm: 'text-slate-900',
  attention: 'text-status-attention',
  critical: 'text-status-critical',
  brand: 'text-brand-700',
}

/** A single top-level executive number — typography carries the hierarchy, not a container. */
export function HeroMetric({ label, value, tone = 'calm' }: { label: string; value: string | number; tone?: HeroTone }) {
  return (
    <div>
      <p className={cn('text-4xl font-semibold tabular-nums tracking-tight sm:text-[2.75rem]', HERO_TONE_CLASSES[tone])}>{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
    </div>
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
