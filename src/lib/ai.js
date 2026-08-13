import { CATEGORIES } from './analysis.js'

/* ==================================================================
   Optional live-model layer.
   Keys live in localStorage and requests go straight from the browser
   to the provider — no True Match server sits in the middle. That is a
   deliberate prototype trade-off, and the settings modal says so.
   ================================================================== */

export const PROVIDERS = {
  groq: {
    id: 'groq',
    name: 'Groq',
    hint: 'Free tier, very fast. Key starts with gsk_',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keysUrl: 'https://console.groq.com/keys',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', tag: 'recommended' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', tag: 'fastest' },
      { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B' },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B', tag: 'reasoning' },
    ],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    hint: 'Aggregator with free open-weight models. Key starts with sk-or-',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keysUrl: 'https://openrouter.ai/keys',
    models: [
      { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B Instruct', tag: 'recommended' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1', tag: 'reasoning' },
      { id: 'mistralai/mistral-nemo', label: 'Mistral Nemo', tag: 'free' },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom endpoint',
    hint: 'Any OpenAI-compatible /chat/completions URL — Ollama, vLLM, LM Studio, llama.cpp',
    url: '',
    keysUrl: '',
    models: [
      { id: 'deepseek-r1', label: 'deepseek-r1', tag: 'reasoning' },
      { id: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile' },
      { id: 'qwen/qwen-2.5-72b-instruct', label: 'qwen/qwen-2.5-72b-instruct' },
    ],
  },
}

export const DEFAULT_MODEL_BY_PROVIDER = {
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'qwen/qwen-2.5-72b-instruct',
  custom: 'deepseek-r1',
}

const SYSTEM_PROMPT = `You are a forensic linguistics analyst. You read a two-person chat transcript and identify indirect signals of deception in ONE participant's messages.

Return STRICT JSON only, no prose, no markdown fences:
{
  "summary": "two sentences, specific, no hedging boilerplate",
  "risk": 0-100,
  "flags": [
    {
      "category": "over_explaining" | "distancing" | "timeline" | "deflection",
      "severity": "low" | "medium" | "high",
      "quote": "the exact substring from the transcript",
      "reason": "why this is a signal, referencing the specific words"
    }
  ],
  "suggestions": [
    { "title": "short label", "line": "an exact message the user could send", "why": "the mechanism that makes it work" }
  ]
}

Rules: only cite text that literally appears in the transcript. Never accuse — describe signals and their strength. Maximum 10 flags and 3 suggestions.`

function transcript(messages, targetName, viewerName) {
  return messages
    .map((m) => {
      const who = m.from === 'target' ? targetName : viewerName
      const when = new Date(m.ts).toLocaleString()
      const body = m.text || `[${m.attachment?.kind || 'attachment'}]`
      return `[${when}] ${who}: ${body}`
    })
    .join('\n')
}

function stripFences(text) {
  return text
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim()
}

function extractJson(text) {
  const cleaned = stripFences(text)
  try {
    return JSON.parse(cleaned)
  } catch {
    // Reasoning models often wrap the object in commentary — take the outermost braces.
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('Model did not return JSON')
    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

export function resolveEndpoint(settings) {
  const provider = PROVIDERS[settings.provider] || PROVIDERS.groq
  const url = settings.provider === 'custom' ? settings.endpoint?.trim() : provider.url
  if (!url) throw new Error('No endpoint configured for the custom provider')
  return url
}

async function callModel(settings, messages, { signal, maxTokens = 1600 } = {}) {
  const url = resolveEndpoint(settings)
  const headers = { 'Content-Type': 'application/json' }
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`
  if (settings.provider === 'openrouter') headers['X-Title'] = 'True Match'

  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.2,
      max_tokens: maxTokens,
      stream: false,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 180)}` : ''}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from model')
  return content
}

/** Cheap round-trip used by the "Test connection" button. */
export async function testConnection(settings) {
  const started = performance.now()
  const content = await callModel(
    settings,
    [{ role: 'user', content: 'Reply with the single word: ready' }],
    { maxTokens: 16 },
  )
  return { ok: true, ms: Math.round(performance.now() - started), sample: content.trim().slice(0, 40) }
}

/**
 * Ask the configured model for a second opinion. Returns findings shaped like
 * the local engine's so the report can merge them; throws on any failure so the
 * caller can fall back to on-device results and say so in the UI.
 */
export async function runLiveAnalysis({ messages, targetId, targetName, viewerName, settings, signal }) {
  const tagged = messages.map((m) => ({ ...m, from: m.from === targetId ? 'target' : 'viewer' }))
  const body = transcript(tagged, targetName, viewerName)

  const content = await callModel(
    settings,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Participant under analysis: ${targetName}\nOther participant: ${viewerName}\n\nTRANSCRIPT\n${body}`,
      },
    ],
    { signal },
  )

  const parsed = extractJson(content)
  const flags = (Array.isArray(parsed.flags) ? parsed.flags : [])
    .filter((f) => CATEGORIES[f.category])
    .slice(0, 10)
    .map((f, i) => {
      // Anchor each model finding back to a real message where possible.
      const source = f.quote
        ? messages.find((m) => m.text && m.text.toLowerCase().includes(String(f.quote).toLowerCase().slice(0, 24)))
        : null
      return {
        id: `ai_${i}`,
        category: f.category,
        severity: ['low', 'medium', 'high'].includes(f.severity) ? f.severity : 'medium',
        messageId: source?.id ?? null,
        ts: source?.ts ?? Date.now(),
        headline: 'Live model finding',
        reason: String(f.reason || '').slice(0, 600),
        highlights: f.quote ? [String(f.quote).slice(0, 120)] : [],
        evidence: [],
        source: 'llm',
        meta: {},
      }
    })

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    risk: Number.isFinite(parsed.risk) ? Math.round(parsed.risk) : null,
    flags,
    suggestions: (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).slice(0, 3).map((s, i) => ({
      id: `ai_sug_${i}`,
      category: 'timeline',
      title: String(s.title || 'Model suggestion').slice(0, 80),
      line: String(s.line || '').slice(0, 300),
      why: String(s.why || '').slice(0, 400),
      source: 'llm',
    })),
  }
}
