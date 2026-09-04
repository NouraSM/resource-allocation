import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useOrgData } from '@/hooks/useOrgData'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/states'
import { analyzeRequestWithAi } from '@/lib/ai'
import type { AiSuggestedSkill } from '@/lib/ai'
import { calculateUrgencyScore } from '@/engine/urgency'
import {
  DEPENDENCY_SCORE,
  PUBLIC_IMPACT_SCORE,
  STRATEGIC_IMPORTANCE_SCORE,
  YES_NO_SCORE,
  calculatePriorityScore,
  priorityLevelFromScore,
} from '@/engine/priority'
import type { DependencyOption, PublicImpactOption, StrategicImportanceOption, YesNoOption } from '@/engine/priority'
import { priorityTone } from '@/lib/statusDisplay'
import { formatNumber } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import type { Complexity } from '@/types/database'

interface SkillRow extends AiSuggestedSkill {
  skillId: string | null // null when the AI-suggested name doesn't match the org's skill catalog
}

export function NewRequest() {
  const { t, locale } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data, loading: dataLoading } = useOrgData()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [entity, setEntity] = useState('')
  const [requester, setRequester] = useState('')
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [deadline, setDeadline] = useState('')

  const [analyzing, setAnalyzing] = useState(false)
  const [aiUnavailable, setAiUnavailable] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [requestType, setRequestType] = useState('')
  const [complexity, setComplexity] = useState<Complexity>('medium')
  const [effortHours, setEffortHours] = useState(200)
  const [skillRows, setSkillRows] = useState<SkillRow[]>([])
  const [addSkillId, setAddSkillId] = useState('')

  const [strategic, setStrategic] = useState<StrategicImportanceOption>('medium')
  const [execSponsored, setExecSponsored] = useState<YesNoOption>('no')
  const [regulatory, setRegulatory] = useState<YesNoOption>('no')
  const [publicImpact, setPublicImpact] = useState<PublicImpactOption>('low')
  const [dependency, setDependency] = useState<DependencyOption>('none')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const urgencyScore = useMemo(() => {
    if (!deadline) return 0
    return calculateUrgencyScore(new Date(), new Date(deadline), data?.orgSettings.workingDays)
  }, [deadline, data])

  const priorityScore = useMemo(
    () =>
      calculatePriorityScore({
        urgencyScore,
        strategicImportance: STRATEGIC_IMPORTANCE_SCORE[strategic],
        executiveSponsorship: YES_NO_SCORE[execSponsored],
        regulatoryImportance: YES_NO_SCORE[regulatory],
        publicImpact: PUBLIC_IMPACT_SCORE[publicImpact],
        dependencyImpact: DEPENDENCY_SCORE[dependency],
      }),
    [urgencyScore, strategic, execSponsored, regulatory, publicImpact, dependency],
  )
  const priorityLevel = priorityLevelFromScore(priorityScore)

  async function handleAnalyze() {
    setAnalyzing(true)
    setAiUnavailable(false)
    const result = await analyzeRequestWithAi({ title, description })
    setAnalyzing(false)
    if (!result.ok) {
      setAiUnavailable(true)
      return
    }
    setRequestType(result.data.requestType)
    setComplexity(result.data.complexity)
    setEffortHours(Math.round((result.data.estimatedEffortHoursMin + result.data.estimatedEffortHoursMax) / 2))
    setAiSummary(result.data.summary)
    setSkillRows(
      result.data.suggestedSkills.map((s) => ({
        ...s,
        skillId: data?.skills.find((sk) => sk.name.toLowerCase() === s.name.toLowerCase())?.id ?? null,
      })),
    )
  }

  function addSkillManually() {
    if (!addSkillId || !data) return
    const skill = data.skills.find((s) => s.id === addSkillId)
    if (!skill || skillRows.some((r) => r.skillId === addSkillId)) return
    setSkillRows((rows) => [...rows, { name: skill.name, proficiency: 3, mandatory: false, skillId: skill.id }])
    setAddSkillId('')
  }

  const canSave = title.trim() && entity.trim() && requester.trim() && deadline && !saving

  async function handleSave() {
    if (!profile || !data || !canSave) return
    setSaving(true)
    setSaveError(null)

    const { data: inserted, error } = await supabase
      .from('work_requests')
      .insert({
        organization_id: profile.organization_id,
        title: title.trim(),
        description: description.trim(),
        requesting_entity: entity.trim(),
        requester_name: requester.trim(),
        request_type: requestType || null,
        received_date: receivedDate,
        requested_deadline: deadline,
        strategic_importance: STRATEGIC_IMPORTANCE_SCORE[strategic],
        executive_sponsorship: YES_NO_SCORE[execSponsored],
        regulatory_importance: YES_NO_SCORE[regulatory],
        public_impact: PUBLIC_IMPACT_SCORE[publicImpact],
        dependency_impact: DEPENDENCY_SCORE[dependency],
        urgency_score: urgencyScore,
        priority_score: priorityScore,
        priority_level: priorityLevel,
        estimated_effort_hours: effortHours,
        complexity,
        status: 'submitted',
        created_by: profile.id,
      })
      .select()
      .single()

    if (error || !inserted) {
      setSaveError(error?.message ?? 'Failed to create request')
      setSaving(false)
      return
    }

    const validSkillRows = skillRows.filter((r) => r.skillId)
    if (validSkillRows.length) {
      await supabase.from('request_skills').insert(
        validSkillRows.map((r) => ({
          organization_id: profile.organization_id,
          request_id: inserted.id,
          skill_id: r.skillId!,
          required_level: r.proficiency,
          importance_weight: r.mandatory ? 1.5 : 1,
          mandatory: r.mandatory,
        })),
      )
    }

    await logAudit({
      organizationId: profile.organization_id,
      userId: profile.id,
      action: 'request_created',
      entityType: 'work_request',
      entityId: inserted.id,
      newValue: { title: inserted.title, priority_level: inserted.priority_level, priority_score: inserted.priority_score },
    })

    navigate(`/requests/${inserted.id}`)
  }

  if (dataLoading) {
    return (
      <AppShell title={t('newRequest.title')}>
        <LoadingState />
      </AppShell>
    )
  }

  return (
    <AppShell title={t('newRequest.title')}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('newRequest.step1')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="title">{t('newRequest.titleLabel')}</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="description">{t('newRequest.descriptionLabel')}</Label>
                <Textarea id="description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="entity">{t('newRequest.entityLabel')}</Label>
                  <Input id="entity" value={entity} onChange={(e) => setEntity(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="requester">{t('newRequest.requesterLabel')}</Label>
                  <Input id="requester" value={requester} onChange={(e) => setRequester(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="received">{t('newRequest.receivedDateLabel')}</Label>
                  <Input id="received" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="deadline">{t('newRequest.deadlineLabel')}</Label>
                  <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
              </div>
              <Button variant="outline" onClick={handleAnalyze} disabled={analyzing || !title.trim()}>
                <Sparkles className="h-4 w-4" />
                {analyzing ? t('newRequest.analyzing') : t('newRequest.analyzeButton')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('newRequest.step2')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiUnavailable && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">{t('newRequest.aiUnavailable')}</p>
                  <p>{t('newRequest.aiUnavailableBody')}</p>
                </div>
              )}
              {aiSummary && <p className="rounded-md bg-brand-50 p-2 text-xs text-brand-700">{aiSummary}</p>}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="requestType">{t('newRequest.requestType')}</Label>
                  <Input id="requestType" value={requestType} onChange={(e) => setRequestType(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="complexity">{t('newRequest.complexity')}</Label>
                  <Select id="complexity" value={complexity} onChange={(e) => setComplexity(e.target.value as Complexity)}>
                    {(['low', 'medium', 'high', 'very_high'] as const).map((c) => (
                      <option key={c} value={c}>
                        {c.replace('_', ' ')}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="effort">{t('newRequest.estimatedEffort')}</Label>
                  <Input id="effort" type="number" min={0} value={effortHours} onChange={(e) => setEffortHours(Number(e.target.value))} />
                </div>
              </div>

              <div>
                <Label>{t('newRequest.skillsNeeded')}</Label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {skillRows.map((row, i) => (
                    <span key={`${row.name}-${i}`} className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${row.skillId ? 'border-slate-200 bg-white' : 'border-status-attention-bg bg-status-attention-bg text-status-attention'}`}>
                      {row.name}
                      <select
                        className="border-0 bg-transparent text-xs"
                        value={row.proficiency}
                        onChange={(e) =>
                          setSkillRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, proficiency: Number(e.target.value) } : r)))
                        }
                      >
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <option key={lvl} value={lvl}>
                            L{lvl}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={row.mandatory}
                          onChange={(e) => setSkillRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, mandatory: e.target.checked } : r)))}
                        />
                        {t('common.required')}
                      </label>
                      <button onClick={() => setSkillRows((rows) => rows.filter((_, idx) => idx !== i))} aria-label="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select value={addSkillId} onChange={(e) => setAddSkillId(e.target.value)} className="max-w-xs">
                    <option value="">{t('common.search')}…</option>
                    {(data?.skills ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <Button variant="secondary" size="sm" onClick={addSkillManually}>
                    {t('common.create')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('newRequest.step3')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t('newRequest.strategicImportance')}</Label>
                <Select value={strategic} onChange={(e) => setStrategic(e.target.value as StrategicImportanceOption)}>
                  {(['low', 'medium', 'high', 'critical'] as const).map((v) => (
                    <option key={v} value={v}>
                      {t(`priority.${v}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t('newRequest.executiveSponsored')}</Label>
                <Select value={execSponsored} onChange={(e) => setExecSponsored(e.target.value as YesNoOption)}>
                  <option value="no">{t('common.no')}</option>
                  <option value="yes">{t('common.yes')}</option>
                </Select>
              </div>
              <div>
                <Label>{t('newRequest.regulatoryDeadline')}</Label>
                <Select value={regulatory} onChange={(e) => setRegulatory(e.target.value as YesNoOption)}>
                  <option value="no">{t('common.no')}</option>
                  <option value="yes">{t('common.yes')}</option>
                </Select>
              </div>
              <div>
                <Label>{t('newRequest.publicImpact')}</Label>
                <Select value={publicImpact} onChange={(e) => setPublicImpact(e.target.value as PublicImpactOption)}>
                  {(['low', 'medium', 'high'] as const).map((v) => (
                    <option key={v} value={v}>
                      {t(`priority.${v}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t('newRequest.dependencies')}</Label>
                <Select value={dependency} onChange={(e) => setDependency(e.target.value as DependencyOption)}>
                  <option value="none">{t('newRequest.dependenciesNone')}</option>
                  <option value="some">{t('newRequest.dependenciesSome')}</option>
                  <option value="critical">{t('newRequest.dependenciesCritical')}</option>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('newRequest.calculatedPriority')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold text-brand-700">{formatNumber(priorityScore, locale, 1)}</p>
              <Badge tone={priorityTone[priorityLevel]} className="mt-2">
                {t(`priority.${priorityLevel}`)}
              </Badge>
              <p className="mt-3 text-xs text-slate-500">Urgency: {urgencyScore}/100 {!deadline && '(set a deadline)'}</p>
            </CardContent>
          </Card>

          {saveError && <p className="text-sm text-status-critical">{saveError}</p>}
          <Button className="w-full" disabled={!canSave} onClick={handleSave}>
            {saving ? t('common.loading') : t('newRequest.createButton')}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
