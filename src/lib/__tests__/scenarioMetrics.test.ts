import { describe, expect, it } from 'vitest'
import { formatScenarioScore } from '@/lib/scenarioMetrics'

describe('formatScenarioScore', () => {
  it('formats as "N / 100", never as a percentage', () => {
    expect(formatScenarioScore(72)).toBe('72 / 100')
    expect(formatScenarioScore(0)).toBe('0 / 100')
    expect(formatScenarioScore(100)).toBe('100 / 100')
  })

  it('rounds fractional scores to the nearest whole number', () => {
    expect(formatScenarioScore(64.5)).toBe('65 / 100' /* Math.round(64.5) === 65 */)
    expect(formatScenarioScore(64.49)).toBe('64 / 100')
  })
})
