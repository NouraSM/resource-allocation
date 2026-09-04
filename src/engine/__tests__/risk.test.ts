import { describe, expect, it } from 'vitest'
import { calculateDeliveryRisk, requiresExecutiveAttention, riskSeverityFromScore } from '@/engine/risk'

describe('delivery risk engine', () => {
  it('scores 0 risk when every underlying feasibility score is perfect', () => {
    const result = calculateDeliveryRisk({
      deadlineFeasibilityScore: 100,
      capacityScore: 100,
      skillCoverageScore: 100,
      dependencyImpact: 0,
      assignmentCoverageScore: 100,
    })
    expect(result.score).toBe(0)
    expect(result.severity).toBe('low')
  })

  it('weights deadline risk the heaviest at 35%', () => {
    const badDeadline = calculateDeliveryRisk({ deadlineFeasibilityScore: 0, capacityScore: 100, skillCoverageScore: 100, dependencyImpact: 0, assignmentCoverageScore: 100 })
    const badCapacity = calculateDeliveryRisk({ deadlineFeasibilityScore: 100, capacityScore: 0, skillCoverageScore: 100, dependencyImpact: 0, assignmentCoverageScore: 100 })
    expect(badDeadline.score).toBeGreaterThan(badCapacity.score)
    expect(badDeadline.score).toBe(35)
    expect(badCapacity.score).toBe(30)
  })

  it.each([
    [10, 'low'],
    [29, 'low'],
    [30, 'medium'],
    [59, 'medium'],
    [60, 'high'],
    [79, 'high'],
    [80, 'critical'],
    [100, 'critical'],
  ])('maps score %s to severity %s', (score, severity) => {
    expect(riskSeverityFromScore(score)).toBe(severity)
  })

  it('flags critical-priority + high/critical risk requests for executive attention', () => {
    expect(requiresExecutiveAttention('critical', 'high')).toBe(true)
    expect(requiresExecutiveAttention('critical', 'critical')).toBe(true)
    expect(requiresExecutiveAttention('critical', 'medium')).toBe(false)
    expect(requiresExecutiveAttention('high', 'critical')).toBe(false)
  })
})
