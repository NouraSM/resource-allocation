import { describe, expect, it } from 'vitest'
import { departmentCapacityInsight, priorityBacklogInsight } from '@/engine/dashboardMetrics'
import type { DepartmentCapacityRow, PriorityCapacityRow } from '@/engine/dashboardMetrics'

const org = { targetUtilization: 0.85, overloadThreshold: 0.9 }

describe('departmentCapacityInsight', () => {
  it('returns null with no departments', () => {
    expect(departmentCapacityInsight([], org)).toBeNull()
  })

  it('names the over-capacity department without hard-coding it', () => {
    const rows: DepartmentCapacityRow[] = [
      { department: 'Strategy & Transformation', avgUtilization: 1.05, headcount: 3 },
      { department: 'Policy & Research', avgUtilization: 0.5, headcount: 2 },
    ]
    const text = departmentCapacityInsight(rows, org)
    expect(text).toContain('Strategy & Transformation')
    expect(text).toContain('over capacity')
    expect(text).not.toContain('Policy & Research')
  })

  it('combines over-capacity and near-capacity departments in one sentence', () => {
    const rows: DepartmentCapacityRow[] = [
      { department: 'Strategy & Transformation', avgUtilization: 1.05, headcount: 3 },
      { department: 'Sector Advisory', avgUtilization: 0.87, headcount: 2 }, // between target (0.85) and overload (0.9) -> "high"
      { department: 'Policy & Research', avgUtilization: 0.4, headcount: 2 },
    ]
    const text = departmentCapacityInsight(rows, org)
    expect(text).toContain('Strategy & Transformation')
    expect(text).toContain('over capacity')
    expect(text).toContain('Sector Advisory')
    expect(text).toContain('approaching the utilization limit')
  })

  it('joins multiple names with commas and "and"', () => {
    const rows: DepartmentCapacityRow[] = [
      { department: 'A', avgUtilization: 1.1, headcount: 1 },
      { department: 'B', avgUtilization: 1.1, headcount: 1 },
      { department: 'C', avgUtilization: 1.1, headcount: 1 },
    ]
    const text = departmentCapacityInsight(rows, org)
    expect(text).toBe('A, B, and C are currently over capacity.')
  })

  it('falls back to headroom framing when every department is calm', () => {
    const rows: DepartmentCapacityRow[] = [
      { department: 'Strategy & Transformation', avgUtilization: 0.6, headcount: 3 },
      { department: 'Policy & Research', avgUtilization: 0.3, headcount: 2 },
    ]
    const text = departmentCapacityInsight(rows, org)
    expect(text).toContain('No departments are near capacity')
    expect(text).toContain('Policy & Research')
  })

  it('uses the organization thresholds, not a hardcoded cutoff', () => {
    const rows: DepartmentCapacityRow[] = [{ department: 'Strategy & Transformation', avgUtilization: 0.82, headcount: 3 }]
    // Under a lenient policy (target 0.95) this is healthy...
    expect(departmentCapacityInsight(rows, { targetUtilization: 0.95, overloadThreshold: 1 })).toContain('No departments are near capacity')
    // ...but under a strict policy (target 0.5, overload 0.8) the same 82% is over capacity.
    expect(departmentCapacityInsight(rows, { targetUtilization: 0.5, overloadThreshold: 0.8 })).toContain('over capacity')
  })
})

describe('priorityBacklogInsight', () => {
  it('returns null when there is no backlog at all', () => {
    const rows: PriorityCapacityRow[] = [
      { priority: 'critical', backlogHours: 0, requestCount: 0 },
      { priority: 'high', backlogHours: 0, requestCount: 0 },
      { priority: 'medium', backlogHours: 0, requestCount: 0 },
      { priority: 'low', backlogHours: 0, requestCount: 0 },
    ]
    expect(priorityBacklogInsight(rows)).toBeNull()
  })

  it('identifies the dominant priority and its share of total backlog', () => {
    const rows: PriorityCapacityRow[] = [
      { priority: 'critical', backlogHours: 0, requestCount: 0 },
      { priority: 'high', backlogHours: 100, requestCount: 2 },
      { priority: 'medium', backlogHours: 300, requestCount: 4 },
      { priority: 'low', backlogHours: 100, requestCount: 1 },
    ]
    const text = priorityBacklogInsight(rows)
    expect(text).toContain('Medium-priority work')
    expect(text).toContain('60%') // 300 / 500
    expect(text).toContain('no Critical requests are currently present')
  })

  it('does not claim "no Critical requests" when Critical requests exist', () => {
    const rows: PriorityCapacityRow[] = [
      { priority: 'critical', backlogHours: 50, requestCount: 1 },
      { priority: 'high', backlogHours: 20, requestCount: 1 },
      { priority: 'medium', backlogHours: 10, requestCount: 1 },
      { priority: 'low', backlogHours: 5, requestCount: 1 },
    ]
    const text = priorityBacklogInsight(rows)
    expect(text).toContain('Critical-priority work')
    expect(text).not.toContain('no Critical requests')
  })
})
