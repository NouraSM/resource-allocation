import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label, Select, Textarea } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'

export type ApprovalAction = 'approve' | 'modify' | 'reject'
export type ApprovalReasonCode = 'skill' | 'strategic' | 'continuity' | 'management' | 'availability' | 'other'

export function ApprovalDialog({
  open,
  action,
  onClose,
  onConfirm,
}: {
  open: boolean
  action: ApprovalAction
  onClose: () => void
  onConfirm: (reasonCode: ApprovalReasonCode | null, note: string) => void
}) {
  const { t } = useI18n()
  const [reasonCode, setReasonCode] = useState<ApprovalReasonCode>('management')
  const [note, setNote] = useState('')

  const titleKey = action === 'approve' ? 'approval.approveTitle' : action === 'modify' ? 'approval.modifyTitle' : 'approval.rejectTitle'
  const requiresReason = action !== 'approve'
  const firstFieldLabel = action === 'modify' ? t('approval.changeReason') : t('common.reason')
  const secondFieldLabel = action === 'modify' ? t('approval.notes') : t('common.reason')
  const confirmLabel = action === 'modify' ? t('approval.confirmChanges') : t(`common.${action}`)

  return (
    <Dialog open={open} onClose={onClose} title={t(titleKey)}>
      <div className="space-y-3">
        {requiresReason && (
          <div>
            <Label htmlFor="reason-code">{firstFieldLabel}</Label>
            <Select id="reason-code" value={reasonCode} onChange={(e) => setReasonCode(e.target.value as ApprovalReasonCode)}>
              <option value="skill">{t('approval.reasonSkill')}</option>
              <option value="strategic">{t('approval.reasonStrategic')}</option>
              <option value="continuity">{t('approval.reasonContinuity')}</option>
              <option value="management">{t('approval.reasonManagement')}</option>
              <option value="availability">{t('approval.reasonAvailability')}</option>
              <option value="other">{t('approval.reasonOther')}</option>
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="note">{secondFieldLabel} ({t('common.optional')})</Label>
          <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={action === 'reject' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm(requiresReason ? reasonCode : null, note.trim())
              setNote('')
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
