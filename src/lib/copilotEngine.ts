// Deterministic-first question answering for the Copilot. Every numeric
// claim here comes straight from the same engines and live data the rest
// of the app uses — AI (see src/lib/ai.ts) is only ever layered on top to
// phrase the explanation, never to compute or invent a number.

import type { OrgData } from '@/hooks/useOrgData'
import { computeResourceUtilizations, deriveRequestRiskSeverities, isActiveRequest, priorityBacklog } from '@/engine/dashboardMetrics'
import { calculateDeliveryRisk, riskSeverityFromScore } from '@/engine/risk'
import { calculateCapacityScore } from '@/engine/capacity'
import { calculateCapabilityPressure } from '@/engine/capacityOutlook'
import { buildTeamScenarios, evaluateCandidates } from '@/engine/teamBuilder'
import { calculatePortfolioImpact } from '@/engine/portfolioImpact'

export interface CopilotAction {
  label: string
  path: string
}

export interface CopilotAnswer {
  text: string
  actions: CopilotAction[]
  contextForAi: Record<string, unknown>
}

function todayRange(days: number) {
  const start = new Date()
  const end = new Date(start)
  end.setDate(end.getDate() + days)
  return { start, end }
}

function whoHasCapacity(data: OrgData): CopilotAnswer {
  const { start, end } = todayRange(14)
  const rows = computeResourceUtilizations(data.engineResources, data.resources, data.orgSettings, data.engineAssignments, data.engineAvailability, start, end)
    .filter((r) => r.availableCapacityHours > 8)
    .sort((a, b) => b.availableCapacityHours - a.availableCapacityHours)
    .slice(0, 8)

  if (rows.length === 0) {
    return { text: 'No resources currently show meaningful available capacity over the next two weeks.', actions: [], contextForAi: { rows: [] } }
  }

  const text = `Over the next two weeks, these resources have the most available capacity: ${rows
    .map((r) => `${r.resource.full_name} (${Math.round(r.availableCapacityHours)}h, ${Math.round(r.utilization * 100)}% utilized)`)
    .join(', ')}.`
  return {
    text,
    actions: rows.slice(0, 4).map((r) => ({ label: r.resource.full_name, path: `/resources/${r.resource.id}` })),
    contextForAi: { rows: rows.map((r) => ({ name: r.resource.full_name, availableHours: r.availableCapacityHours, utilization: r.utilization })) },
  }
}

function mostAtRisk(data: OrgData): CopilotAnswer {
  const severityByRequest = deriveRequestRiskSeverities(data.requests, data.risks)
  const rank = { critical: 3, high: 2, medium: 1, low: 0 } as const
  const rows = data.requests
    .filter((r) => severityByRequest.has(r.id))
    .sort((a, b) => rank[severityByRequest.get(b.id)!] - rank[severityByRequest.get(a.id)!])
    .slice(0, 6)

  if (rows.length === 0) {
    return { text: 'No requests currently carry an elevated delivery risk.', actions: [], contextForAi: { rows: [] } }
  }

  const text = `The requests at the highest delivery risk right now are: ${rows
    .map((r) => `${r.title} (${severityByRequest.get(r.id)})`)
    .join(', ')}.`
  return {
    text,
    actions: rows.map((r) => ({ label: r.title, path: `/requests/${r.id}` })),
    contextForAi: { rows: rows.map((r) => ({ title: r.title, severity: severityByRequest.get(r.id), priority: r.priority_level })) },
  }
}

function overloadedEmployees(data: OrgData): CopilotAnswer {
  const { start, end } = todayRange(14)
  const rows = computeResourceUtilizations(data.engineResources, data.resources, data.orgSettings, data.engineAssignments, data.engineAvailability, start, end).filter(
    (r) => r.status === 'overloaded' || r.status === 'critical',
  )
  if (rows.length === 0) {
    return { text: 'No resources are currently overloaded.', actions: [], contextForAi: { rows: [] } }
  }
  const text = `${rows.length} resource(s) are currently overloaded: ${rows.map((r) => `${r.resource.full_name} at ${Math.round(r.utilization * 100)}%`).join(', ')}.`
  return {
    text,
    actions: rows.map((r) => ({ label: r.resource.full_name, path: `/resources/${r.resource.id}` })),
    contextForAi: { rows: rows.map((r) => ({ name: r.resource.full_name, utilization: r.utilization })) },
  }
}

function skillSearch(data: OrgData, question: string): CopilotAnswer {
  const matchedSkills = data.skills.filter((s) => question.toLowerCase().includes(s.name.toLowerCase()))
  if (matchedSkills.length === 0) {
    return { text: "I couldn't match a specific skill in that question to the organization's skill catalog.", actions: [], contextForAi: {} }
  }
  const matchedIds = new Set(matchedSkills.map((s) => s.id))
  const resourceIds = new Set(
    data.resourceSkills.filter((rs) => matchedIds.has(rs.skill_id)).reduce<string[]>((acc, rs) => {
      const hasAll = [...matchedIds].every((skillId) => data.resourceSkills.some((r) => r.resource_id === rs.resource_id && r.skill_id === skillId))
      if (hasAll) acc.push(rs.resource_id)
      return acc
    }, []),
  )
  const resources = data.resources.filter((r) => resourceIds.has(r.id) && r.active)
  if (resources.length === 0) {
    return { text: `No active resource currently holds all of: ${matchedSkills.map((s) => s.name).join(', ')}.`, actions: [], contextForAi: {} }
  }
  return {
    text: `These resources have ${matchedSkills.map((s) => s.name).join(' and ')}: ${resources.map((r) => r.full_name).join(', ')}.`,
    actions: resources.slice(0, 6).map((r) => ({ label: r.full_name, path: `/resources/${r.id}` })),
    contextForAi: { skills: matchedSkills.map((s) => s.name), resources: resources.map((r) => r.full_name) },
  }
}

function canAcceptUrgentRequest(data: OrgData): CopilotAnswer {
  const { start, end } = todayRange(30)
  const rows = computeResourceUtilizations(data.engineResources, data.resources, data.orgSettings, data.engineAssignments, data.engineAvailability, start, end)
  const totalAvailable = rows.reduce((sum, r) => sum + Math.max(0, r.availableCapacityHours), 0)
  const backlog = priorityBacklog(data.requests, data.assignments)
  const typicalRequestHours = data.requests.length
    ? Math.round(data.requests.reduce((s, r) => s + r.estimated_effort_hours, 0) / data.requests.length)
    : 300
  const canAccept = totalAvailable > typicalRequestHours * 1.2

  const text = `Across the organization there is about ${Math.round(totalAvailable)} hours of available capacity over the next 30 days, against a typical request size of ~${typicalRequestHours} hours. ${
    canAccept
      ? 'There is likely enough headroom to accept another urgent request this month, though it may require rebalancing lower-priority work.'
      : 'Capacity is tight — accepting another urgent request this month would likely require deprioritizing or delaying existing work.'
  }`
  return { text, actions: [{ label: 'Command Center', path: '/' }], contextForAi: { totalAvailable, typicalRequestHours, backlog } }
}

function whyHighRisk(data: OrgData, question: string): CopilotAnswer {
  const request = data.requests.find((r) => question.toLowerCase().includes(r.title.toLowerCase()))
  if (!request) {
    return { text: "I couldn't find a request matching that name. Try including the exact request title.", actions: [], contextForAi: {} }
  }
  const assignments = data.assignments.filter((a) => a.request_id === request.id && a.status !== 'cancelled')
  const allocatedHours = assignments.reduce((s, a) => s + a.allocated_hours, 0)
  const capacityScore = calculateCapacityScore(allocatedHours, request.estimated_effort_hours)
  const risk = calculateDeliveryRisk({
    deadlineFeasibilityScore: 100 - request.urgency_score,
    capacityScore,
    skillCoverageScore: 80,
    dependencyImpact: request.dependency_impact,
    assignmentCoverageScore: capacityScore,
  })
  const severity = riskSeverityFromScore(risk.score)
  const text = `${request.title} is ${severity} risk (score ${risk.score.toFixed(0)}/100). The biggest contributors are: deadline risk ${risk.breakdown.deadlineRisk.toFixed(0)}, capacity risk ${risk.breakdown.capacityRisk.toFixed(0)}, skill gap risk ${risk.breakdown.skillGapRisk.toFixed(0)}, dependency risk ${risk.breakdown.dependencyRisk.toFixed(0)}.`
  return { text, actions: [{ label: request.title, path: `/requests/${request.id}` }], contextForAi: { title: request.title, risk } }
}

function capacityPressureAnswer(data: OrgData): CopilotAnswer {
  const today = new Date()
  const rows = calculateCapabilityPressure({
    requests: data.requests,
    requestSkills: data.requestSkills,
    skills: data.skills,
    resources: data.engineResources,
    assignments: data.engineAssignments,
    availability: data.engineAvailability,
    org: data.orgSettings,
    today,
    horizonDays: 56,
  }).filter((r) => r.requestCount > 0 && (r.status === 'overloaded' || r.status === 'critical'))

  if (rows.length === 0) {
    return { text: 'No capability is currently under meaningful pressure over the next 8 weeks.', actions: [{ label: 'Capacity Outlook', path: '/capacity-outlook' }], contextForAi: { rows: [] } }
  }
  const top = rows.slice(0, 3)
  const text = `The most constrained capabilities over the next 8 weeks are: ${top
    .map((r) => `${r.skillName} (${r.requestCount} upcoming request${r.requestCount === 1 ? '' : 's'}, ${r.qualifiedResourceCount} qualified resource${r.qualifiedResourceCount === 1 ? '' : 's'})`)
    .join('; ')}.`
  return { text, actions: [{ label: 'Capacity Outlook', path: '/capacity-outlook' }], contextForAi: { rows: top } }
}

function criticalRequestsNoFeasible(data: OrgData): CopilotAnswer {
  const today = new Date()
  const candidates = data.requests.filter((r) => (r.priority_level === 'critical' || r.priority_level === 'high') && isActiveRequest(r.status))

  const noFeasible = candidates.filter((r) => {
    const requiredSkills = data.requestSkills
      .filter((rs) => rs.request_id === r.id)
      .map((rs) => ({ skillId: rs.skill_id, requiredLevel: rs.required_level, importanceWeight: rs.importance_weight, mandatory: rs.mandatory }))
    const evaluations = evaluateCandidates({
      request: { id: r.id, estimatedEffortHours: r.estimated_effort_hours, requestedDeadline: r.requested_deadline, priorityLevel: r.priority_level, complexity: r.complexity, requestingEntitySector: r.request_type, requestType: r.request_type },
      requiredSkills,
      resources: data.engineResources,
      assignments: data.engineAssignments,
      availability: data.engineAvailability,
      historicalProjects: data.engineHistoricalProjects,
      org: data.orgSettings,
      today,
    })
    return evaluations.length > 0 && evaluations.every((c) => !c.feasible)
  })

  if (noFeasible.length === 0) {
    return { text: 'Every critical or high-priority request currently has at least one feasible candidate.', actions: [], contextForAi: { requests: [] } }
  }
  const text = `${noFeasible.length} critical/high-priority request(s) currently have no feasible resource: ${noFeasible.map((r) => r.title).join(', ')}.`
  return {
    text,
    actions: noFeasible.slice(0, 6).map((r) => ({ label: r.title, path: `/allocation/${r.id}` })),
    contextForAi: { requests: noFeasible.map((r) => r.title) },
  }
}

function portfolioImpactAnswer(data: OrgData, question: string): CopilotAnswer {
  const request = data.requests.find((r) => question.toLowerCase().includes(r.title.toLowerCase()))
  if (!request) {
    return { text: "I couldn't find a request matching that name. Try including the exact request title.", actions: [], contextForAi: {} }
  }
  const today = new Date()
  const requiredSkills = data.requestSkills
    .filter((rs) => rs.request_id === request.id)
    .map((rs) => ({ skillId: rs.skill_id, requiredLevel: rs.required_level, importanceWeight: rs.importance_weight, mandatory: rs.mandatory }))
  const result = buildTeamScenarios({
    request: {
      id: request.id,
      estimatedEffortHours: request.estimated_effort_hours,
      requestedDeadline: request.requested_deadline,
      priorityLevel: request.priority_level,
      complexity: request.complexity,
      requestingEntitySector: request.request_type,
      requestType: request.request_type,
    },
    requiredSkills,
    resources: data.engineResources,
    assignments: data.engineAssignments,
    availability: data.engineAvailability,
    historicalProjects: data.engineHistoricalProjects,
    org: data.orgSettings,
    today,
  })
  const top = result.scenarios[0]
  const impact = top
    ? calculatePortfolioImpact({
        scenario: top,
        requestId: request.id,
        requestDeadline: request.requested_deadline,
        allResources: data.engineResources,
        allAssignments: data.engineAssignments,
        availability: data.engineAvailability,
        org: data.orgSettings,
        today,
      })
    : null

  if (!impact) {
    return {
      text: `${request.title} has no feasible allocation scenario yet, so there is no portfolio impact to assess.`,
      actions: [{ label: request.title, path: `/allocation/${request.id}` }],
      contextForAi: {},
    }
  }
  const text = `Allocating the recommended scenario for ${request.title} would move overloaded resources in its capability pool from ${impact.overloadedResourcesBefore} to ${impact.overloadedResourcesAfter}, and relevant remaining capacity from ${Math.round(impact.relevantRemainingCapacityBeforeHours)}h to ${Math.round(impact.relevantRemainingCapacityAfterHours)}h.`
  return { text, actions: [{ label: request.title, path: `/allocation/${request.id}` }], contextForAi: { impact } }
}

export function answerDeterministically(question: string, data: OrgData): CopilotAnswer {
  const q = question.toLowerCase()
  if (q.includes('capacity') && (q.includes('who') || q.includes('week'))) return whoHasCapacity(data)
  if (q.includes('risk') && (q.includes('project') || q.includes('most'))) return mostAtRisk(data)
  if (q.includes('overloaded') || q.includes('who is over')) return overloadedEmployees(data)
  if ((q.includes('capacity') && q.includes('pressure')) || (q.includes('capab') && q.includes('constrain'))) return capacityPressureAnswer(data)
  if (q.includes('critical') && q.includes('feasible')) return criticalRequestsNoFeasible(data)
  if (q.includes('portfolio impact')) return portfolioImpactAnswer(data, question)
  if (q.includes('skill') || q.includes('who has')) return skillSearch(data, question)
  if (q.includes('accept') && q.includes('urgent')) return canAcceptUrgentRequest(data)
  if (q.includes('why') && q.includes('risk')) return whyHighRisk(data, question)
  // default: a portfolio snapshot so the Copilot is never empty-handed
  const severityByRequest = deriveRequestRiskSeverities(data.requests, data.risks)
  const atRisk = [...severityByRequest.values()].filter((s) => s === 'high' || s === 'critical').length
  return {
    text: `The portfolio currently has ${data.requests.length} requests (${atRisk} at high/critical risk) and ${data.resources.filter((r) => r.active).length} active resources. Ask about capacity, risk, skills, or a specific request for more detail.`,
    actions: [{ label: 'Command Center', path: '/' }],
    contextForAi: {},
  }
}
