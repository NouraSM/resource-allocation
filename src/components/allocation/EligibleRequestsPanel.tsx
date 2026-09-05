import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
            const expanded = expandedId === r.id

            return (
              <Fragment key={r.id}>
                <TR className="cursor-pointer" onClick={() => setExpandedId(expanded ? null : r.id)}>
                  <TD className="max-w-[240px]">
                    <div className="flex items-center gap-1.5">
                      {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect(r.id)
                        }}
                        className="truncate font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {r.title}
                      </button>
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={priorityTone[r.priority_level]}>{t(`priority.${r.priority_level}`)}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap">{formatDate(r.requested_deadline, locale)}</TD>
                  <TD>
                    <Badge tone={statusTone[r.status]}>{t(`status.${r.status}`)}</Badge>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {unallocated ? (
                      <Badge tone="attention">{t('allocationQueue.unallocated')}</Badge>
                    ) : (
                      <span className="text-sm text-slate-500">{`${assignedCount} ${t('allocationQueue.assignedLabel')}`}</span>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap">
                    <Button
                      size="sm"
                      variant={review ? 'secondary' : 'primary'}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(r.id)
                      }}
                    >
                      {review ? t('allocationQueue.reviewCta') : t('allocationQueue.generateCta')}
                      <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                    </Button>
                  </TD>
                </TR>
                {expanded && (
                  <TR className="bg-slate-50/60 hover:bg-slate-50/60">
                    <TD colSpan={6}>
                      <div className="flex flex-wrap gap-x-8 gap-y-2 py-1 text-xs text-slate-600">
                        <span>
                          <span className="text-slate-400">{t('newRequest.complexity')}: </span>
                          <span className="capitalize">{r.complexity.replace('_', ' ')}</span>
                        </span>
                        <span>
                          <span className="text-slate-400">{t('requests.table.effort')}: </span>
                          {r.estimated_effort_hours} {t('common.hours')}
                        </span>
                        <span className="flex flex-wrap items-center gap-1">
                          <span className="text-slate-400">{t('requestDetail.requiredSkills')}: </span>
                          {reqSkills.map((rs) => {
                            const skill = data.skills.find((s) => s.id === rs.skill_id)
                            return (
                              <span key={rs.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                {skill?.name}
                              </span>
                            )
                          })}
                        </span>
                      </div>
                    </TD>
                  </TR>
                )}
              </Fragment>
            )
          })}
        </TBody>
      </Table>
      {filtered.length === 0 && <p className="p-6 text-center text-sm text-slate-400">{t('allocationQueue.noMatches')}</p>}
    </Card>
  )
}
