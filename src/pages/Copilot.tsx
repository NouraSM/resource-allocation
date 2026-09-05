import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Sparkles, MessageSquareText } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { useOrgData } from '@/hooks/useOrgData'
import { LoadingState, ErrorState } from '@/components/ui/states'
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
      setMessages((m) => [...m, { role: 'assistant', text: computed.text, actions: computed.actions, aiPhrased: false }])
    }
    setSending(false)
  }

  if (loading) return <AppShell title={t('copilot.title')} subtitle={t('copilot.subtitle')}><LoadingState /></AppShell>
  if (error) return <AppShell title={t('copilot.title')} subtitle={t('copilot.subtitle')}><ErrorState message={error} onRetry={refetch} /></AppShell>

  return (
    <AppShell title={t('copilot.title')} subtitle={t('copilot.subtitle')}>
      <div className="mx-auto flex h-[calc(100vh-140px)] max-w-2xl flex-col">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
            <div>
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-brand-600" />
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t('copilot.emptyTitle')}</h2>
              <p className="mt-1.5 text-sm text-slate-500">{t('copilot.suggested')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="rounded-[var(--radius-control)] border border-slate-200/70 px-3.5 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto pe-1">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] rounded-[var(--radius-card)] px-4 py-2.5 text-sm',
                    m.role === 'user' ? 'bg-brand-50 text-slate-900' : 'bg-slate-100/60 text-slate-700',
                  )}
                >
                  {m.role === 'assistant' && (
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                      <MessageSquareText className="h-3 w-3" /> {t('app.name')} {m.aiPhrased ? '' : `· ${t('copilot.analysisMode')}`}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.actions.map((a) => (
                        <button
                          key={a.path}
                          onClick={() => navigate(a.path)}
                          className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition-colors hover:bg-white"
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
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend(input)
          }}
          className="mt-6 flex items-center gap-2 rounded-full border border-slate-200/70 bg-white p-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('copilot.placeholder')}
            disabled={sending}
            className="border-none bg-transparent px-3 py-2.5 text-[15px] focus:ring-0"
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()} className="shrink-0 rounded-full" aria-label={t('copilot.send')}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </AppShell>
  )
}
