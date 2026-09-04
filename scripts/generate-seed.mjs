#!/usr/bin/env node
// Generates supabase/seed.sql — a deterministic-shape demo dataset for the
// "Government Advisory Center" tenant. Dates are computed relative to the
// moment this script runs, so re-running it keeps the Command Center demo
// (upcoming deadlines, urgency, utilization) looking current.
//
// Usage: node scripts/generate-seed.mjs > supabase/seed.sql
// (or:    npm run seed:generate)
//
// NOTE: the priority/urgency arithmetic here intentionally mirrors
// src/engine/priority.ts and src/engine/urgency.ts at a constants level
// only (it is build-time data generation, not application logic), so the
// seeded numbers are internally consistent with what the live engines would
// compute for the same inputs.

import { randomUUID } from 'node:crypto'

const out = []
const p = (s = '') => out.push(s)
const esc = (s) => String(s).replace(/'/g, "''")
const sql = (s) => (s === null || s === undefined ? 'null' : `'${esc(s)}'`)
const dt = (d) => d.toISOString().slice(0, 10)

const today = new Date()
today.setHours(0, 0, 0, 0)

function addDays(base, days) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

// Sun(0)-Thu(4) are working days for this org (Asia/Riyadh default)
const WORKING_DAYS = [0, 1, 2, 3, 4]
function workingDaysBetween(from, to) {
  if (to <= from) return 0
  let count = 0
  const cursor = new Date(from)
  while (cursor < to) {
    cursor.setDate(cursor.getDate() + 1)
    if (WORKING_DAYS.includes(cursor.getDay())) count++
  }
  return count
}

function urgencyFromDeadline(deadline) {
  if (deadline < today) return 100
  const days = workingDaysBetween(today, deadline)
  if (days <= 3) return 100
  if (days <= 7) return 90
  if (days <= 14) return 75
  if (days <= 30) return 55
  if (days <= 60) return 35
  return 20
}

function priorityScore({ urgency, strategic, exec, regulatory, publicImpact, dependency }) {
  return urgency * 0.3 + strategic * 0.25 + exec * 0.15 + regulatory * 0.15 + publicImpact * 0.1 + dependency * 0.05
}

function priorityLevel(score) {
  if (score >= 85) return 'critical'
  if (score >= 70) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------
const ORG_ID = '11111111-1111-1111-1111-111111111111'

// ---------------------------------------------------------------------------
// Demo accounts (auth.users + auto-provisioned profiles via trigger)
// ---------------------------------------------------------------------------
const DEMO_PASSWORD = 'RaCopilot!Demo1'
const users = [
  { id: '22222222-2222-2222-2222-222222222201', email: 'admin@racopilot.demo', full_name: 'Layla Al-Fahad', role: 'admin' },
  { id: '22222222-2222-2222-2222-222222222202', email: 'manager@racopilot.demo', full_name: 'Abdulaziz Al-Nasser', role: 'resource_manager' },
  { id: '22222222-2222-2222-2222-222222222203', email: 'consultant@racopilot.demo', full_name: 'Sara Al-Mutairi', role: 'consultant' },
  { id: '22222222-2222-2222-2222-222222222204', email: 'executive@racopilot.demo', full_name: 'Turki Al-Saud', role: 'executive_viewer' },
]

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------
const DEPARTMENTS = [
  'Strategy & Transformation',
  'Policy & Research',
  'Data & Analytics',
  'Economics',
  'Program Management',
  'Sector Advisory',
  'Executive Support',
]

// ---------------------------------------------------------------------------
// Skills catalog
// ---------------------------------------------------------------------------
const SKILLS = [
  ['Strategy', 'Strategy'],
  ['Policy', 'Strategy'],
  ['Research', 'Analysis'],
  ['Benchmarking', 'Analysis'],
  ['Data Analysis', 'Data'],
  ['Power BI', 'Data'],
  ['Financial Modeling', 'Finance'],
  ['Economics', 'Finance'],
  ['Healthcare', 'Sector'],
  ['Digital Transformation', 'Strategy'],
  ['Operating Model', 'Strategy'],
  ['Process Improvement', 'Operations'],
  ['Project Management', 'Delivery'],
  ['Program Management', 'Delivery'],
  ['Stakeholder Management', 'Delivery'],
  ['Presentation', 'Delivery'],
  ['Quantitative Analysis', 'Analysis'],
  ['Market Analysis', 'Analysis'],
  ['Business Analysis', 'Analysis'],
  ['Change Management', 'Operations'],
].map(([name, category]) => ({ id: randomUUID(), name, category }))
const skillByName = Object.fromEntries(SKILLS.map((s) => [s.name, s]))

// ---------------------------------------------------------------------------
// Resources (26)
// ---------------------------------------------------------------------------
const TITLES_BY_SENIORITY = {
  1: 'Analyst',
  2: 'Senior Analyst',
  3: 'Consultant',
  4: 'Senior Consultant',
  5: 'Principal Consultant',
}

const RESOURCE_SEED = [
  ['Sara Al-Mutairi', 'Strategy & Transformation', 3, 40],
  ['Abdullah Al-Harbi', 'Data & Analytics', 4, 40],
  ['Noura Al-Qahtani', 'Policy & Research', 2, 40],
  ['Faisal Al-Otaibi', 'Economics', 5, 40],
  ['Maha Al-Zahrani', 'Program Management', 3, 40],
  ['Khalid Al-Ghamdi', 'Sector Advisory', 4, 40],
  ['Rana Al-Dosari', 'Strategy & Transformation', 2, 40],
  ['Omar Al-Balawi', 'Data & Analytics', 3, 40],
  ['Hind Al-Shammari', 'Executive Support', 2, 24],
  ['Yousef Al-Anazi', 'Policy & Research', 3, 40],
  ['Ahmed Al-Amri', 'Sector Advisory', 5, 40],
  ['Reem Al-Subaie', 'Economics', 2, 40],
  ['Tariq Al-Qahtani', 'Program Management', 4, 40],
  ['Dana Al-Harthi', 'Strategy & Transformation', 3, 40],
  ['Saud Al-Rashidi', 'Data & Analytics', 2, 40],
  ['Aisha Al-Malki', 'Policy & Research', 4, 40],
  ['Bandar Al-Juhani', 'Sector Advisory', 3, 40],
  ['Fatimah Al-Yami', 'Economics', 3, 32],
  ['Nasser Al-Otaibi', 'Program Management', 2, 40],
  ['Wafa Al-Saleh', 'Executive Support', 3, 40],
  ['Majed Al-Shehri', 'Strategy & Transformation', 4, 40],
  ['Amal Al-Qarni', 'Data & Analytics', 3, 40],
  ['Sultan Al-Mansour', 'Sector Advisory', 2, 40],
  ['Haya Al-Dossary', 'Policy & Research', 1, 40],
  ['Rashid Al-Ateeqi', 'Program Management', 3, 40],
  ['Nawaf Al-Buqami', 'Economics', 1, 40],
]

const resources = RESOURCE_SEED.map(([full_name, department, seniority_level, weekly_capacity_hours], idx) => ({
  id: randomUUID(),
  employee_code: `GAC-${String(idx + 1).padStart(3, '0')}`,
  full_name,
  department,
  seniority_level,
  weekly_capacity_hours,
  job_title: TITLES_BY_SENIORITY[seniority_level],
  active: true,
}))
// consultant demo login is tied to the first resource
const consultantResource = resources[0]

// One resource is inactive (edge case: inactive resources are hard-filtered out)
resources[resources.length - 1].active = false

// ---------------------------------------------------------------------------
// Resource <-> skills
// ---------------------------------------------------------------------------
const SKILL_POOL_BY_DEPT = {
  'Strategy & Transformation': ['Strategy', 'Operating Model', 'Digital Transformation', 'Change Management', 'Stakeholder Management', 'Presentation'],
  'Policy & Research': ['Policy', 'Research', 'Benchmarking', 'Quantitative Analysis', 'Presentation', 'Stakeholder Management'],
  'Data & Analytics': ['Data Analysis', 'Power BI', 'Quantitative Analysis', 'Business Analysis', 'Process Improvement'],
  Economics: ['Economics', 'Financial Modeling', 'Market Analysis', 'Quantitative Analysis', 'Research'],
  'Program Management': ['Project Management', 'Program Management', 'Stakeholder Management', 'Process Improvement', 'Presentation'],
  'Sector Advisory': ['Healthcare', 'Strategy', 'Market Analysis', 'Benchmarking', 'Stakeholder Management'],
  'Executive Support': ['Presentation', 'Stakeholder Management', 'Program Management', 'Business Analysis'],
}

function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(42)
function pick(arr, n) {
  const copy = [...arr]
  const chosen = []
  while (chosen.length < n && copy.length) {
    const i = Math.floor(rand() * copy.length)
    chosen.push(copy.splice(i, 1)[0])
  }
  return chosen
}

const resourceSkills = []
resources.forEach((r) => {
  const pool = SKILL_POOL_BY_DEPT[r.department]
  const count = 3 + Math.floor(rand() * 3) // 3-5 skills
  const chosen = pick(pool, Math.min(count, pool.length))
  chosen.forEach((skillName) => {
    resourceSkills.push({
      id: randomUUID(),
      resource_id: r.id,
      skill_id: skillByName[skillName].id,
      proficiency: Math.min(5, r.seniority_level + Math.floor(rand() * 2)),
      years_experience: Math.max(1, r.seniority_level * 1.5 + rand() * 2).toFixed(1),
      verified: rand() > 0.4,
    })
  })
})

// ---------------------------------------------------------------------------
// Historical projects (skip a few resources on purpose -> "no history" edge case)
// ---------------------------------------------------------------------------
const SECTORS = ['Healthcare', 'Transport', 'Finance', 'Education', 'Digital Government', 'Energy']
const PROJECT_TYPES = ['Strategy', 'Benchmarking', 'Operating Model', 'Economic Study', 'Transformation']
const historicalProjects = []
resources.forEach((r, idx) => {
  if (idx % 5 === 4) return // ~20% of resources have no history yet
  const count = 1 + Math.floor(rand() * 3)
  for (let i = 0; i < count; i++) {
    const start = addDays(today, -(180 + Math.floor(rand() * 500)))
    const end = addDays(start, 60 + Math.floor(rand() * 90))
    historicalProjects.push({
      id: randomUUID(),
      resource_id: r.id,
      project_name: `${pick(SECTORS, 1)[0]} ${pick(PROJECT_TYPES, 1)[0]} Engagement ${idx}-${i}`,
      sector: pick(SECTORS, 1)[0],
      project_type: pick(PROJECT_TYPES, 1)[0],
      start_date: dt(start),
      end_date: dt(end),
      performance_score: (70 + Math.floor(rand() * 28)).toFixed(0),
    })
  }
})

// ---------------------------------------------------------------------------
// Resource availability (upcoming leave / training)
// ---------------------------------------------------------------------------
const availability = []
;[resources[4], resources[9], resources[15]].forEach((r, i) => {
  const leaveStart = addDays(today, 5 + i * 4)
  for (let d = 0; d < 5; d++) {
    const date = addDays(leaveStart, d)
    if (!WORKING_DAYS.includes(date.getDay())) continue
    availability.push({
      id: randomUUID(),
      resource_id: r.id,
      date: dt(date),
      available_hours: 0,
      reason: 'Annual leave',
      availability_type: 'leave',
    })
  }
})
availability.push({
  id: randomUUID(),
  resource_id: resources[2].id,
  date: dt(addDays(today, 3)),
  available_hours: 4,
  reason: 'Government Excellence Program training',
  availability_type: 'training',
})

// ---------------------------------------------------------------------------
// Work requests (18)
// ---------------------------------------------------------------------------
const ENTITIES = [
  'Ministry of Economy and Planning',
  'Ministry of Health',
  'Ministry of Transport',
  'Ministry of Communications and IT',
  'National Center for Government Excellence',
  'Ministry of Labor and Social Development',
  'Ministry of Finance',
  'Ministry of Investment',
  'Capital Municipality',
  'Digital Government Authority',
]

const TIERS = { low: 20, medium: 50, high: 75, critical: 95 }
const YESNO = { yes: 90, no: 10 }
const PUBLIC = { low: 20, medium: 50, high: 80 }
const DEPEND = { none: 10, some: 50, critical: 90 }

const REQUEST_SEED = [
  { title: 'Healthcare Sector Strategy Review', type: 'Strategy Study', complexity: 'high', deadlineDays: 21, strategic: 'critical', exec: 'yes', reg: 'no', pub: 'high', dep: 'some', status: 'in_progress', effort: 620 },
  { title: 'International Benchmarking Study — Public Transport', type: 'Benchmarking', complexity: 'medium', deadlineDays: 45, strategic: 'medium', exec: 'no', reg: 'no', pub: 'medium', dep: 'none', status: 'in_progress', effort: 340 },
  { title: 'Government Operating Model Review', type: 'Operating Model', complexity: 'very_high', deadlineDays: 60, strategic: 'critical', exec: 'yes', reg: 'no', pub: 'medium', dep: 'critical', status: 'allocated', effort: 780 },
  { title: 'Economic Impact Assessment — Free Zones', type: 'Economic Study', complexity: 'high', deadlineDays: 10, strategic: 'high', exec: 'yes', reg: 'yes', pub: 'medium', dep: 'some', status: 'at_risk', effort: 410 },
  { title: 'Executive Dashboard Development', type: 'Data & Analytics', complexity: 'medium', deadlineDays: 14, strategic: 'medium', exec: 'yes', reg: 'no', pub: 'low', dep: 'none', status: 'in_progress', effort: 220 },
  { title: 'Policy Evaluation — Labor Market Reform', type: 'Policy Study', complexity: 'high', deadlineDays: -4, strategic: 'high', exec: 'no', reg: 'yes', pub: 'high', dep: 'some', status: 'at_risk', effort: 360 },
  { title: 'Service Transformation Assessment — Citizen Services', type: 'Transformation', complexity: 'high', deadlineDays: 30, strategic: 'high', exec: 'yes', reg: 'no', pub: 'high', dep: 'some', status: 'ready_for_allocation', effort: 480 },
  { title: 'Digital Maturity Review', type: 'Digital Transformation', complexity: 'medium', deadlineDays: 50, strategic: 'medium', exec: 'no', reg: 'no', pub: 'low', dep: 'none', status: 'submitted', effort: 260 },
  { title: 'Strategic KPI Framework Design', type: 'Strategy Study', complexity: 'medium', deadlineDays: 25, strategic: 'high', exec: 'yes', reg: 'no', pub: 'medium', dep: 'some', status: 'ready_for_allocation', effort: 300 },
  { title: 'Resource Optimization Study', type: 'Operations', complexity: 'medium', deadlineDays: 6, strategic: 'medium', exec: 'no', reg: 'no', pub: 'low', dep: 'none', status: 'at_risk', effort: 250 },
  { title: 'National Data Strategy Alignment', type: 'Strategy Study', complexity: 'very_high', deadlineDays: 70, strategic: 'critical', exec: 'yes', reg: 'yes', pub: 'medium', dep: 'critical', status: 'in_progress', effort: 700 },
  { title: 'Ministerial Change Management Program', type: 'Change Management', complexity: 'high', deadlineDays: 40, strategic: 'high', exec: 'yes', reg: 'no', pub: 'medium', dep: 'some', status: 'allocated', effort: 390 },
  { title: 'Regulatory Impact Study — Fintech', type: 'Policy Study', complexity: 'high', deadlineDays: 12, strategic: 'high', exec: 'no', reg: 'yes', pub: 'medium', dep: 'some', status: 'under_review', effort: 320 },
  { title: 'Stakeholder Engagement Framework', type: 'Strategy Study', complexity: 'low', deadlineDays: 35, strategic: 'medium', exec: 'no', reg: 'no', pub: 'low', dep: 'none', status: 'submitted', effort: 150 },
  { title: 'Program Governance Health Check', type: 'Program Management', complexity: 'medium', deadlineDays: 2, strategic: 'medium', exec: 'no', reg: 'no', pub: 'low', dep: 'some', status: 'at_risk', effort: 180 },
  { title: 'Public-Private Partnership Feasibility Study', type: 'Economic Study', complexity: 'very_high', deadlineDays: 55, strategic: 'high', exec: 'yes', reg: 'yes', pub: 'medium', dep: 'critical', status: 'ready_for_allocation', effort: 640 },
  { title: 'Workforce Planning Model Update', type: 'Operations', complexity: 'low', deadlineDays: 80, strategic: 'low', exec: 'no', reg: 'no', pub: 'low', dep: 'none', status: 'draft', effort: 120 },
  { title: 'Sector Competitiveness Benchmark', type: 'Benchmarking', complexity: 'medium', deadlineDays: 18, strategic: 'medium', exec: 'no', reg: 'no', pub: 'medium', dep: 'none', status: 'in_progress', effort: 280 },
]

const requests = REQUEST_SEED.map((r, idx) => {
  const deadline = addDays(today, r.deadlineDays)
  const urgency = urgencyFromDeadline(deadline)
  const strategic = TIERS[r.strategic]
  const exec = YESNO[r.exec]
  const reg = YESNO[r.reg]
  const pub = PUBLIC[r.pub]
  const dep = DEPEND[r.dep]
  const score = priorityScore({ urgency, strategic, exec, regulatory: reg, publicImpact: pub, dependency: dep })
  return {
    id: randomUUID(),
    idx,
    title: r.title,
    requesting_entity: ENTITIES[idx % ENTITIES.length],
    requester_name: pick(['Dr. Fahad Al-Ruwaili', 'Eng. Mona Al-Tamimi', 'Mr. Salem Al-Kathiri', 'Ms. Areej Al-Harbi', 'Dr. Bassam Al-Otaibi'], 1)[0],
    request_type: r.type,
    received_date: dt(addDays(today, -(14 + Math.floor(rand() * 60)))),
    requested_deadline: dt(deadline),
    strategic_importance: strategic,
    executive_sponsorship: exec,
    regulatory_importance: reg,
    public_impact: pub,
    dependency_impact: dep,
    urgency_score: urgency,
    priority_score: score.toFixed(2),
    priority_level: priorityLevel(score),
    estimated_effort_hours: r.effort,
    complexity: r.complexity,
    status: r.status,
  }
})

// request -> required skills (2-4 each, at least one mandatory)
const SKILLS_BY_TYPE = {
  'Strategy Study': ['Strategy', 'Stakeholder Management', 'Presentation'],
  Benchmarking: ['Benchmarking', 'Research', 'Market Analysis'],
  'Operating Model': ['Operating Model', 'Process Improvement', 'Strategy'],
  'Economic Study': ['Economics', 'Financial Modeling', 'Quantitative Analysis'],
  'Data & Analytics': ['Data Analysis', 'Power BI', 'Business Analysis'],
  'Policy Study': ['Policy', 'Research', 'Stakeholder Management'],
  Transformation: ['Digital Transformation', 'Change Management', 'Process Improvement'],
  'Digital Transformation': ['Digital Transformation', 'Business Analysis', 'Data Analysis'],
  Operations: ['Process Improvement', 'Project Management', 'Business Analysis'],
  'Change Management': ['Change Management', 'Stakeholder Management', 'Presentation'],
  'Program Management': ['Program Management', 'Project Management', 'Stakeholder Management'],
}
const requestSkills = []
requests.forEach((r) => {
  const source = SKILLS_BY_TYPE[r.request_type] ?? ['Strategy', 'Research']
  // Healthcare requests also need the Healthcare skill
  const names = r.title.includes('Healthcare') ? ['Healthcare', ...source] : source
  names.forEach((name, i) => {
    requestSkills.push({
      id: randomUUID(),
      request_id: r.id,
      skill_id: skillByName[name].id,
      required_level: 3 + (i === 0 ? 1 : 0),
      importance_weight: i === 0 ? 1.5 : 1,
      mandatory: i < 2,
    })
  })
})

// deliverables (1-2 per request)
const deliverables = []
requests.forEach((r) => {
  deliverables.push({
    id: randomUUID(),
    request_id: r.id,
    title: `${r.title} — Diagnostic Report`,
    due_date: dt(addDays(new Date(r.requested_deadline), -14)),
    estimated_hours: Math.round(r.estimated_effort_hours * 0.3),
    status: r.status === 'completed' ? 'completed' : r.status === 'draft' ? 'not_started' : 'in_progress',
  })
  deliverables.push({
    id: randomUUID(),
    request_id: r.id,
    title: `${r.title} — Final Recommendations`,
    due_date: r.requested_deadline,
    estimated_hours: Math.round(r.estimated_effort_hours * 0.4),
    status: 'not_started',
  })
})

// ---------------------------------------------------------------------------
// Assignments (31) — deliberately skew load so 3 resources land >90%
// ---------------------------------------------------------------------------
const OVERLOADED_IDX = [1, 10, 20] // Abdullah Al-Harbi, Ahmed Al-Amri, Majed Al-Shehri
const UNDERUTILIZED_IDX = [24, 25] // last two: light load
const allocatedRequestIdx = requests
  .map((r, i) => ({ r, i }))
  .filter(({ r }) => r.status !== 'draft' && r.status !== 'submitted')
  .map(({ i }) => i)

const assignments = []
function addAssignment(resourceIdx, requestIdx, pct, role, startOffset, span) {
  const resource = resources[resourceIdx]
  const request = requests[requestIdx]
  const start = addDays(today, startOffset)
  const end = addDays(start, span)
  const weeks = Math.max(1, Math.round(span / 7))
  const allocatedHours = Math.round(((resource.weekly_capacity_hours * pct) / 100) * weeks)
  assignments.push({
    id: randomUUID(),
    request_id: request.id,
    resource_id: resource.id,
    assignment_role: role,
    allocation_percentage: pct,
    allocated_hours: allocatedHours,
    start_date: dt(start),
    end_date: dt(end),
    status: request.status === 'completed' ? 'completed' : 'active',
  })
}

// Overloaded resources: 2-3 concurrent assignments each
OVERLOADED_IDX.forEach((rIdx, k) => {
  const reqs = pick(allocatedRequestIdx, 3)
  addAssignment(rIdx, reqs[0], 60, 'lead', -10, 60)
  addAssignment(rIdx, reqs[1], 45, 'contributor', -5, 45)
  if (k !== 1) addAssignment(rIdx, reqs[2], 20, 'contributor', 0, 30)
})

// Healthy / high utilization band for a broad set of mid-list resources
const HEALTHY_IDX = [0, 2, 3, 4, 5, 6, 7, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22]
HEALTHY_IDX.forEach((rIdx, k) => {
  const req = allocatedRequestIdx[k % allocatedRequestIdx.length]
  const pct = 40 + (k % 4) * 10 // 40-70%
  addAssignment(rIdx, req, pct, k % 3 === 0 ? 'lead' : 'contributor', -7 + (k % 5), 40 + (k % 3) * 10)
})

// Underutilized: light single assignment or none
addAssignment(UNDERUTILIZED_IDX[0], allocatedRequestIdx[2], 15, 'contributor', -2, 20)
// UNDERUTILIZED_IDX[1] intentionally gets zero assignments (fully available)

// pad/trim to exactly 31
while (assignments.length < 31) {
  const rIdx = Math.floor(rand() * resources.length)
  const req = allocatedRequestIdx[Math.floor(rand() * allocatedRequestIdx.length)]
  addAssignment(rIdx, req, 15 + Math.floor(rand() * 15), 'contributor', -3, 25)
}
assignments.length = 31

// ---------------------------------------------------------------------------
// Risks — tied to the 4 at_risk requests plus one high-priority in_progress one
// ---------------------------------------------------------------------------
const atRiskRequests = requests.filter((r) => r.status === 'at_risk')
const risks = []
const RISK_TEXT = {
  deadline: 'Remaining working days are insufficient for the outstanding scope at the current pace.',
  capacity: 'Assigned team is projected to exceed sustainable utilization before the deadline.',
  skill_gap: 'One or more mandatory skills are only partially covered by the current team.',
  dependency: 'Deliverable depends on inputs from another in-flight engagement that is itself at risk.',
}
atRiskRequests.forEach((r, i) => {
  const type = Object.keys(RISK_TEXT)[i % 4]
  risks.push({
    id: randomUUID(),
    request_id: r.id,
    risk_type: type,
    risk_score: 65 + Math.floor(rand() * 30),
    severity: i % 2 === 0 ? 'critical' : 'high',
    description: RISK_TEXT[type],
    active: true,
  })
})

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
const notifications = []
OVERLOADED_IDX.forEach((rIdx) => {
  notifications.push({
    id: randomUUID(),
    user_id: null,
    notification_type: 'resource_overloaded',
    severity: 'critical',
    title: `${resources[rIdx].full_name} is overloaded`,
    message: `${resources[rIdx].full_name} is projected above the organization overload threshold based on current assignments.`,
    entity_type: 'resource',
    entity_id: resources[rIdx].id,
  })
})
const criticalUnallocated = requests.find((r) => r.status === 'ready_for_allocation' && r.priority_level === 'critical')
if (criticalUnallocated) {
  notifications.push({
    id: randomUUID(),
    user_id: null,
    notification_type: 'critical_unallocated',
    severity: 'critical',
    title: `${criticalUnallocated.title} has no allocation`,
    message: 'A critical-priority request is ready for allocation but has no assigned team yet.',
    entity_type: 'work_request',
    entity_id: criticalUnallocated.id,
  })
}
atRiskRequests.forEach((r) => {
  notifications.push({
    id: randomUUID(),
    user_id: null,
    notification_type: 'delivery_risk_high',
    severity: 'warning',
    title: `${r.title} delivery risk increased`,
    message: 'Delivery risk moved to High/Critical based on the latest capacity and deadline recalculation.',
    entity_type: 'work_request',
    entity_id: r.id,
  })
})

// ---------------------------------------------------------------------------
// Audit log seed trail
// ---------------------------------------------------------------------------
const auditLogs = []
requests.slice(0, 6).forEach((r) => {
  auditLogs.push({
    id: randomUUID(),
    user_id: users[1].id,
    action: 'request_created',
    entity_type: 'work_request',
    entity_id: r.id,
    old_value: null,
    new_value: { status: 'draft', title: r.title },
    reason: null,
  })
})
assignments.slice(0, 8).forEach((a) => {
  auditLogs.push({
    id: randomUUID(),
    user_id: users[1].id,
    action: 'assignment_approved',
    entity_type: 'assignment',
    entity_id: a.id,
    old_value: { status: 'proposed' },
    new_value: { status: 'active', allocation_percentage: a.allocation_percentage },
    reason: 'management_decision',
  })
})

// ===========================================================================
// Emit SQL
// ===========================================================================
p('-- RA Copilot demo seed: Government Advisory Center')
p('-- Generated by scripts/generate-seed.mjs — do not hand-edit, regenerate instead.')
p('begin;')
p()

p('-- Organization --------------------------------------------------------')
p(`insert into public.organizations (id, name, name_ar, timezone, working_days, daily_work_hours, weekly_work_hours, target_utilization, overload_threshold)
values (${sql(ORG_ID)}, 'Government Advisory Center', 'مركز الاستشارات الحكومية', 'Asia/Riyadh', '[0,1,2,3,4]'::jsonb, 8, 40, 0.85, 0.90)
on conflict (id) do nothing;`)
p()

p('-- Demo accounts (auth.users -> profiles is auto-provisioned by trigger) ------')
users.forEach((u) => {
  p(`insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', ${sql(u.id)}, 'authenticated', 'authenticated', ${sql(u.email)},
  crypt(${sql(DEMO_PASSWORD)}, gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  ${sql(JSON.stringify({ full_name: u.full_name, role: u.role, organization_id: ORG_ID }))}::jsonb,
  now(), now(), '', '', '', ''
) on conflict (id) do nothing;`)
  p(`insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), ${sql(u.id)}, ${sql(u.id)}, ${sql(JSON.stringify({ sub: u.id, email: u.email }))}::jsonb, 'email', now(), now(), now())
on conflict do nothing;`)
})
p()
p('-- link the consultant demo login to its resource record once resources exist')
p(`-- (see end of file)`)
p()

p('-- Skills ---------------------------------------------------------------')
p('insert into public.skills (id, organization_id, name, category) values')
p(SKILLS.map((s) => `  (${sql(s.id)}, ${sql(ORG_ID)}, ${sql(s.name)}, ${sql(s.category)})`).join(',\n') + '\non conflict do nothing;')
p()

p('-- Resources --------------------------------------------------------------')
p('insert into public.resources (id, organization_id, employee_code, full_name, job_title, department, seniority_level, weekly_capacity_hours, utilization_target, active) values')
p(
  resources
    .map(
      (r) =>
        `  (${sql(r.id)}, ${sql(ORG_ID)}, ${sql(r.employee_code)}, ${sql(r.full_name)}, ${sql(r.job_title)}, ${sql(r.department)}, ${r.seniority_level}, ${r.weekly_capacity_hours}, 0.85, ${r.active})`,
    )
    .join(',\n') + '\non conflict do nothing;',
)
p()

p('-- Tie the consultant demo account to its resource profile ---------------')
p(`update public.profiles set resource_id = ${sql(consultantResource.id)} where id = ${sql(users[2].id)};`)
p()

if (resourceSkills.length) {
  p('-- Resource skills ---------------------------------------------------------')
  p('insert into public.resource_skills (id, organization_id, resource_id, skill_id, proficiency, years_experience, verified) values')
  p(
    resourceSkills
      .map((rs) => `  (${sql(rs.id)}, ${sql(ORG_ID)}, ${sql(rs.resource_id)}, ${sql(rs.skill_id)}, ${rs.proficiency}, ${rs.years_experience}, ${rs.verified})`)
      .join(',\n') + '\non conflict do nothing;',
  )
  p()
}

if (historicalProjects.length) {
  p('-- Historical projects ------------------------------------------------------')
  p('insert into public.historical_projects (id, organization_id, resource_id, project_name, sector, project_type, start_date, end_date, performance_score) values')
  p(
    historicalProjects
      .map(
        (h) =>
          `  (${sql(h.id)}, ${sql(ORG_ID)}, ${sql(h.resource_id)}, ${sql(h.project_name)}, ${sql(h.sector)}, ${sql(h.project_type)}, ${sql(h.start_date)}, ${sql(h.end_date)}, ${h.performance_score})`,
      )
      .join(',\n') + '\non conflict do nothing;',
  )
  p()
}

if (availability.length) {
  p('-- Resource availability (leave / training) --------------------------------')
  p('insert into public.resource_availability (id, organization_id, resource_id, date, available_hours, reason, availability_type) values')
  p(
    availability
      .map(
        (a) =>
          `  (${sql(a.id)}, ${sql(ORG_ID)}, ${sql(a.resource_id)}, ${sql(a.date)}, ${a.available_hours}, ${sql(a.reason)}, ${sql(a.availability_type)})`,
      )
      .join(',\n') + '\non conflict do nothing;',
  )
  p()
}

p('-- Work requests -------------------------------------------------------------')
p(
  `insert into public.work_requests (id, organization_id, request_number, title, description, requesting_entity, requester_name, request_type, received_date, requested_deadline, strategic_importance, executive_sponsorship, regulatory_importance, public_impact, dependency_impact, urgency_score, priority_score, priority_level, estimated_effort_hours, complexity, status, created_by) values`,
)
p(
  requests
    .map(
      (r, i) =>
        `  (${sql(r.id)}, ${sql(ORG_ID)}, ${sql(`REQ-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`)}, ${sql(r.title)}, ${sql(
          `Requested by ${r.requesting_entity} to support ${r.request_type?.toLowerCase()} objectives.`,
        )}, ${sql(r.requesting_entity)}, ${sql(r.requester_name)}, ${sql(r.request_type)}, ${sql(r.received_date)}, ${sql(r.requested_deadline)}, ${r.strategic_importance}, ${r.executive_sponsorship}, ${r.regulatory_importance}, ${r.public_impact}, ${r.dependency_impact}, ${r.urgency_score}, ${r.priority_score}, ${sql(r.priority_level)}, ${r.estimated_effort_hours}, ${sql(r.complexity)}, ${sql(r.status)}, ${sql(users[1].id)})`,
    )
    .join(',\n') + '\non conflict do nothing;',
)
p()

p('-- Request skills -------------------------------------------------------------')
p('insert into public.request_skills (id, organization_id, request_id, skill_id, required_level, importance_weight, mandatory) values')
p(
  requestSkills
    .map((rs) => `  (${sql(rs.id)}, ${sql(ORG_ID)}, ${sql(rs.request_id)}, ${sql(rs.skill_id)}, ${rs.required_level}, ${rs.importance_weight}, ${rs.mandatory})`)
    .join(',\n') + '\non conflict do nothing;',
)
p()

p('-- Deliverables -----------------------------------------------------------------')
p('insert into public.deliverables (id, organization_id, request_id, title, due_date, estimated_hours, status) values')
p(
  deliverables
    .map((d) => `  (${sql(d.id)}, ${sql(ORG_ID)}, ${sql(d.request_id)}, ${sql(d.title)}, ${sql(d.due_date)}, ${d.estimated_hours}, ${sql(d.status)})`)
    .join(',\n') + '\non conflict do nothing;',
)
p()

p('-- Assignments ----------------------------------------------------------------')
p(
  'insert into public.assignments (id, organization_id, request_id, resource_id, assignment_role, allocation_percentage, allocated_hours, start_date, end_date, status, approved_by, approved_at) values',
)
p(
  assignments
    .map(
      (a) =>
        `  (${sql(a.id)}, ${sql(ORG_ID)}, ${sql(a.request_id)}, ${sql(a.resource_id)}, ${sql(a.assignment_role)}, ${a.allocation_percentage}, ${a.allocated_hours}, ${sql(a.start_date)}, ${sql(a.end_date)}, ${sql(a.status)}, ${sql(users[1].id)}, now())`,
    )
    .join(',\n') + '\non conflict do nothing;',
)
p()

if (risks.length) {
  p('-- Risks -------------------------------------------------------------------------')
  p('insert into public.risks (id, organization_id, request_id, risk_type, risk_score, severity, description, active) values')
  p(
    risks
      .map((r) => `  (${sql(r.id)}, ${sql(ORG_ID)}, ${sql(r.request_id)}, ${sql(r.risk_type)}, ${r.risk_score}, ${sql(r.severity)}, ${sql(r.description)}, ${r.active})`)
      .join(',\n') + '\non conflict do nothing;',
  )
  p()
}

if (notifications.length) {
  p('-- Notifications -------------------------------------------------------------------')
  p('insert into public.notifications (id, organization_id, user_id, notification_type, severity, title, message, entity_type, entity_id) values')
  p(
    notifications
      .map(
        (n) =>
          `  (${sql(n.id)}, ${sql(ORG_ID)}, ${n.user_id ? sql(n.user_id) : 'null'}, ${sql(n.notification_type)}, ${sql(n.severity)}, ${sql(n.title)}, ${sql(n.message)}, ${sql(n.entity_type)}, ${sql(n.entity_id)})`,
      )
      .join(',\n') + '\non conflict do nothing;',
  )
  p()
}

if (auditLogs.length) {
  p('-- Audit trail ----------------------------------------------------------------------')
  p('insert into public.audit_logs (id, organization_id, user_id, action, entity_type, entity_id, old_value, new_value, reason) values')
  p(
    auditLogs
      .map(
        (a) =>
          `  (${sql(a.id)}, ${sql(ORG_ID)}, ${sql(a.user_id)}, ${sql(a.action)}, ${sql(a.entity_type)}, ${sql(a.entity_id)}, ${a.old_value ? `${sql(JSON.stringify(a.old_value))}::jsonb` : 'null'}, ${a.new_value ? `${sql(JSON.stringify(a.new_value))}::jsonb` : 'null'}, ${a.reason ? sql(a.reason) : 'null'})`,
      )
      .join(',\n') + '\non conflict do nothing;',
  )
  p()
}

p('commit;')

process.stdout.write(out.join('\n') + '\n')
