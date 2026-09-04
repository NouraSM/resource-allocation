// Supabase Edge Function: explains a deterministically-computed answer in
// natural language. The client (src/lib/copilotEngine.ts) always computes
// the actual numbers first — this function is only allowed to phrase the
// explanation from the JSON context it's given, never to invent figures.

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { chatText, isAiConfigured } from '../_shared/openai.ts'

const SYSTEM_PROMPT = `You are RA Copilot, an assistant embedded in a resource-allocation tool for a
government consulting center. You will be given a user's question and a JSON "context" object that
already contains the correct, pre-computed answer data. Write a concise (2-4 sentence), professional
answer using ONLY the numbers and facts present in the context. Never invent or estimate a number that
is not present in the context. If the context is empty or insufficient, say so plainly and suggest what
to ask instead.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!isAiConfigured()) {
    return jsonResponse({ error: 'AI Assistant Not Configured' }, 200)
  }

  let body: { question?: string; context?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400)
  }

  if (!body.question) {
    return jsonResponse({ error: 'A question is required.' }, 400)
  }

  const result = await chatText({
    system: SYSTEM_PROMPT,
    user: `Question: ${body.question}\nContext JSON: ${JSON.stringify(body.context ?? {})}`,
  })

  if (!result.ok) {
    return jsonResponse({ error: result.message }, 200)
  }

  return jsonResponse({ answer: result.text }, 200)
})
