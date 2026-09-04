import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'
import type { TeamMember } from '@/engine/teamBuilder'
import type { CandidateEvaluation } from '@/engine/teamBuilder'

export function ModifyTeamDialog({
  open,
  members,
  candidates,
  onClose,
  onSave,
}: {
  open: boolean
  members: TeamMember[]
  candidates: CandidateEvaluation[]
  onClose: () => void
  onSave: (members: TeamMember[]) => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<TeamMember[]>(members)
  const [addCandidateId, setAddCandidateId] = useState('')

  // reset the working copy whenever the dialog opens with a (possibly new) scenario
  useEffect(() => {
    if (open) setDraft(members)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const available = candidates.filter((c) => !draft.some((m) => m.resourceId === c.resource.id))

  function addCandidate() {
    const candidate = candidates.find((c) => c.resource.id === addCandidateId)
    if (!candidate) return
    setDraft((d) => [
      ...d,
      {
        resourceId: candidate.resource.id,
        fullName: candidate.resource.fullName,
        jobRole: 'contributor',
        allocationPercentage: 25,
        allocatedHours: Math.round(candidate.capacity.availableCapacityHours * 0.25),
        skillFitScore: candidate.skillMatch.score,
        currentUtilization: Math.round(candidate.capacity.utilization * 1000) / 10,
        projectedUtilization: Math.round(candidate.capacity.utilization * 1000) / 10,
      },
    ])
    setAddCandidateId('')
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('allocation.modifyTeam')} className="max-w-3xl">
      <div className="space-y-3">
        <div className="space-y-2">
          {draft.map((m, i) => (
            <div key={m.resourceId} className="flex items-center gap-2 rounded-md border border-slate-100 p-2 text-sm">
              <span className="flex-1 font-medium text-slate-700">{m.fullName}</span>
              <Select
                value={m.jobRole}
                onChange={(e) => setDraft((d) => d.map((row, idx) => (idx === i ? { ...row, jobRole: e.target.value as 'lead' | 'contributor' } : row)))}
                className="w-32"
              >
                <option value="lead">lead</option>
                <option value="contributor">contributor</option>
              </Select>
              <Input
                type="number"
                min={1}
                max={100}
                value={m.allocationPercentage}
                onChange={(e) => setDraft((d) => d.map((row, idx) => (idx === i ? { ...row, allocationPercentage: Number(e.target.value) } : row)))}
                className="w-20"
              />
              <span className="w-8 text-xs text-slate-400">%</span>
              <button onClick={() => setDraft((d) => d.filter((_, idx) => idx !== i))} aria-label="Remove" className="text-slate-400 hover:text-status-critical">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {draft.length === 0 && <p className="text-sm text-slate-400">{t('allocation.notFeasible')}</p>}
        </div>

        <div className="flex gap-2">
          <Select value={addCandidateId} onChange={(e) => setAddCandidateId(e.target.value)} className="max-w-xs">
            <option value="">{t('common.search')}…</option>
            {available.map((c) => (
              <option key={c.resource.id} value={c.resource.id}>
                {c.resource.fullName} ({c.soloFitScore.toFixed(0)})
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={addCandidate}>
            {t('common.create')}
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onSave(draft)}>{t('common.save')}</Button>
        </div>
      </div>
    </Dialog>
  )
}
