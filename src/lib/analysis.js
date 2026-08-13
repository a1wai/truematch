import { DAY, MINUTE, clamp, dayKey, duration, startOfDay } from './utils.js'

/* ==================================================================
   True Match — on-device deception heuristics
   ------------------------------------------------------------------
   Everything in this file is deterministic and explainable: each flag
   carries the exact substring that triggered it and a plain-English
   reason. A live LLM (see lib/ai.js) can layer extra findings on top,
   but this engine always runs so the report works fully offline.
   ================================================================== */

export const CATEGORIES = {
  over_explaining: {
    id: 'over_explaining',
    emoji: '🚩',
    label: 'Over-Explaining & Unnecessary Detail',
    short: 'Over-Explaining',
    blurb: 'Volunteered detail nobody asked for — truthful accounts are usually shorter under pressure.',
    accent: 'amber',
  },
  distancing: {
    id: 'distancing',
    emoji: '🚩',
    label: 'Distancing Language',
    short: 'Distancing',
    blurb: 'Named people quietly become anonymous ones; ownership drains out of the sentence.',
    accent: 'violet',
  },
  timeline: {
    id: 'timeline',
    emoji: '🚩',
    label: 'Timeline & Fact Contradictions',
    short: 'Contradictions',
    blurb: 'Two statements about the same window of time that cannot both be true.',
    accent: 'rose',
  },
  deflection: {
    id: 'deflection',
    emoji: '🚩',
    label: 'Deflection & Emotional Manipulation',
    short: 'Deflection',
    blurb: 'The question gets reframed as your problem instead of being answered.',
    accent: 'sky',
  },
}

export const CATEGORY_ORDER = ['timeline', 'over_explaining', 'distancing', 'deflection']

export const TIMEFRAMES = [
  { id: '24h', label: 'Last 24 Hours', ms: DAY },
  { id: '7d', label: 'Last 7 Days', ms: 7 * DAY },
  { id: 'all', label: 'All Chat History', ms: Infinity },
]

const SEVERITY_WEIGHT = { high: 3.2, medium: 1.8, low: 0.9 }

/* ------------------------------------------------------------------ */
/* Over-explaining                                                     */
/* ------------------------------------------------------------------ */

const JUSTIFIERS = [
  // English
  /\bbecause\b/gi,
  /\bthe reason\b/gi,
  /\banyway\b/gi,
  /\bhonestly\b/gi,
  /\bto be honest\b/gi,
  /\bliterally\b/gi,
  /\bbasically\b/gi,
  /\bactually\b/gi,
  /\bi swear\b/gi,
  /\bat all\b/gi,
  /\bwhich is (also )?why\b/gi,
  /\bevery single\b/gi,
  /\bso i (had|have|put|took|went)\b/gi,
  /\bthen i\b/gi,
  // Roman Urdu / Hindi — the same padding, different alphabet
  /\bkyun\s?ke\b/gi,
  /\bkyunki\b/gi,
  /\bkyuki\b/gi,
  /\bis\s?i?\s?liye\b/gi,
  /\bwaise bhi\b/gi,
  /\bkhair\b/gi,
  /\bmatlab\b/gi,
  /\bsach mein\b/gi,
  /\byaqeen\b/gi,
  /\bbas itn[ai]\b/gi,
  /\bphir (main|maine|mein)\b/gi,
  /\buske baad\b/gi,
  /\bdar\s?asal\b/gi,
  // Indonesian / Turkish / Romanian connectives
  /\bkarena\b/gi,
  /\bsoalnya\b/gi,
  /\bpokoknya\b/gi,
  /\bcunku\b/gi,
  /\bçünkü\b/gi,
  /\byani\b/gi,
  /\bpentru ca\b/gi,
  /\bde fapt\b/gi,
]

const SPECIFICS = [
  /\b\d{1,2}[:.]\d{2}\b/g,
  /\b\d{1,2}\s?(am|pm)\b/gi,
  /\b\d{1,2}(:\d{2})?\s*baje\b/gi,
  /\b(exactly|precisely|sirf|bilkul|theek)\b/gi,
  /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,
  /\b(ek|do|teen|char|paanch|das|teesri|doosri)\b/gi,
  /\b\d+\b/g,
]

function countMatches(text, patterns) {
  const hits = []
  for (const re of patterns) {
    const found = text.match(re)
    if (found) hits.push(...found)
  }
  return hits
}

function words(text) {
  return text.trim().split(/\s+/).filter(Boolean)
}

function isQuestion(text) {
  return /\?\s*$/.test(text.trim())
}

function detectOverExplaining(msgs, ctx) {
  const flags = []
  for (const m of msgs) {
    if (!m.text) continue
    const wc = words(m.text).length
    const justifiers = countMatches(m.text, JUSTIFIERS)
    const specifics = countMatches(m.text, SPECIFICS)
    const prev = ctx.prevFromOther.get(m.id)
    const answersShortQuestion = prev && isQuestion(prev.text) && words(prev.text).length <= 12

    let score = 0
    const reasons = []
    if (wc >= 55) {
      score += 2
      reasons.push(`${wc} words in a single message`)
    } else if (wc >= 32) {
      score += 1
      reasons.push(`${wc} words in a single message`)
    }
    if (justifiers.length >= 5) {
      score += 2
      reasons.push(`${justifiers.length} justification markers ("${justifiers.slice(0, 3).join('", "')}")`)
    } else if (justifiers.length >= 3) {
      score += 1
      reasons.push(`${justifiers.length} justification markers ("${justifiers.slice(0, 2).join('", "')}")`)
    }
    if (specifics.length >= 2) {
      score += 1
      reasons.push(`${specifics.length} unprompted specifics (times, counts, amounts)`)
    }
    if (answersShortQuestion && wc >= 25) {
      score += 1
      reasons.push(`answers a ${words(prev.text).length}-word question with ${wc} words`)
    }
    if (score < 3) continue

    flags.push({
      id: `oe_${m.id}`,
      category: 'over_explaining',
      severity: score >= 4 ? 'high' : 'medium',
      messageId: m.id,
      ts: m.ts,
      headline: 'Unprompted narrative detail',
      reason: `Detail was volunteered, not requested: ${reasons.join('; ')}. Rehearsed accounts pad the record to sound verifiable; honest ones rarely need the padding.`,
      highlights: [...new Set([...justifiers, ...specifics])].slice(0, 8),
      evidence:
        prev && isQuestion(prev.text)
          ? [{ messageId: prev.id, ts: prev.ts, note: 'What was actually asked', fromOther: true }]
          : [],
      meta: { words: wc, justifiers: justifiers.length, specifics: specifics.length },
    })
  }
  return flags
}

/* ------------------------------------------------------------------ */
/* Distancing language                                                 */
/* ------------------------------------------------------------------ */

const GENERIC_REFERENTS = [
  // English
  { re: /\bthat person\b/i, label: 'that person' },
  { re: /\bthe person\b/i, label: 'the person' },
  { re: /\ba person\b/i, label: 'a person' },
  { re: /\bsomeone from (the )?(team|work|the office|there)\b/i, label: 'someone from work' },
  { re: /\bsomeone\b/i, label: 'someone' },
  { re: /\ba colleague\b/i, label: 'a colleague' },
  { re: /\bthis (guy|girl|woman|man|person)\b/i, label: 'this guy/girl' },
  { re: /\bsome people\b/i, label: 'some people' },
  { re: /\bwhoever\b/i, label: 'whoever' },
  { re: /\bnot important who\b/i, label: 'not important who' },
  { re: /\bthe guy beside me\b/i, label: 'the guy beside me' },
  // Roman Urdu / Hindi. Bare "koi" is excluded on purpose — "koi baat nahi"
  // means "no problem" and would flag half the thread.
  { re: /\boffice (ka|ke|ki) kis[iy]\b/i, label: 'office ka koi' },
  { re: /\boffice (ka|ki) koi\b/i, label: 'office ka koi' },
  { re: /\bkis[iy] band[ae]\b/i, label: 'kisi banday' },
  { re: /\bek band[ae]\b/i, label: 'ek banda' },
  { re: /\bwo(h)? band[ae]\b/i, label: 'wo banda' },
  { re: /\bkoi (tha|thi)\b/i, label: 'koi tha' },
  { re: /\bkis[iy] ne\b/i, label: 'kisi ne' },
  { re: /\boffice ka colleague\b/i, label: 'office ka colleague' },
  { re: /\bek dost\b/i, label: 'ek dost' },
  { re: /\bimportant nahi ke kaun\b/i, label: 'kaun tha ye important nahi' },
  { re: /\bfarq (nahi )?parta hai kaun\b/i, label: 'kaun tha farq nahi parta' },
  // Indonesian / Turkish / Romanian
  { re: /\bteman kantor\b/i, label: 'teman kantor' },
  { re: /\bseseorang\b/i, label: 'seseorang' },
  { re: /\bbiri(si)?\b/i, label: 'birisi' },
  { re: /\bcineva\b/i, label: 'cineva' },
]

/**
 * A name introduced with a relationship is the strongest anchor — "my friend
 * Sam", "mera dost Kamran", "meri cousin Ayesha".
 */
const QUALIFIED_NAME =
  /\b(?:[Mm]y |[Oo]ur )?(?:friend|buddy|mate|coworker|co-worker|colleague|sister|brother|neighbour|neighbor|boss)\s+([A-Z][a-z]+)\b|\b[MmAa](?:era|eri|ere|pna|pni)\s+(?:dost|cousin|bhai|behen|behan|friend|colleague)\s+([A-Z][a-z]+)\b/
/** A bare first name mentioned mid-sentence, e.g. "…and Sam said…". */
const BARE_NAME = /([A-Z][a-z]{2,})\b(?=\s+(?:from|said|says|and|was|is|needs|wanted))/
const NOT_NAMES = new Set([
  'You', 'We', 'They', 'She', 'That', 'This', 'The', 'And', 'But', 'Why', 'What', 'Who',
  'When', 'Where', 'How', 'Yes', 'Nope', 'Not', 'Sorry', 'Just', 'Can', 'Will', 'Look',
  'Morning', 'Back', 'Which', 'Does', 'After', 'Both', 'Everything', 'Someone', 'Nothing',
])

/** A capitalised word only counts as a name mid-sentence and outside the stoplist. */
function findBareName(text) {
  const m = text.match(BARE_NAME)
  if (!m || m.index === 0 || NOT_NAMES.has(m[1])) return null
  return m
}

function detectDistancing(msgs) {
  const flags = []
  const history = []
  let lastGeneric = null
  let driftCount = 0

  for (const m of msgs) {
    if (!m.text) continue
    const qualified = m.text.match(QUALIFIED_NAME)
    const bare = qualified ? null : findBareName(m.text)
    if (qualified) history.push({ msg: m, name: qualified[1] || qualified[2], qualified: true })
    else if (bare) history.push({ msg: m, name: bare[1], qualified: false })

    const hit = GENERIC_REFERENTS.find((g) => g.re.test(m.text))
    if (!hit) continue

    const earlier = history.filter((h) => h.msg.ts < m.ts)
    const priorNamed = [...earlier].reverse().find((h) => h.qualified) || earlier[earlier.length - 1]
    const relabel =
      lastGeneric && lastGeneric.label !== hit.label && m.ts - lastGeneric.ts < 3 * DAY
        ? lastGeneric
        : null

    let severity = 'low'
    let reason = ''
    const evidence = []

    if (priorNamed) {
      driftCount += 1
      severity = driftCount <= 3 ? 'high' : 'medium'
      reason = `People in this thread used to arrive with names attached ("${priorNamed.name}"); this referent is kept anonymous as "${hit.label}". Dropping the name is how speakers put distance between themselves and a person they would rather you did not ask about.`
      evidence.push({
        messageId: priorNamed.msg.id,
        ts: priorNamed.msg.ts,
        note: `Named referent: "${priorNamed.name}"`,
      })
    } else if (relabel) {
      severity = 'high'
      reason = `The same referent was called "${lastGeneric.label}" and is now "${hit.label}". A shifting label for one person means the description is being generated on the spot rather than recalled.`
      evidence.push({
        messageId: lastGeneric.messageId,
        ts: lastGeneric.ts,
        note: `Earlier label: "${lastGeneric.label}"`,
      })
    } else {
      severity = 'medium'
      reason = `Anonymous referent "${hit.label}" used where a name would be natural. Vagueness here is a choice — the name exists, it just is not being said.`
    }

    const matched = m.text.match(new RegExp(hit.re.source, 'i'))
    flags.push({
      id: `ds_${m.id}`,
      category: 'distancing',
      severity,
      messageId: m.id,
      ts: m.ts,
      headline: 'Named person became anonymous',
      reason,
      highlights: matched ? [matched[0]] : [hit.label],
      evidence,
      meta: { label: hit.label },
    })

    lastGeneric = { label: hit.label, ts: m.ts, messageId: m.id }
  }
  return flags
}

/* ------------------------------------------------------------------ */
/* Timeline & fact contradictions                                      */
/* ------------------------------------------------------------------ */

const LOCATION_RULES = [
  {
    value: 'the office',
    label: 'at the office / working late',
    labelLocal: 'office mein / late tak kaam',
    re: /\b(?:at|in) the office\b|\bat my desk\b|\bat work\b|\bstayed late\b|\bstuck at (?:the )?office\b|\boffice (?:mein|me|se|par)\b|\blate tak ruk[aiy]\b|\bkaam par\b|\bofiste\b|\bdi kantor\b|\bla birou\b/i,
  },
  {
    value: 'helping someone move',
    label: 'helping someone move / shifting',
    labelLocal: 'kisi ki shifting mein madad',
    re: /\bhelp(?:ing|ed)?\b[^.?!]{0,45}\b(?:move|moving|couch|sofa|desk|furniture|carry)\b|\bsaman\b[^.?!]{0,30}\b(?:shift|pahuncha|utha|le gaya)\b|\bshift ho raha\b|\bmadad kar raha\b|\bshifting\b/i,
  },
  {
    value: 'a cafe or bar',
    label: 'at the cafe / bar',
    labelLocal: 'cafe ya bahar',
    re: /\bkelso'?s\b|\bat the bar\b|\bstopped in\b|\b(?:one|a|second|another) drink\b|\bcafe\b|\bchai peene\b|\bcoffee (?:peene|pi)\b|\bbahar (?:tha|thi)\b/i,
  },
  {
    value: 'home',
    label: 'at home',
    labelLocal: 'ghar par',
    re: /\b(?:straight|went|came|got|back) home\b|\bat home\b|\bseedha ghar\b|\bghar (?:aa gaya|aa gayi|pe hi|pe tha|pe thi|par tha|par thi|mein tha|mein thi)\b|\bevde\b|\bdi rumah\b|\bacasa\b/i,
  },
  { value: 'the gym', label: 'at the gym', labelLocal: 'gym mein', re: /\bgym\b/i },
  {
    value: "a relative's place",
    label: "at a relative's place",
    labelLocal: 'rishtedaar ke ghar',
    re: /\bmy sister'?s\b|\b[A-Z][a-z]+ ke ghar\b|\b(?:cousin|behen|behan|bhai|khala|phupo) ke ghar\b/i,
  },
]

/**
 * Only genuinely mutually exclusive pairs are listed. "Office" then "home" is a
 * normal sequence, not a contradiction, so pairs like that are deliberately absent.
 */
const CONFLICTS = new Set(
  [
    ['the office', 'helping someone move'],
    ['the office', 'a cafe or bar'],
    ['home', 'a cafe or bar'],
    ['home', 'helping someone move'],
    ['the gym', "a relative's place"],
    ['the office', 'the gym'],
    ['the office', "a relative's place"],
    ['home', "a relative's place"],
    ['the gym', 'a cafe or bar'],
  ].map((p) => p.slice().sort().join('|')),
)

const END_TIME =
  /\b(?:till|til|until|leaving|left|out of there|home by|back by|finished)\b[^.?!]{0,24}?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i

/** "11 baje tak", "9:30 baje nikla" — the Roman Urdu/Hindi way of pinning a time. */
const END_TIME_ROMAN =
  /\b(\d{1,2})(?::(\d{2}))?\s*baje\b(?:\s*(?:tak|se))?(?=[^.?!]{0,40}\b(?:tak|nikl|rahunga|rahungi|ruk|aa gaya|aa gayi|gaya|gayi|band)\w*)/i

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Negation should cancel a claim. English puts it before the phrase ("not the
 * gym"); Urdu, Hindi and Turkish put it after ("ghar pe nahi thi", "evde
 * degildim"), so both sides of the match are checked.
 */
function isNegated(text, index, length = 0) {
  const before = text.slice(Math.max(0, index - 22), index).toLowerCase()
  if (/\b(not|never|wasn'?t|weren'?t|didn'?t|isn'?t|no)\b[\s,—-]*$|\bnot\b/.test(before)) return true
  const after = text.slice(index + length, index + length + 14).toLowerCase()
  return /^[^.?!,]{0,10}\b(nahi|nahin|nai|na|degil|değil|bukan|nu)\b/.test(after)
}

/** Which calendar day is this message talking about? */
function referencedDay(msg) {
  const lower = msg.text.toLowerCase()
  const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(lower))
  if (wd >= 0) {
    // Walk backwards from the message date to the most recent matching weekday.
    let cursor = startOfDay(msg.ts)
    for (let i = 0; i < 8; i++) {
      if (new Date(cursor).getDay() === wd) return dayKey(cursor)
      cursor -= DAY
    }
  }
  if (/\b(yesterday|last night)\b/.test(lower)) return dayKey(msg.ts - DAY)
  return dayKey(msg.ts)
}

function extractClaims(msg) {
  const claims = []
  if (!msg.text || isQuestion(msg.text)) return claims
  const when = referencedDay(msg)

  for (const rule of LOCATION_RULES) {
    const m = msg.text.match(rule.re)
    if (!m || isNegated(msg.text, m.index, m[0].length)) continue
    claims.push({
      key: 'location',
      value: rule.value,
      label: rule.label,
      labelLocal: rule.labelLocal,
      when,
      msg,
      quote: m[0],
    })
  }

  const t = msg.text.match(END_TIME) || msg.text.match(END_TIME_ROMAN)
  if (t && !isNegated(msg.text, t.index, t[0].length)) {
    let h = Number(t[1])
    const mins = Number(t[2] || 0)
    const mer = (t[3] || '').toLowerCase()
    if (mer === 'pm' && h < 12) h += 12
    else if (mer === 'am' && h === 12) h = 0
    else if (!mer && h <= 11) h += 12 // evening context throughout this thread
    const value = h * 60 + mins
    claims.push({
      key: 'endTime',
      value,
      label: `left / stayed until ${String(h % 24).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
      when,
      msg,
      quote: t[0],
    })
  }
  return claims
}

function conflicts(key, a, b) {
  if (key === 'endTime') return Math.abs(a - b) >= 60
  return CONFLICTS.has([a, b].slice().sort().join('|'))
}

/**
 * Contradictions are computed over the *whole* history, then filtered so that
 * the newer of the two statements falls inside the selected timeframe — that is
 * what makes "conflicting details between older and newer messages" work.
 */
function detectContradictions(allMsgs, windowStart) {
  const claims = allMsgs.flatMap(extractClaims)
  const buckets = new Map()
  for (const c of claims) {
    const k = `${c.when}|${c.key}`
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(c)
  }

  const candidates = []
  for (const [, group] of buckets) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        if (a.msg.id === b.msg.id) continue // one sentence describing a sequence
        if (a.value === b.value) continue
        if (!conflicts(a.key, a.value, b.value)) continue
        const [earlier, later] = a.msg.ts <= b.msg.ts ? [a, b] : [b, a]
        candidates.push({ earlier, later, key: a.key })
      }
    }
  }

  candidates.sort((x, y) => x.later.msg.ts - y.later.msg.ts)

  const seen = new Set()
  const flags = []
  for (const c of candidates) {
    if (c.later.msg.ts < windowStart) continue
    const sig = `${c.later.when}|${c.key}|${[String(c.earlier.value), String(c.later.value)].sort().join('|')}`
    if (seen.has(sig)) continue
    seen.add(sig)

    const said = (ts) => new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' })
    const [yy, mm, dd] = c.later.when.split('-').map(Number)
    const subjectDate = new Date(yy, mm - 1, dd)
    const subject = subjectDate.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
    const subjectShort = subjectDate.toLocaleDateString([], { weekday: 'long' })

    flags.push({
      id: `tl_${c.earlier.msg.id}_${c.later.msg.id}_${c.key}_${String(c.later.value).slice(0, 6)}`,
      category: 'timeline',
      severity: c.key === 'endTime' ? 'medium' : 'high',
      messageId: c.later.msg.id,
      ts: c.later.msg.ts,
      headline: `Contradiction about ${subject}`,
      reason:
        c.key === 'endTime'
          ? `Two different departure times are given for ${subject}: "${c.earlier.quote}" and later "${c.later.quote}" — a gap of ${duration(Math.abs(c.later.value - c.earlier.value) * MINUTE)}. Times drift when they are being reconstructed rather than remembered.`
          : `Both statements describe ${subject} and they cannot both be true: "${c.earlier.label}" — said ${said(c.earlier.msg.ts)} — versus "${c.later.label}", said ${said(c.later.msg.ts)}. One evening cannot hold both accounts.`,
      highlights: [c.later.quote],
      evidence: [
        {
          messageId: c.earlier.msg.id,
          ts: c.earlier.msg.ts,
          note: `Original claim: ${c.earlier.label}`,
        },
      ],
      meta: { subject, subjectShort, key: c.key, from: c.earlier.label, to: c.later.label },
    })
  }
  return flags
}

/* ------------------------------------------------------------------ */
/* Deflection & emotional manipulation                                 */
/* ------------------------------------------------------------------ */

const DEFLECTIONS = [
  {
    re: /\b(you'?re|your) overthinking\b|\boverthinking (this|it)\b/i,
    severity: 'high',
    reason: 'Reframes a request for facts as a defect in your perception. The claim never gets addressed — you do.',
  },
  {
    re: /\byou always (do this|make|turn|start)\b/i,
    severity: 'medium',
    reason: 'Absolute generalisation. Moves the subject from one specific evening to your character in general.',
  },
  {
    re: /\btwisting my words\b|\bputting words in my mouth\b/i,
    severity: 'high',
    reason: 'Accuses you of distorting the record instead of simply restating what was said.',
  },
  {
    re: /\b(you'?re|your) remembering it wrong\b|\bi never said\b|\bthat'?s not what i said\b/i,
    severity: 'high',
    reason: 'Attacks your memory of a message that is still in the thread. Textbook gaslighting: rewrite the record, not the behaviour.',
  },
  {
    re: /\bwhy don'?t you trust me\b|\bafter everything i'?ve done\b|\bif you don'?t trust me\b/i,
    severity: 'high',
    reason: 'Converts a factual question into a loyalty test, so answering it starts to feel like an accusation on your part.',
  },
  {
    re: /\bcan we drop (this|it)\b|\bi'?m not doing this right now\b|\bcan we talk about this later\b/i,
    severity: 'medium',
    reason: 'Thread termination timed precisely to the request for specifics.',
  },
  {
    re: /\bcalm down\b|\b(you'?re|your) being (paranoid|crazy|dramatic|ridiculous)\b/i,
    severity: 'high',
    reason: 'Pathologises your reaction so the underlying question looks unreasonable to raise again.',
  },
  {
    re: /\bdoes it matter\b|\bwhy does it matter\b/i,
    severity: 'medium',
    reason: 'Challenges your standing to ask rather than answering. Note that the answer itself would be one word.',
  },
  {
    re: /\bi already (told|explained) you\b|\btwice\b/i,
    severity: 'low',
    reason: 'Appeals to a previous answer instead of repeating it — the previous answer is what is in dispute.',
  },

  /* ---- Roman Urdu / Hindi ---- */
  {
    re: /\b(?:tum|aap)\b[^.?!]{0,18}\b(?:bohat|bahut|zyada|zada)\b[^.?!]{0,14}\bsoch\w*\b/i,
    severity: 'high',
    reason:
      'Reframes a request for facts as overthinking on your part ("tum bohat zyada soch rahi ho"). The claim itself never gets answered — your judgement gets questioned instead.',
  },
  {
    re: /\b(?:tum|aap) hamesha\b/i,
    severity: 'medium',
    reason:
      'Absolute generalisation ("tum hamesha aisa karti ho"). Moves the subject from one specific evening to your character in general.',
  },
  {
    re: /\bbaat ghuma\w*\b|\bmeri baat ka matlab badal\w*\b/i,
    severity: 'high',
    reason:
      'Accuses you of twisting the words ("baat ghuma rahi ho") instead of simply repeating what was actually said.',
  },
  {
    re: /\b(?:maine|main ne) kabhi nahi kaha\b|\btumhe ghalat yaad hai\b|\bmaine (?:aisa|ye) kaha hi nahi\b/i,
    severity: 'high',
    reason:
      'Attacks your memory of a message still sitting in the thread ("tumhe ghalat yaad hai"). Textbook gaslighting: rewrite the record rather than the behaviour.',
  },
  {
    re: /\bbharosa nahi\b|\byaqeen nahi\b|\bitne saalon baad\b|\bmain ne kya kiya hai tumhare liye\b/i,
    severity: 'high',
    reason:
      'Turns a factual question into a loyalty test ("tumhe mujh par bharosa nahi?"), so asking again starts to feel like an accusation.',
  },
  {
    re: /\bchh?o[rd]o\b|\bbaad mein baat\b|\babhi (?:main )?ye nahi karna chahta\b|\bis baat ko yahin khatam\b/i,
    severity: 'medium',
    reason:
      'Shuts the thread down at the exact moment specifics are requested ("chhoro is baat ko").',
  },
  {
    re: /\bkya farq parta hai\b|\bfarq nahi parta\b|\bimportant nahi\b/i,
    severity: 'medium',
    reason:
      'Challenges your right to ask rather than answering ("kya farq parta hai?"). Note the answer itself would be one word.',
  },
  {
    re: /\bpehle bhi bata\w* (?:hoon|hun|chuka|chuki)\b|\bdo dafa\b|\bbata to diya tha\b/i,
    severity: 'low',
    reason:
      'Points back at an earlier answer instead of giving it again ("pehle bhi bata chuka hoon") — but that earlier answer is exactly what is in dispute.',
  },
  {
    re: /\bpagal ho\b|\bdimagh kharab\b|\bwehmi ho\b|\bshak(?:i| karna) chhoro\b/i,
    severity: 'high',
    reason:
      'Pathologises your reaction ("pagal ho gayi ho", "wehmi ho") so raising it again looks unreasonable.',
  },

  /* ---- Indonesian / Turkish / Romanian ---- */
  {
    re: /\bkamu (?:terlalu )?(?:mikir|berpikir) (?:terlalu )?(?:banyak|berlebihan)\b|\bjangan berlebihan\b/i,
    severity: 'high',
    reason: 'Reframes the question as you overthinking rather than answering it.',
  },
  {
    re: /\bcok (?:fazla )?dusun\w*\b|\bçok (?:fazla )?düşün\w*\b|\bsen hep\b/i,
    severity: 'high',
    reason: 'Reframes the question as you overthinking, or generalises to "you always".',
  },
  {
    re: /\bgandesti prea mult\b|\bgândești prea mult\b|\bmereu faci asta\b/i,
    severity: 'high',
    reason: 'Reframes the question as you overthinking, or generalises to "you always do this".',
  },
]

function detectDeflection(msgs, ctx) {
  const flags = []
  for (const m of msgs) {
    if (!m.text) continue
    const hits = DEFLECTIONS.filter((d) => d.re.test(m.text))
    if (!hits.length) continue

    const rank = { low: 0, medium: 1, high: 2 }
    const top = hits.reduce((best, h) => (rank[h.severity] > rank[best.severity] ? h : best), hits[0])
    const evidence = []
    const prev = ctx.prevFromOther.get(m.id)
    let latencyNote = ''
    if (prev && isQuestion(prev.text)) {
      const gap = m.ts - prev.ts
      if (gap > 90 * MINUTE) latencyNote = ` Reply landed ${duration(gap)} after a direct question.`
      evidence.push({
        messageId: prev.id,
        ts: prev.ts,
        note: 'The question that was not answered',
        fromOther: true,
      })
    }

    flags.push({
      id: `df_${m.id}`,
      category: 'deflection',
      severity: top.severity,
      messageId: m.id,
      ts: m.ts,
      headline: hits.length > 1 ? `${hits.length} manipulation patterns in one message` : 'Deflection pattern',
      reason: hits.map((h) => h.reason).join(' ') + latencyNote,
      highlights: hits.map((h) => (m.text.match(h.re) || [''])[0]).filter(Boolean),
      evidence,
      meta: { patterns: hits.length },
    })
  }
  return flags
}

/* ------------------------------------------------------------------ */
/* Counter-strategy                                                    */
/* ------------------------------------------------------------------ */

function buildSuggestions(flags, targetName) {
  const byCat = (id) => flags.filter((f) => f.category === id)
  const out = []

  const contradiction = byCat('timeline')[0]
  if (contradiction) {
    out.push({
      id: 'cs_timeline',
      category: 'timeline',
      title: 'Close the loop without naming the loop',
      line: `Random one — what time did you actually get in on ${contradiction.meta.subjectShort}? I'm filling in the shared calendar.`,
      why: `Gives an innocent reason to ask for a hard number. ${targetName} has already given two versions (${contradiction.meta.from} vs ${contradiction.meta.to}); a third version, or a refusal to give one, is the tell. Ask it cold, days apart from the argument.`,
    })
  }

  const distancing = byCat('distancing')[0]
  if (distancing) {
    out.push({
      id: 'cs_distancing',
      category: 'distancing',
      title: 'Force the name back into the sentence',
      line: 'Was that the same one who helped with the desk, or someone else? I keep mixing them up.',
      why: `The referent has been kept anonymous ("${distancing.meta.label}"). Offering a wrong-but-plausible identity is low-pressure: an honest answer corrects you instantly with a name, an invented one hedges or quietly accepts the substitute.`,
    })
  }

  if (byCat('over_explaining').length) {
    out.push({
      id: 'cs_overexplain',
      category: 'over_explaining',
      title: 'Ask for the boring middle of the story',
      line: 'Sorry, one thing I never got — who else was still there when you left?',
      why: 'Rehearsed accounts are built around the headline, not the background. Peripheral detail (who else, what was playing, where they parked) is unscripted, cheap for the truthful, and expensive to invent under time pressure.',
    })
  }

  if (byCat('deflection').length) {
    out.push({
      id: 'cs_deflection',
      category: 'deflection',
      title: 'Refuse the reframe, keep the question',
      line: `I'm not upset and I'm not accusing you. I'm asking one question and I'll drop it after: who were you with?`,
      why: 'Pre-empts the "you are overreacting" move by removing the emotion it needs to attach to. When the exit is closed politely, evasion has to become explicit — which is itself the answer.',
    })
  }

  out.push({
    id: 'cs_control',
    category: 'timeline',
    title: 'Run a control question first',
    line: 'What did you end up eating that night?',
    why: 'Establish a baseline on something with no stakes. Compare response speed, length and detail against the same questions about the disputed evening — the delta is far more diagnostic than any single answer.',
  })

  return out.slice(0, 5)
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

function band(risk) {
  if (risk >= 75)
    return {
      key: 'high',
      label: 'High probability of indirect deception',
      blurb: 'Multiple independent signal families agree. Treat the stated timeline as unreliable until reconciled.',
    }
  if (risk >= 50)
    return {
      key: 'elevated',
      label: 'Elevated inconsistency',
      blurb: 'Enough corroborating signals to warrant a careful, non-confrontational verification pass.',
    }
  if (risk >= 25)
    return {
      key: 'moderate',
      label: 'Minor inconsistencies detected',
      blurb: 'Mostly ordinary conversational noise, with a few statements worth a second look.',
    }
  return {
    key: 'low',
    label: 'No meaningful deception signal',
    blurb: 'Language is consistent and specific across the selected window. Nothing here needs chasing.',
  }
}

function score(flags, k) {
  const total = flags.reduce((sum, f) => sum + (SEVERITY_WEIGHT[f.severity] || 1), 0)
  return Math.round(100 * (1 - Math.exp(-total / k)))
}

/**
 * @param {object} opts
 * @param {Array}  opts.messages    full conversation, ascending by ts
 * @param {string} opts.targetId    whose language is being analysed
 * @param {string} opts.timeframe   '24h' | '7d' | 'all'
 */
export function analyzeConversation({
  messages,
  targetId,
  targetName = 'they',
  timeframe = 'all',
  now = Date.now(),
}) {
  const tf = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[2]
  const windowStart = tf.ms === Infinity ? -Infinity : now - tf.ms

  const ordered = [...messages].sort((a, b) => a.ts - b.ts)
  const targetAll = ordered.filter((m) => m.from === targetId)
  const inWindow = ordered.filter((m) => m.ts >= windowStart)
  const targetWindow = inWindow.filter((m) => m.from === targetId)

  // Map each target message to the other person's most recent preceding message.
  const prevFromOther = new Map()
  let lastOther = null
  for (const m of ordered) {
    if (m.from !== targetId) lastOther = m
    else if (lastOther) prevFromOther.set(m.id, lastOther)
  }
  const ctx = { prevFromOther }

  // Distancing and contradictions both need the full history to notice a change
  // in how something is described, then report only messages inside the window.
  const merged = [
    ...detectContradictions(targetAll, windowStart),
    ...detectDistancing(targetAll).filter((f) => f.ts >= windowStart),
    ...detectOverExplaining(targetWindow, ctx),
    ...detectDeflection(targetWindow, ctx),
  ].sort((a, b) => b.ts - a.ts)

  const categories = CATEGORY_ORDER.map((id) => {
    const own = merged.filter((f) => f.category === id)
    return {
      ...CATEGORIES[id],
      count: own.length,
      score: own.length ? clamp(score(own, 6), 8, 99) : 0,
      worst: own.some((f) => f.severity === 'high') ? 'high' : own.length ? 'medium' : 'none',
    }
  })

  const risk = merged.length ? clamp(score(merged, 28), 6, 96) : 3

  // Supporting metrics shown under the ring.
  const latencies = []
  for (const m of targetWindow) {
    const prev = prevFromOther.get(m.id)
    if (prev && isQuestion(prev.text)) latencies.push(m.ts - prev.ts)
  }
  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
  const flaggedIds = new Set(merged.map((f) => f.messageId))
  const flaggedWords = targetWindow.filter((m) => flaggedIds.has(m.id)).map((m) => words(m.text).length)
  const baselineWords = targetWindow.filter((m) => !flaggedIds.has(m.id)).map((m) => words(m.text).length)
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

  return {
    id: `rep_${now}`,
    generatedAt: now,
    engine: 'on-device heuristics',
    targetId,
    targetName,
    timeframe: tf.id,
    timeframeLabel: tf.label,
    risk,
    band: band(risk),
    flags: merged,
    categories,
    suggestions: buildSuggestions(merged, targetName),
    stats: {
      analyzed: inWindow.length,
      fromTarget: targetWindow.length,
      flagged: flaggedIds.size,
      contradictions: merged.filter((f) => f.category === 'timeline').length,
      avgLatency,
      avgLatencyLabel: avgLatency ? duration(avgLatency) : '—',
      // Verbosity of flagged messages vs the subject's own baseline. Needs a few
      // unflagged messages to mean anything, and is capped so a one-word
      // baseline ("🙄") cannot produce a nonsense multiplier.
      wordSpike:
        baselineWords.length >= 3 && flaggedWords.length
          ? clamp(Math.round((avg(flaggedWords) / Math.max(2, avg(baselineWords)) - 1) * 100), -90, 300)
          : 0,
      spanDays: inWindow.length
        ? Math.max(1, Math.round((inWindow[inWindow.length - 1].ts - inWindow[0].ts) / DAY))
        : 0,
    },
  }
}
