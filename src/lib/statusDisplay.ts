import type { badgeVariants } from '@/components/ui/badge'
import type { VariantProps } from 'class-variance-authority'
import type { PriorityLevel, RequestStatus, RiskSeverity } from '@/types/database'
import type { UtilizationStatus } from '@/engine/capacity'

type Tone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export const priorityTone: Record<PriorityLevel, Tone> = {
  low: 'neutral',
  medium: 'info',
  high: 'attention',
  critical: 'critical',
}

export const riskTone: Record<RiskSeverity, Tone> = {
  low: 'healthy',
  medium: 'info',
  high: 'attention',
  critical: 'critical',
}

export const utilizationTone: Record<UtilizationStatus, Tone> = {
  underutilized: 'neutral',
  healthy: 'healthy',
  high: 'attention',
  overloaded: 'critical',
  critical: 'critical',
}

/** Semantic bar-fill colors for utilization visuals — independent of the brand color. */
export const utilizationBarClass: Record<UtilizationStatus, string> = {
  underutilized: 'bg-slate-300',
  healthy: 'bg-status-healthy',
  high: 'bg-status-attention',
  overloaded: 'bg-status-critical',
  critical: 'bg-status-critical',
}

/** Text color for a bare (non-badge) utilization number. */
export const utilizationTextClass: Record<UtilizationStatus, string> = {
  underutilized: 'text-slate-400',
  healthy: 'text-slate-700',
  high: 'text-status-attention',
  overloaded: 'text-status-critical',
  critical: 'text-status-critical',
}

/**
 * Priority levels urgent enough to warrant a pill everywhere they appear —
 * this one is context-independent (unlike status prominence, which pages
 * decide for themselves based on whether the status implies an action there).
 */
export const PROMINENT_PRIORITIES: readonly PriorityLevel[] = ['critical', 'high']

export const statusTone: Record<RequestStatus, Tone> = {
  draft: 'neutral',
  submitted: 'info',
  under_review: 'info',
  ready_for_allocation: 'attention',
  allocated: 'healthy',
  in_progress: 'healthy',
  at_risk: 'critical',
  completed: 'neutral',
  cancelled: 'neutral',
}
