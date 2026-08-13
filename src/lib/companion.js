import { LANGUAGE_BY_ID } from './languages.js'
import { resolveEndpoint } from './ai.js'

/* ==================================================================
   Zoya — the AI friend.

   Deliberately not a therapist and not an assistant. She texts like a
   close friend: short lines, code-switches into whatever language you
   used, asks a follow-up instead of delivering advice, and does not
   moralise. Without an API key she still answers, just from a small
   local bank, and says once that she is running offline.
   ================================================================== */

export const COMPANION = {
  id: 'ai',
  name: 'Zoya',
  initials: 'Z',
  tint: 'from-sky-400 to-indigo-600',
  about: 'Your friend who always picks up',
  isAI: true,
}

const SYSTEM_PROMPT = `You are Zoya, texting with a close friend. Not an assistant, not a therapist, not a coach.

How you text:
- Short. One to three lines. Real people do not send paragraphs.
- Match their language exactly. If they write Roman Urdu, reply in Roman Urdu. If they mix Urdu and English mid-sentence, mix it back. Never switch to formal language they did not use.
- Warm and casual. Light humour is fine. Emojis occasionally, not every message.
- Ask one real follow-up question when it fits. Be curious about them.
- If they are upset, sit with it first. Do not jump to fixing or to bullet points.
- Never lecture, never moralise, never say "I'm just an AI", never mention being a language model.
- No numbered lists, no headings, no markdown. Plain texting only.

If they talk about a partner or a fight, be on their side without inflaming it — a friend who listens, not one who eggs them on. Do not tell them to break up and do not accuse anyone.`

/** Offline replies. Vague on purpose — they must fit almost any message. */
const FALLBACK = [
  'achha? phir kya hua',
  'sun rahi hoon, batao',
  'hmm that sounds heavy. tum theek ho?',
  'aur phir? poori baat batao',
  'main hoon na. bolo kya chal raha hai',
  'that is a lot yaar 😕 kaisa feel ho raha hai',
  'okay wait, us ne exactly kya kaha?',
  'tell me more, I am listening',
]

const OFFLINE_NOTE =
  'yaar mera AI brain abhi offline hai — Settings mein Groq ka free key daal do to main properly baat kar sakungi 💜'

function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

/**
 * Ask the configured model for the next reply. History is capped because a
 * friend chat does not need the whole archive to sound present.
 */
export async function companionReply({ history, userName, language = 'auto', settings, signal }) {
  const url = resolveEndpoint(settings)
  const headers = { 'Content-Type': 'application/json' }
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`
  if (settings.provider === 'openrouter') headers['X-Title'] = 'True Match'

  const langHint =
    language && language !== 'auto'
      ? `\n\nThey usually text in ${LANGUAGE_BY_ID[language]?.label || language}. Match that.`
      : ''

  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.85,
      max_tokens: 220,
      stream: false,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\nTheir name is ${userName}.${langHint}` },
        ...history.slice(-16).map((m) => ({
          role: m.from === 'ai' ? 'assistant' : 'user',
          content: m.text,
        })),
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 140)}` : ''}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response')
  return stripThinking(content).slice(0, 600)
}

/** Used when there is no key, or when the request fails. */
export function offlineReply(history) {
  const alreadyExplained = history.some((m) => m.from === 'ai' && m.text === OFFLINE_NOTE)
  if (!alreadyExplained) return OFFLINE_NOTE
  return FALLBACK[Math.floor(Math.random() * FALLBACK.length)]
}

export const COMPANION_OPENERS = [
  'heyy 💜 kaisi ho? kya chal raha hai aaj kal',
  'hi! main Zoya. jo bhi mann mein hai bata sakti ho, main sun rahi hoon',
]
