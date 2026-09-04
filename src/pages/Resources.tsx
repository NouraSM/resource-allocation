import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useOrgData } from '@/hooks/useOrgData'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { computeResourceUtilizations } from '@/engine/dashboardMetrics'
import { utilizationTone } from '@/lib/statusDisplay'
import type { UtilizationStatus } from '@/engine/capacity'

export function Resources() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()

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
        <EmptyState title={t('resources.empty')} body={t('resources.emptyBody')} />
      </AppShell>
    )
  }

  return (
    <AppShell title={t('resources.title')} subtitle={t('resources.subtitle')}>
      <div className="space-y-4">
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
              className="rounded-lg border border-slate-200 bg-white p-4 text-start transition hover:border-brand-300 hover:shadow-sm"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{row.resource.full_name}</p>
                  <p className="text-xs text-slate-500">{row.resource.job_title}</p>
                </div>
                <Badge tone={utilizationTone[row.status]}>{t(`utilization.${row.status}`)}</Badge>
              </div>
              <p className="mb-2 text-xs text-slate-400">{row.resource.department}</p>
              <div className="mb-2 flex flex-wrap gap-1">
                {row.skills.slice(0, 4).map((s) => (
                  <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                    {s}
                  </span>
                ))}
                {row.skills.length > 4 && <span className="text-[10px] text-slate-400">+{row.skills.length - 4}</span>}
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
    </AppShell>
  )
}
