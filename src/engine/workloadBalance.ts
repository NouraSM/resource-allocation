// Piecewise-linear interpolation between the spec's reference points so the
// score changes smoothly instead of jumping between discrete buckets.
const POINTS: [number, number][] = [
  [0, 100],
  [0.5, 100],
  [0.6, 90],
  [0.7, 80],
  [0.8, 65],
  [0.9, 35],
  [1.0, 10],
  [1.1, 0],
]

/** Workload balance score for a resource's projected utilization (0-1+ scale). */
export function calculateWorkloadBalanceScore(utilization: number): number {
  const u = Math.max(0, utilization)
  if (u <= POINTS[0][0]) return POINTS[0][1]
  for (let i = 1; i < POINTS.length; i++) {
    const [x1, y1] = POINTS[i - 1]
    const [x2, y2] = POINTS[i]
    if (u <= x2) {
      const t = (u - x1) / (x2 - x1)
      return Math.round((y1 + t * (y2 - y1)) * 100) / 100
    }
  }
  return 0
}
