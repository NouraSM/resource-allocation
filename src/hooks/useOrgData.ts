import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type {
  Assignment,
  Deliverable,
  HistoricalProject,
  Notification,
  Organization,
  Resource,
  ResourceAvailability,
  ResourceSkill,
  Risk,
  RequestSkill,
  Skill,
  WorkRequest,
} from '@/types/database'
import { mapEngineAssignment, mapEngineAvailability, mapEngineHistoricalProject, mapEngineResource, mapOrgSettings } from '@/lib/mappers'

export interface OrgData {
  org: Organization
  resources: Resource[]
  resourceSkills: ResourceSkill[]
  skills: Skill[]
  requests: WorkRequest[]
  requestSkills: RequestSkill[]
  assignments: Assignment[]
  availability: ResourceAvailability[]
  historicalProjects: HistoricalProject[]
  risks: Risk[]
  deliverables: Deliverable[]
  notifications: Notification[]
  orgSettings: ReturnType<typeof mapOrgSettings>
  engineResources: ReturnType<typeof mapEngineResource>[]
  engineAssignments: ReturnType<typeof mapEngineAssignment>[]
  engineAvailability: ReturnType<typeof mapEngineAvailability>[]
  engineHistoricalProjects: ReturnType<typeof mapEngineHistoricalProject>[]
}

/**
 * Loads the full tenant dataset in one pass. At demo scale (tens of
 * resources/requests) this is far simpler than a bespoke query per screen,
 * and every screen ends up needing overlapping slices of the same data
 * anyway (capacity math touches resources+assignments+availability no
 * matter which page triggered it).
 */
export function useOrgData() {
  const { profile } = useAuth()
  const [data, setData] = useState<OrgData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  useEffect(() => {
    if (!profile) return
    let active = true
    setLoading(true)
    setError(null)

    async function load() {
      const [orgRes, resourcesRes, resourceSkillsRes, skillsRes, requestsRes, requestSkillsRes, assignmentsRes, availabilityRes, historyRes, risksRes, deliverablesRes, notificationsRes] =
        await Promise.all([
          supabase.from('organizations').select('*').eq('id', profile!.organization_id).single(),
          supabase.from('resources').select('*').eq('organization_id', profile!.organization_id).order('full_name'),
          supabase.from('resource_skills').select('*').eq('organization_id', profile!.organization_id),
          supabase.from('skills').select('*').eq('organization_id', profile!.organization_id).order('name'),
          supabase.from('work_requests').select('*').eq('organization_id', profile!.organization_id).order('priority_score', { ascending: false }),
          supabase.from('request_skills').select('*').eq('organization_id', profile!.organization_id),
          supabase.from('assignments').select('*').eq('organization_id', profile!.organization_id),
          supabase.from('resource_availability').select('*').eq('organization_id', profile!.organization_id),
          supabase.from('historical_projects').select('*').eq('organization_id', profile!.organization_id),
          supabase.from('risks').select('*').eq('organization_id', profile!.organization_id).eq('active', true),
          supabase.from('deliverables').select('*').eq('organization_id', profile!.organization_id),
          supabase.from('notifications').select('*').eq('organization_id', profile!.organization_id).order('created_at', { ascending: false }),
        ])

      if (!active) return

      const firstError = [orgRes, resourcesRes, resourceSkillsRes, skillsRes, requestsRes, requestSkillsRes, assignmentsRes, availabilityRes, historyRes, risksRes, deliverablesRes, notificationsRes].find(
        (r) => r.error,
      )?.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      const org = orgRes.data as unknown as Organization
      const resources = (resourcesRes.data ?? []) as Resource[]
      const resourceSkills = (resourceSkillsRes.data ?? []) as ResourceSkill[]
      const assignments = (assignmentsRes.data ?? []) as Assignment[]
      const availability = (availabilityRes.data ?? []) as ResourceAvailability[]
      const historicalProjects = (historyRes.data ?? []) as HistoricalProject[]

      setData({
        org,
        resources,
        resourceSkills,
        skills: (skillsRes.data ?? []) as Skill[],
        requests: (requestsRes.data ?? []) as WorkRequest[],
        requestSkills: (requestSkillsRes.data ?? []) as RequestSkill[],
        assignments,
        availability,
        historicalProjects,
        risks: (risksRes.data ?? []) as Risk[],
        deliverables: (deliverablesRes.data ?? []) as Deliverable[],
        notifications: (notificationsRes.data ?? []) as Notification[],
        orgSettings: mapOrgSettings(org),
        engineResources: resources.map((r) => mapEngineResource(r, resourceSkills)),
        engineAssignments: assignments.map(mapEngineAssignment),
        engineAvailability: availability.map(mapEngineAvailability),
        engineHistoricalProjects: historicalProjects.map(mapEngineHistoricalProject),
      })
      setLoading(false)
    }

    load().catch((e) => {
      if (!active) return
      setError(e instanceof Error ? e.message : 'Failed to load organization data')
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [profile, reloadToken])

  return { data, loading, error, refetch }
}
