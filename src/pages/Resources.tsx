import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { computeResourceUtilizations } from '@/engine/dashboardMetrics'
import { utilizationTone, utilizationBarClass } from '@/lib/statusDisplay'
import { ProgressBar } from '@/components/ui/progress'
import type { UtilizationStatus } from '@/engine/capacity'
import { ResourceFormDialog } from '@/components/resources/ResourceFormDialog'
import type { ResourceFormValues } from '@/components/resources/ResourceFormDialog'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export function Resources() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()
  const [createOpen, setCreateOpen] = useState(false)
  const isAdmin = profile?.role === 'admin'

  async function handleCreate(values: ResourceFormValues) {
    if (!profile) return
    const { data: inserted, error: insertError } = await supabase
      .from('resources')
      .insert({ organization_id: profile.organization_id, ...values })
      .select()
      .single()
    if (insertError || !inserted) return
    await logAudit({
      organizationId: profile.organization_id,
      userId: profile.id,
      action: 'resource_created',
      entityType: 'resource',
      entityId: inserted.id,
      newValue: { full_name: inserted.full_name, department: inserted.department },
    })
    setCreateOpen(false)
    refetch()
  }

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('all')
  const [skillFilter, setSkillFilter] = useState('all')
  const [utilizationFilter, setUtilizationFilter] = useState<UtilizationStatus | 'all'>('all')

  const today = useMemo(() => new Date(), [])
  const twoWeeksOut = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 14)
    return d
  }, [today])

  const rows = useMemo(() => {
    if (!data) return []
    const utilizations = computeResourceUtilizations(data.engineResources, data.resources, data.orgSettings, data.engineAssignments, data.engineAvailability, today, twoWeeksOut)
    return utilizations.map((u) => {
      const skills = data.resourceSkills.filter((rs) => rs.resource_id === u.resource.id).map((rs) => data.skills.find((s) => s.id === rs.skill_id)?.name).filter(Boolean) as string[]
      const activeAssignments = data.assignments.filter((a) => a.resource_id === u.resource.id && (a.status === 'active' || a.status === 'proposed')).length
      return { ...u, skills, activeAssignments }
    })
  }, [data, today, twoWeeksOut])

  const departments = useMemo(() => Array.from(new Set((data?.resources ?? []).map((r) => r.department))).sort(), [data])
  const allSkills = useMemo(() => (data?.skills ?? []).map((s) => s.name).sort(), [data])

  const filtered = rows.filter((row) => {
    if (department !== 'all' && row.resource.department !== department) return false
    if (utilizationFilter !== 'all' && row.status !== utilizationFilter) return false
    if (skillFilter !== 'all' && !row.skills.includes(skillFilter)) return false
    if (search && !row.resource.full_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) {
    return (
      <AppShell title={t('resources.title')} subtitle={t('resources.subtitle')}>
        <LoadingState />
      </AppShell>
    )
  }
  if (error) {
    return (
      <AppShell title={t('resources.title')} subtitle={t('resources.subtitle')}>
        <ErrorState message={error} onRetry={refetch} />
      </AppShell>
    )
  }
  if (!data || data.resources.length === 0) {
    return (
      <AppShell title={t('resources.title')} subtitle={t('resources.subtitle')}>
        <EmptyState
          title={t('resources.empty')}
          body={t('resources.emptyBody')}
          action={isAdmin ? <Button onClick={() => setCreateOpen(true)}>{t('common.create')}</Button> : undefined}
        />
        {data && (
          <ResourceFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleCreate} departments={[]} />
        )}
      </AppShell>
    )
  }

  return (
    <AppShell title={t('resources.title')} subtitle={t('resources.subtitle')}>
      <div className="space-y-4">
        {isAdmin && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t('common.create')}
            </Button>
          </div>
        )}
        <Card className="flex flex-wrap gap-3 p-3">
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-52">
            <option value="all">{t('resources.table.department')}: {t('common.all')}</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="w-48">
            <option value="all">{t('resources.table.skills')}: {t('common.all')}</option>
            {allSkills.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={utilizationFilter} onChange={(e) => setUtilizationFilter(e.target.value as UtilizationStatus | 'all')} className="w-48">
            <option value="all">{t('resources.table.utilization')}: {t('common.all')}</option>
            {(['underutilized', 'healthy', 'high', 'overloaded', 'critical'] as const).map((u) => (
              <option key={u} value={u}>
                {t(`utilization.${u}`)}
              </option>
            ))}
          </Select>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => (
            <button
              key={row.resource.id}
              onClick={() => navigate(`/resources/${row.resource.id}`)}
              className="rounded-[var(--radius-card)] border border-slate-200/70 bg-white p-4 text-start transition-colors hover:bg-slate-50/60"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold text-slate-800">{row.resource.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {row.resource.job_title} · {row.resource.department}
                  </p>
                </div>
                <Badge tone={utilizationTone[row.status]}>{t(`utilization.${row.status}`)}</Badge>
              </div>
              <ProgressBar value={row.utilization * 100} className="mb-2 h-1" barClassName={utilizationBarClass[row.status]} />
              <div className="mb-2 flex flex-wrap gap-1">
                {row.skills.slice(0, 3).map((s) => (
                  <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {s}
                  </span>
                ))}
                {row.skills.length > 3 && <span className="text-[10px] text-slate-400">+{row.skills.length - 3}</span>}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{Math.round(row.utilization * 100)}% {t('resources.table.utilization').toLowerCase()}</span>
                <span>{row.activeAssignments} {t('resourceProfile.assignments').toLowerCase()}</span>
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && <p className="py-10 text-center text-sm text-slate-400">{t('common.noData')}</p>}
      </div>
      <ResourceFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleCreate} departments={departments} />
    </AppShell>
  )
}
