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
