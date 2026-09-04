import { useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useOrgData } from '@/hooks/useOrgData'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { toCsv, downloadCsv } from '@/lib/csv'
import { importTemplates } from '@/lib/importTemplates'
import { CsvImportPanel } from '@/components/settings/CsvImportPanel'
import type { UserRole } from '@/types/database'
import { computeResourceUtilizations } from '@/engine/dashboardMetrics'

export function Settings() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const { data, loading, error, refetch } = useOrgData()

  const [orgName, setOrgName] = useState<string | null>(null)
  const [targetUtilization, setTargetUtilization] = useState<number | null>(null)
  const [overloadThreshold, setOverloadThreshold] = useState<number | null>(null)
  const [savingOrg, setSavingOrg] = useState(false)

  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCategory, setNewSkillCategory] = useState('general')

  if (loading) return <AppShell title={t('settings.title')}><LoadingState /></AppShell>
  if (error) return <AppShell title={t('settings.title')}><ErrorState message={error} onRetry={refetch} /></AppShell>
  if (!data) return null

  const name = orgName ?? data.org.name
  const target = targetUtilization ?? data.org.target_utilization
  const overload = overloadThreshold ?? data.org.overload_threshold

  async function saveOrgSettings() {
    if (!profile) return
    setSavingOrg(true)
    const oldValue = { name: data!.org.name, target_utilization: data!.org.target_utilization, overload_threshold: data!.org.overload_threshold }
    await supabase.from('organizations').update({ name, target_utilization: target, overload_threshold: overload }).eq('id', profile.organization_id)
    await logAudit({
      organizationId: profile.organization_id,
      userId: profile.id,
      action: 'organization_updated',
      entityType: 'organization',
      entityId: profile.organization_id,
      oldValue,
      newValue: { name, target_utilization: target, overload_threshold: overload },
    })
    setSavingOrg(false)
    refetch()
  }

  async function updateUserRole(userId: string, role: UserRole) {
    if (!profile) return
    await supabase.from('profiles').update({ role }).eq('id', userId)
    await logAudit({ organizationId: profile.organization_id, userId: profile.id, action: 'user_role_changed', entityType: 'profile', entityId: userId, newValue: { role } })
    refetch()
  }

  async function toggleUserActive(userId: string, active: boolean) {
    if (!profile) return
    await supabase.from('profiles').update({ active }).eq('id', userId)
    await logAudit({ organizationId: profile.organization_id, userId: profile.id, action: 'user_active_changed', entityType: 'profile', entityId: userId, newValue: { active } })
    refetch()
  }

  async function addSkill() {
    if (!profile || !newSkillName.trim()) return
    await supabase.from('skills').insert({ organization_id: profile.organization_id, name: newSkillName.trim(), category: newSkillCategory || 'general' })
    setNewSkillName('')
    refetch()
  }

  async function toggleSkillActive(skillId: string, active: boolean) {
    await supabase.from('skills').update({ active }).eq('id', skillId)
    refetch()
  }

  function exportResources() {
    downloadCsv(
      'resources.csv',
      toCsv(
        data!.resources.map((r) => ({ ...r })),
        ['employee_code', 'full_name', 'job_title', 'department', 'seniority_level', 'weekly_capacity_hours', 'active'],
      ),
    )
  }
  function exportRequests() {
    downloadCsv(
      'requests.csv',
      toCsv(
        data!.requests.map((r) => ({ ...r })),
        ['request_number', 'title', 'requesting_entity', 'priority_level', 'priority_score', 'status', 'requested_deadline', 'estimated_effort_hours'],
      ),
    )
  }
  function exportAssignments() {
    downloadCsv(
      'assignments.csv',
      toCsv(
        data!.assignments.map((a) => ({ ...a })),
        ['request_id', 'resource_id', 'assignment_role', 'allocation_percentage', 'allocated_hours', 'start_date', 'end_date', 'status'],
      ),
    )
  }
  function exportPortfolioSummary() {
    downloadCsv(
      'portfolio_summary.csv',
      toCsv(
        data!.requests.map((r) => ({ title: r.title, priority: r.priority_level, status: r.status, deadline: r.requested_deadline, effort: r.estimated_effort_hours })),
        ['title', 'priority', 'status', 'deadline', 'effort'],
      ),
    )
  }
  function exportCapacityView() {
    const today = new Date()
    const twoWeeksOut = new Date(today)
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)
    const rows = computeResourceUtilizations(data!.engineResources, data!.resources, data!.orgSettings, data!.engineAssignments, data!.engineAvailability, today, twoWeeksOut)
    downloadCsv(
      'capacity_view.csv',
      toCsv(
        rows.map((r) => ({ name: r.resource.full_name, department: r.resource.department, utilization_pct: Math.round(r.utilization * 100), available_hours_next_2_weeks: Math.round(r.availableCapacityHours) })),
        ['name', 'department', 'utilization_pct', 'available_hours_next_2_weeks'],
      ),
    )
  }

  return (
    <AppShell title={t('settings.title')}>
      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">{t('settings.organization')}</TabsTrigger>
          <TabsTrigger value="users">{t('settings.users')}</TabsTrigger>
          <TabsTrigger value="skills">{t('settings.skillsCatalog')}</TabsTrigger>
          <TabsTrigger value="data">{t('settings.dataImport')}</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-4">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>{t('settings.organization')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="org-name">{t('common.name')}</Label>
                <Input id="org-name" value={name} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="target-util">{t('settings.thresholds')}: Target Utilization ({Math.round(target * 100)}%)</Label>
                <Input id="target-util" type="range" min={0.5} max={1} step={0.01} value={target} onChange={(e) => setTargetUtilization(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="overload-threshold">Overload Threshold ({Math.round(overload * 100)}%)</Label>
                <Input id="overload-threshold" type="range" min={0.5} max={1.1} step={0.01} value={overload} onChange={(e) => setOverloadThreshold(Number(e.target.value))} />
              </div>
              <Button onClick={saveOrgSettings} disabled={savingOrg}>
                {savingOrg ? t('common.loading') : t('common.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>{t('common.name')}</TH>
                  <TH>{t('common.email')}</TH>
                  <TH>{t('common.role')}</TH>
                  <TH>{t('common.status')}</TH>
                </TR>
              </THead>
              <TBody>
                {data.profiles.map((p) => (
                  <TR key={p.id}>
                    <TD>{p.full_name}</TD>
                    <TD>{p.email}</TD>
                    <TD>
                      <Select value={p.role} onChange={(e) => updateUserRole(p.id, e.target.value as UserRole)} className="w-44">
                        {(['admin', 'resource_manager', 'consultant', 'executive_viewer'] as const).map((r) => (
                          <option key={r} value={r}>
                            {t(`roles.${r}`)}
                          </option>
                        ))}
                      </Select>
                    </TD>
                    <TD>
                      <button onClick={() => toggleUserActive(p.id, !p.active)}>
                        <Badge tone={p.active ? 'healthy' : 'neutral'}>{p.active ? t('common.yes') : t('common.no')}</Badge>
                      </button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <Card className="mb-4 flex flex-wrap items-end gap-2 p-3">
            <div>
              <Label htmlFor="new-skill">New skill</Label>
              <Input id="new-skill" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-skill-category">Category</Label>
              <Input id="new-skill-category" value={newSkillCategory} onChange={(e) => setNewSkillCategory(e.target.value)} />
            </div>
            <Button size="sm" onClick={addSkill}>
              <Plus className="h-4 w-4" /> {t('common.create')}
            </Button>
          </Card>
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>{t('common.name')}</TH>
                  <TH>Category</TH>
                  <TH>{t('common.status')}</TH>
                </TR>
              </THead>
              <TBody>
                {data.skills.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.name}</TD>
                    <TD>{s.category}</TD>
                    <TD>
                      <button onClick={() => toggleSkillActive(s.id, !s.active)}>
                        <Badge tone={s.active ? 'healthy' : 'neutral'}>{s.active ? t('common.yes') : t('common.no')}</Badge>
                      </button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="mt-4 space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">{t('common.export')}</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={exportResources}><Download className="h-4 w-4" /> Resources</Button>
              <Button variant="secondary" size="sm" onClick={exportRequests}><Download className="h-4 w-4" /> Requests</Button>
              <Button variant="secondary" size="sm" onClick={exportAssignments}><Download className="h-4 w-4" /> Assignments</Button>
              <Button variant="secondary" size="sm" onClick={exportPortfolioSummary}><Download className="h-4 w-4" /> Portfolio Summary</Button>
              <Button variant="secondary" size="sm" onClick={exportCapacityView}><Download className="h-4 w-4" /> Capacity View</Button>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">{t('common.import')}</h3>
            {importTemplates.map((tpl) => (
              <CsvImportPanel key={tpl.key} template={tpl} org={data} onImported={refetch} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
