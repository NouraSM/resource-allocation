// Supabase Edge Function: analyzes a work request's title/description and
// suggests request type, complexity, an effort range, and required skills.
// The AI ONLY produces suggestions here — the user must review them before
// they're saved, and the priority score itself is always computed by the
// deterministic engine on the client (src/engine/priority.ts), never by AI.

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { chatJson, isAiConfigured } from '../_shared/openai.ts'

const SYSTEM_PROMPT = `You are a request-intake assistant for a government consulting center.
Given a request title and description, respond with STRICT JSON only, matching this shape:
{
  "requestType": string,               // e.g. "Strategy Study", "Benchmarking", "Policy Study"
  "complexity": "low"|"medium"|"high"|"very_high",
  "estimatedEffortHoursMin": number,
  "estimatedEffortHoursMax": number,
  "suggestedSkills": [{ "name": string, "proficiency": number, "mandatory": boolean }], // proficiency 1-5, 3-6 skills
  "summary": string                    // one sentence explaining the reasoning
}
Do not include any text outside the JSON object.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!isAiConfigured()) {
    return jsonResponse({ error: 'AI Assistant Not Configured' }, 200)
  }

  let body: { title?: string; description?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400)
  }

  if (!body.title) {
    return jsonResponse({ error: 'A title is required to analyze a request.' }, 400)
  }

  const result = await chatJson({
    system: SYSTEM_PROMPT,
    user: `Title: ${body.title}\nDescription: ${body.description ?? ''}`,
  })

  if (!result.ok) {
    return jsonResponse({ error: result.message }, 200)
  }

  return jsonResponse(result.data, 200)
})
