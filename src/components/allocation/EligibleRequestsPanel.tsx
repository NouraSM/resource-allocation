import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/states'
import { useI18n } from '@/lib/i18n'
import type { OrgData } from '@/hooks/useOrgData'
import { isUnallocated } from '@/engine/dashboardMetrics'
import { isReviewStatus } from '@/lib/allocationDisplay'
import { priorityTone, statusTone } from '@/lib/statusDisplay'
import { formatDate } from '@/lib/utils'

export function EligibleRequestsPanel({ data, onSelect }: { data: OrgData; onSelect: (id: string) => void }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const eligible = useMemo(() => data.requests.filter((r) => r.status !== 'completed' && r.status !== 'cancelled'), [data.requests])
  const filtered = useMemo(
    () => (search.trim() ? eligible.filter((r) => r.title.toLowerCase().includes(search.trim().toLowerCase())) : eligible),
    [eligible, search],
  )

  if (eligible.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          title={t('allocationQueue.empty')}
          body={t('allocationQueue.emptyBody')}
          action={<Button onClick={() => navigate('/requests/new')}>{t('requests.newRequest')}</Button>}
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>{t('allocationQueue.title')}</CardTitle>
          <CardDescription>{t('allocationQueue.subtitle')}</CardDescription>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Input
            placeholder={t('allocationQueue.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-[200px]"
          />
          <Select value="" onChange={(e) => e.target.value && onSelect(e.target.value)} className="max-w-[220px]">
            <option value="">{t('allocationQueue.jumpTo')}</option>
            {eligible.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </Select>
        </div>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH>{t('requests.table.request')}</TH>
            <TH>{t('requests.table.priority')}</TH>
            <TH>{t('requests.table.deadline')}</TH>
            <TH>{t('requests.table.effort')}</TH>
            <TH>{t('newRequest.complexity')}</TH>
            <TH>{t('requestDetail.requiredSkills')}</TH>
            <TH>{t('common.status')}</TH>
            <TH>{t('allocationQueue.allocationState')}</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {filtered.map((r) => {
            const reqSkills = data.requestSkills.filter((rs) => rs.request_id === r.id)
            const unallocated = isUnallocated(r, data.assignments)
            const assignedCount = data.assignments.filter((a) => a.request_id === r.id && a.status !== 'cancelled').length
            const review = isReviewStatus(r.status)

            return (
              <TR key={r.id}>
                <TD className="max-w-[220px]">
                  <button onClick={() => onSelect(r.id)} className="font-medium text-slate-800 hover:underline">
                    {r.title}
                  </button>
                </TD>
                <TD>
                  <Badge tone={priorityTone[r.priority_level]}>{t(`priority.${r.priority_level}`)}</Badge>
                </TD>
                <TD className="whitespace-nowrap">{formatDate(r.requested_deadline, locale)}</TD>
                <TD className="whitespace-nowrap">
                  {r.estimated_effort_hours} {t('common.hours')}
                </TD>
                <TD className="capitalize">{r.complexity.replace('_', ' ')}</TD>
                <TD>
                  <div className="flex max-w-[180px] flex-wrap gap-1">
                    {reqSkills.slice(0, 3).map((rs) => {
                      const skill = data.skills.find((s) => s.id === rs.skill_id)
                      return (
                        <span key={rs.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {skill?.name}
                        </span>
                      )
                    })}
                    {reqSkills.length > 3 && <span className="text-[10px] text-slate-400">+{reqSkills.length - 3}</span>}
                  </div>
                </TD>
                <TD>
                  <Badge tone={statusTone[r.status]}>{t(`status.${r.status}`)}</Badge>
                </TD>
                <TD className="whitespace-nowrap">
                  <Badge tone={unallocated ? 'attention' : 'healthy'}>
                    {unallocated ? t('allocationQueue.unallocated') : `${assignedCount} ${t('allocationQueue.assignedLabel')}`}
                  </Badge>
                </TD>
                <TD>
                  <Button size="sm" variant={review ? 'secondary' : 'primary'} onClick={() => onSelect(r.id)}>
                    {review ? t('allocationQueue.reviewCta') : t('allocationQueue.generateCta')}
                    <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </Button>
                </TD>
              </TR>
            )
          })}
        </TBody>
      </Table>
      {filtered.length === 0 && <p className="p-6 text-center text-sm text-slate-400">{t('allocationQueue.noMatches')}</p>}
    </Card>
  )
}
