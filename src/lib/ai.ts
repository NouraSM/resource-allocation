import { supabase } from '@/lib/supabase'

// Client code never talks to an AI provider directly — it only calls a
// Supabase Edge Function, which holds the API key server-side (see
// supabase/functions/ai-analyze). If the function isn't deployed or no key
// is configured there, every call below fails gracefully and callers fall
// back to manual entry — the app never depends on AI being available.

export interface AiSuggestedSkill {
  name: string
  proficiency: number
  mandatory: boolean
}

export interface AiAnalyzeRequestOutput {
  requestType: string
  complexity: 'low' | 'medium' | 'high' | 'very_high'
  estimatedEffortHoursMin: number
  estimatedEffortHoursMax: number
  suggestedSkills: AiSuggestedSkill[]
  summary: string
}

export type AiResult<T> = { ok: true; data: T } | { ok: false; reason: 'not_configured' | 'error'; message?: string }

export async function analyzeRequestWithAi(input: { title: string; description: string }): Promise<AiResult<AiAnalyzeRequestOutput>> {
  try {
    const { data, error } = await supabase.functions.invoke<AiAnalyzeRequestOutput | { error: string }>('ai-analyze', { body: input })
    if (error) return { ok: false, reason: 'not_configured', message: error.message }
    if (data && 'error' in data) return { ok: false, reason: 'not_configured', message: data.error }
    if (!data) return { ok: false, reason: 'error', message: 'Empty response from AI analysis function.' }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, reason: 'not_configured', message: e instanceof Error ? e.message : 'AI analysis unavailable' }
  }
}

export interface AiCopilotAnswer {
  answer: string
}

export async function askCopilot(input: { question: string; context: Record<string, unknown> }): Promise<AiResult<AiCopilotAnswer>> {
  try {
    const { data, error } = await supabase.functions.invoke<AiCopilotAnswer | { error: string }>('ai-copilot', { body: input })
    if (error) return { ok: false, reason: 'not_configured', message: error.message }
    if (data && 'error' in data) return { ok: false, reason: 'not_configured', message: data.error }
    if (!data) return { ok: false, reason: 'error' }
    return { ok: true, data }
  } catch (e) {
    return { ok: false, reason: 'not_configured', message: e instanceof Error ? e.message : 'Copilot unavailable' }
  }
}
