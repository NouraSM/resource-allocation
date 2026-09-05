import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pencil } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { computeResourceUtilizations, weeklyCapacitySeries } from '@/engine/dashboardMetrics'
import { utilizationTone, priorityTone } from '@/lib/statusDisplay'
import { formatDate } from '@/lib/utils'
import { ResourceFormDialog } from '@/components/resources/ResourceFormDialog'
import type { ResourceFormValues } from '@/components/resources/ResourceFormDialog'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export function ResourceProfile() {
  const { id } = useParams<{ id: string }>()
  const { t, locale } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()
  const [editOpen, setEditOpen] = useState(false)
  const isAdmin = profile?.role === 'admin'

  const today = useMemo(() => new Date(), [])

  const resource = useMemo(() => data?.resources.find((r) => r.id === id), [data, id])
  const engineResource = useMemo(() => data?.engineResources.find((r) => r.id === id), [data, id])

  const weekly = useMemo(() => {
    if (!engineResource || !data) return []
    return weeklyCapacitySeries(engineResource, data.orgSettings, data.engineAssignments, data.engineAvailability, today, 8)
  }, [engineResource, data, today])

  const currentUtilization = useMemo(() => {
    if (!data || !resource) return null
    const twoWeeksOut = new Date(today)
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)
    const rows = computeResourceUtilizations([engineResource!], [resource], data.orgSettings, data.engineAssignments, data.engineAvailability, today, twoWeeksOut)
    return rows[0] ?? null
  }, [data, resource, engineResource, today])

  const skills = useMemo(() => (data && resource ? data.resourceSkills.filter((rs) => rs.resource_id === resource.id) : []), [data, resource])
  const assignments = useMemo(() => (data && resource ? data.assignments.filter((a) => a.resource_id === resource.id) : []), [data, resource])
  const history = useMemo(() => (data && resource ? data.historicalProjects.filter((h) => h.resource_id === resource.id) : []), [data, resource])
  const availability = useMemo(() => (data && resource ? data.availability.filter((a) => a.resource_id === resource.id) : []), [data, resource])

  if (loading) return <AppShell><LoadingState /></AppShell>
  if (error) return <AppShell><ErrorState message={error} onRetry={refetch} /></AppShell>
  if (!resource || !data) return <AppShell><EmptyState title="Resource not found" /></AppShell>

  const canTakeMore = currentUtilization ? currentUtilization.utilization < data.orgSettings.targetUtilization : true
  const departments = Array.from(new Set(data.resources.map((r) => r.department))).sort()

  async function handleSaveEdit(values: ResourceFormValues) {
    if (!profile || !resource) return
    const { employee_code: _unused, ...updatable } = values
    void _unused
    const oldValue = { full_name: resource.full_name, department: resource.department, weekly_capacity_hours: resource.weekly_capacity_hours, active: resource.active }
    await supabase.from('resources').update(updatable).eq('id', resource.id)
    await logAudit({
      organizationId: profile.organization_id,
      userId: profile.id,
      action: 'resource_updated',
      entityType: 'resource',
      entityId: resource.id,
      oldValue,
      newValue: updatable,
    })
    setEditOpen(false)
    refetch()
  }

  return (
    <AppShell title={resource.full_name} subtitle={`${resource.job_title} · ${resource.department}`}>
      {isAdmin && (
        <div className="mb-3 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> {t('common.edit')}
          </Button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('resourceProfile.upcomingCapacity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="weekStart" tickFormatter={(v) => formatDate(v, locale)} fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip labelFormatter={(v) => formatDate(v as string, locale)} formatter={(v) => `${v} ${t('common.hours')}`} />
                  <Bar dataKey="availableCapacityHours" radius={[4, 4, 0, 0]} fill="#64748b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('resourceProfile.utilizationTrend')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="weekStart" tickFormatter={(v) => formatDate(v, locale)} fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <Tooltip labelFormatter={(v) => formatDate(v as string, locale)} formatter={(v) => `${v}%`} />
                  <Line type="monotone" dataKey="utilization" stroke="#64748b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('resourceProfile.assignments')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {assignments.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">{t('common.noData')}</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>{t('requests.table.request')}</TH>
                      <TH>{t('allocation.memberRole')}</TH>
                      <TH>{t('allocation.allocationPct')}</TH>
                      <TH>{t('common.status')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {assignments.map((a) => {
                      const request = data.requests.find((r) => r.id === a.request_id)
                      return (
                        <TR key={a.id} className="cursor-pointer" onClick={() => request && navigate(`/requests/${request.id}`)}>
                          <TD>
                            <p className="font-medium text-slate-800">{request?.title ?? a.request_id}</p>
                            {request && <Badge tone={priorityTone[request.priority_level]}>{t(`priority.${request.priority_level}`)}</Badge>}
                          </TD>
                          <TD className="capitalize">{a.assignment_role}</TD>
                          <TD>{a.allocation_percentage}%</TD>
                          <TD>
                            <Badge tone="info">{a.status}</Badge>
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('resourceProfile.experience')}</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-slate-400">{t('common.noData')}</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li key={h.id} className="rounded-[var(--radius-control)] border border-slate-100 p-2 text-xs">
                      <p className="font-medium text-slate-700">{h.project_name}</p>
                      <p className="text-slate-500">
                        {h.sector} · {h.project_type} {h.performance_score != null && `· ${h.performance_score}/100`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('resourceProfile.currentAllocation')}</CardTitle>
            </CardHeader>
            <CardContent>
              {currentUtilization && (
                <>
                  <p className="text-3xl font-semibold text-brand-700">{Math.round(currentUtilization.utilization * 100)}%</p>
                  <Badge tone={utilizationTone[currentUtilization.status]} className="mt-1">
                    {t(`utilization.${currentUtilization.status}`)}
                  </Badge>
                </>
              )}
              <p className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                {t('resourceProfile.canTakeMore')} <span className={canTakeMore ? 'font-semibold text-status-healthy' : 'font-semibold text-status-critical'}>{canTakeMore ? t('common.yes') : t('common.no')}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('resourceProfile.skills')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {skills.length === 0 ? (
                <p className="text-sm text-slate-400">{t('common.noData')}</p>
              ) : (
                skills.map((rs) => {
                  const skill = data.skills.find((s) => s.id === rs.skill_id)
                  return (
                    <Badge key={rs.id} tone="info">
                      {skill?.name} · L{rs.proficiency}
                    </Badge>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('resourceProfile.availability')}</CardTitle>
            </CardHeader>
            <CardContent>
              {availability.length === 0 ? (
                <p className="text-sm text-slate-400">{t('common.noData')}</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {availability
                    .filter((a) => new Date(a.date) >= today)
                    .slice(0, 10)
                    .map((a) => (
                      <li key={a.id} className="flex justify-between text-slate-600">
                        <span className="capitalize">{a.availability_type.replace('_', ' ')}</span>
                        <span>{formatDate(a.date, locale)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <ResourceFormDialog open={editOpen} onClose={() => setEditOpen(false)} onSave={handleSaveEdit} existing={resource} departments={departments} />
    </AppShell>
  )
}
