import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Sparkles, MessageSquareText } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useOrgData } from '@/hooks/useOrgData'
import { LoadingState, ErrorState } from '@/components/ui/states'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { answerDeterministically } from '@/lib/copilotEngine'
import type { CopilotAction } from '@/lib/copilotEngine'
import { askCopilot } from '@/lib/ai'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  text: string
  actions?: CopilotAction[]
  aiPhrased?: boolean
}

const SUGGESTED = [
  'Who has capacity this week?',
  'Which projects are most at risk?',
  'Which employees are overloaded?',
  'Can we accept another urgent request this month?',
]

export function Copilot() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useOrgData()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [aiUnavailable, setAiUnavailable] = useState(false)

  async function handleSend(question: string) {
    if (!question.trim() || !data) return
    setMessages((m) => [...m, { role: 'user', text: question }])
    setInput('')
    setSending(true)

    const computed = answerDeterministically(question, data)
    const aiResult = await askCopilot({ question, context: computed.contextForAi })

    if (aiResult.ok) {
      setMessages((m) => [...m, { role: 'assistant', text: aiResult.data.answer, actions: computed.actions, aiPhrased: true }])
    } else {
      setAiUnavailable(true)
      setMessages((m) => [...m, { role: 'assistant', text: computed.text, actions: computed.actions, aiPhrased: false }])
    }
    setSending(false)
  }

  if (loading) return <AppShell title={t('copilot.title')} subtitle={t('copilot.subtitle')}><LoadingState /></AppShell>
  if (error) return <AppShell title={t('copilot.title')} subtitle={t('copilot.subtitle')}><ErrorState message={error} onRetry={refetch} /></AppShell>

  return (
    <AppShell title={t('copilot.title')} subtitle={t('copilot.subtitle')}>
      <div className="mx-auto flex h-[calc(100vh-140px)] max-w-3xl flex-col">
        {aiUnavailable && (
          <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">{t('copilot.notConfigured')}</p>
            <p>{t('copilot.notConfiguredBody')}</p>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto pe-1">
          {messages.length === 0 && (
            <Card className="p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <Sparkles className="h-4 w-4 text-brand-600" />
                {t('copilot.suggested')}
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </Card>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  m.role === 'user' ? 'bg-brand-700 text-white' : 'border border-slate-200 bg-white text-slate-700',
                )}
              >
                {m.role === 'assistant' && (
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <MessageSquareText className="h-3 w-3" /> {t('app.name')} {m.aiPhrased ? '' : `(${t('copilot.notConfigured')})`}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.actions.map((a) => (
                      <button
                        key={a.path}
                        onClick={() => navigate(a.path)}
                        className="rounded border border-brand-200 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-100"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(input)
          }}
          className="mt-3 flex gap-2"
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('copilot.placeholder')} disabled={sending} />
          <Button type="submit" disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
            {t('copilot.send')}
          </Button>
        </form>
      </div>
    </AppShell>
  )
}
