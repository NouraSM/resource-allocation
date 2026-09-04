import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useOrgData } from '@/hooks/useOrgData'
import { LoadingState } from '@/components/ui/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { CsvImportPanel } from '@/components/settings/CsvImportPanel'
import { resourcesTemplate, skillsTemplate, assignmentsTemplate } from '@/lib/importTemplates'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const STEPS = ['stepOrg', 'stepResources', 'stepSkills', 'stepAssignments', 'stepReady'] as const

export function SetupWizard() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { data, loading, refetch } = useOrgData()
  const [step, setStep] = useState(0)
  const [orgName, setOrgName] = useState('')

  if (loading || !data) {
    return (
      <AppShell title={t('setup.title')}>
        <LoadingState />
      </AppShell>
    )
  }

  async function saveOrgName() {
    if (!profile || !orgName.trim()) return setStep((s) => s + 1)
    await supabase.from('organizations').update({ name: orgName.trim() }).eq('id', profile.organization_id)
    await refetch()
    setStep((s) => s + 1)
  }

  return (
    <AppShell title={t('setup.title')}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          {STEPS.map((key, i) => (
            <div key={key} className="flex flex-1 items-center">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                  i < step ? 'border-status-healthy bg-status-healthy text-white' : i === step ? 'border-brand-600 text-brand-700' : 'border-slate-200 text-slate-300',
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={cn('mx-1 h-px flex-1', i < step ? 'bg-status-healthy' : 'bg-slate-200')} />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('setup.stepOrg')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="org-name">{t('common.name')}</Label>
                <Input id="org-name" defaultValue={data.org.name} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <Button onClick={saveOrgName}>{t('common.next')}</Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Add your consulting staff, one row per person. You can also add them individually later from Resources.</p>
            <CsvImportPanel template={resourcesTemplate} org={data} onImported={refetch} />
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>{t('common.back')}</Button>
              <Button onClick={() => setStep((s) => s + 1)}>{t('common.next')}</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Build your organization's skill catalog before matching resources against demand.</p>
            <CsvImportPanel template={skillsTemplate} org={data} onImported={refetch} />
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>{t('common.back')}</Button>
              <Button onClick={() => setStep((s) => s + 1)}>{t('common.next')}</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">If you're migrating from another system, import currently active assignments. Otherwise, skip this step.</p>
            <CsvImportPanel template={assignmentsTemplate} org={data} onImported={refetch} />
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>{t('common.back')}</Button>
              <Button onClick={() => setStep((s) => s + 1)}>{t('common.skip')} / {t('common.next')}</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('setup.stepReady')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1 text-sm text-slate-600">
                <li>{data.resources.length} resources</li>
                <li>{data.skills.length} skills</li>
                <li>{data.requests.length} work requests</li>
                <li>{data.assignments.length} assignments</li>
              </ul>
              <Button onClick={() => navigate('/')}>{t('common.finish')}</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
