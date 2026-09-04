import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
}: {
  label: string
  value: string | number
  icon?: LucideIcon
  tone?: 'neutral' | 'healthy' | 'attention' | 'critical'
  hint?: string
}) {
  const toneClasses: Record<string, string> = {
    neutral: 'text-slate-700',
    healthy: 'text-status-healthy',
    attention: 'text-status-attention',
    critical: 'text-status-critical',
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-slate-300" />}
      </div>
      <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums', toneClasses[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}
