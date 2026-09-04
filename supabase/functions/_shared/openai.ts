// Minimal OpenAI-compatible chat completion client. Works against
// api.openai.com or any compatible endpoint (set OPENAI_BASE_URL to point
// elsewhere). The API key never leaves this server-side function.

export function isAiConfigured(): boolean {
  return Boolean(Deno.env.get('OPENAI_API_KEY'))
}

export async function chatJson(params: { system: string; user: string; maxTokens?: number }): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return { ok: false, message: 'AI Assistant Not Configured' }

  const baseUrl = Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1'
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
        response_format: { type: 'json_object' },
        max_tokens: params.maxTokens ?? 600,
        temperature: 0.2,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, message: `AI provider error (${res.status}): ${text.slice(0, 300)}` }
    }
    const payload = await res.json()
    const content = payload?.choices?.[0]?.message?.content
    if (!content) return { ok: false, message: 'AI provider returned no content' }
    return { ok: true, data: JSON.parse(content) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'AI request failed' }
  }
}

export async function chatText(params: { system: string; user: string; maxTokens?: number }): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return { ok: false, message: 'AI Assistant Not Configured' }

  const baseUrl = Deno.env.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1'
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
        max_tokens: params.maxTokens ?? 300,
        temperature: 0.3,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, message: `AI provider error (${res.status}): ${text.slice(0, 300)}` }
    }
    const payload = await res.json()
    const content = payload?.choices?.[0]?.message?.content
    if (!content) return { ok: false, message: 'AI provider returned no content' }
    return { ok: true, text: content }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'AI request failed' }
  }
}
