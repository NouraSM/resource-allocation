import { describe, expect, it } from 'vitest'
import { calculateWorkloadBalanceScore } from '@/engine/workloadBalance'

describe('workload balance engine', () => {
  it.each([
    [0.3, 100],
    [0.5, 100],
    [0.6, 90],
    [0.7, 80],
    [0.8, 65],
    [0.9, 35],
    [1.0, 10],
  ])('scores utilization %s as %s', (utilization, expected) => {
    expect(calculateWorkloadBalanceScore(utilization)).toBe(expected)
  })

  it('interpolates smoothly between reference points instead of jumping', () => {
    const score = calculateWorkloadBalanceScore(0.55)
    expect(score).toBeGreaterThan(90)
    expect(score).toBeLessThan(100)
  })

  it('bottoms out at 0 for very high overallocation', () => {
    expect(calculateWorkloadBalanceScore(1.5)).toBe(0)
  })
})
