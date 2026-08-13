import { DAY, startOfDay, weekdayName } from '../lib/utils.js'

/**
 * The two people who can be logged into on this device.
 * `a` is the person raising questions, `b` is the person answering them —
 * both sides carry planted linguistic cues so the report changes when you
 * switch perspective.
 */
export const USERS = {
  a: {
    id: 'a',
    label: 'User 1',
    name: 'Alex Rivera',
    initials: 'AR',
    email: 'alex@truematch.app',
    tint: 'from-emerald-400 to-teal-600',
    about: 'Ask me anything. Twice.',
  },
  b: {
    id: 'b',
    label: 'User 2',
    name: 'Jordan Blake',
    initials: 'JB',
    email: 'jordan@truematch.app',
    tint: 'from-sky-400 to-indigo-600',
    about: 'Busy season 🙃',
  },
}

export const OTHER = { a: 'b', b: 'a' }

/**
 * Seed script. Entries use either:
 *   { d, t }  -> `d` days ago, at local clock time `t` ("HH:MM")
 *   { m }     -> `m` minutes before now (used for "today")
 *
 * `{D3}` / `{D6}` are replaced with the real weekday names of those dates, so
 * the timeline claims in the text always line up with the actual timestamps.
 */
const SCRIPT = [
  // ── 8 days ago: the baseline. Sam is named, warmly and specifically. ──
  { d: 8, t: '08:12', from: 'b', text: 'Morning ☀️ heading out early — my friend Sam needs a hand hauling a desk out of the warehouse' },
  { d: 8, t: '08:15', from: 'a', text: 'Sam from your old job?' },
  { d: 8, t: '08:16', from: 'b', text: "That's the one. You met him at the summer thing 🙂" },
  { d: 8, t: '08:40', from: 'a', text: 'ok have fun. dinner tonight?' },
  { d: 8, t: '08:41', from: 'b', text: 'Back by 7 latest' },
  {
    d: 8,
    t: '19:58',
    from: 'b',
    text: 'one desk, zero casualties',
    attachment: { kind: 'image', name: 'desk_assembled.jpg', tint: 'from-amber-500/40 to-rose-500/30' },
  },
  { d: 8, t: '20:02', from: 'a', text: '😂 impressive' },

  // ── 6 days ago ──
  { d: 6, t: '18:30', from: 'a', text: 'How was the week' },
  { d: 6, t: '18:33', from: 'b', text: "Long. Deadline stuff. Priya's still out so it's all landing on me" },
  {
    d: 6,
    t: '18:35',
    from: 'a',
    text: 'Sorry I missed your call — phone was in my bag at the gym, I was there till 8 then straight home',
  },
  { d: 6, t: '18:37', from: 'b', text: 'No worries' },
  {
    d: 6,
    t: '21:10',
    from: 'b',
    text: '',
    attachment: { kind: 'voice', name: 'Voice message', length: '0:42' },
  },

  // ── 3 days ago: the night everything hinges on ──
  { d: 3, t: '17:44', from: 'a', text: 'Are we still on for 8?' },
  {
    d: 3,
    t: '17:58',
    from: 'b',
    text: "Can't tonight — I'm stuck at the office. The Henderson deck has to go out by midnight and Priya's still out, so it's on me",
  },
  { d: 3, t: '18:00', from: 'a', text: 'ok' },
  {
    d: 3,
    t: '18:06',
    from: 'b',
    text: "I'll be at my desk till at least 11, honestly if I wrap earlier I'll text you, but the VPN keeps dropping so I have to redo the whole export every single time, and the garage locks at 11:30 so I might just leave the car and grab a cab, anyway don't wait up, love you x",
  },
  { d: 3, t: '21:12', from: 'a', text: "Was that you driving past Kelso's just now?" },
  { d: 3, t: '22:40', from: 'b', text: "Nope, wasn't me. I left the office at 9:30 and went straight home" },

  // ── 2 days ago: the referent quietly goes generic ──
  { d: 2, t: '12:20', from: 'a', text: "Mia says she saw you at Kelso's on {D3}" },
  {
    d: 2,
    t: '13:05',
    from: 'b',
    text: "She's mistaken. On {D3} I was helping that person move a couch, I already told you",
  },
  { d: 2, t: '13:06', from: 'a', text: 'Which person' },
  { d: 2, t: '13:09', from: 'b', text: 'Someone from the team. Does it matter?' },
  { d: 2, t: '13:10', from: 'b', text: "It's honestly not important who it was" },
  { d: 2, t: '13:11', from: 'a', text: "You said you'd be at the office till 11" },
  { d: 2, t: '13:20', from: 'b', text: "I said I *might* be. You're twisting my words." },
  {
    d: 2,
    t: '19:40',
    from: 'a',
    text: "I'm not twisting anything, I'm asking. You always make me the problem the second I ask a simple question",
  },
  {
    d: 2,
    t: '19:44',
    from: 'a',
    text: "And for the record I was at my sister's on {D6}, not the gym — you're the one mixing things up",
  },

  // ── Yesterday: the receipt, and the paragraph that came with it ──
  {
    d: 1,
    t: '10:02',
    from: 'b',
    text: 'there, nothing weird',
    attachment: { kind: 'doc', name: 'kelsos_receipt.pdf', size: '148 KB' },
  },
  {
    d: 1,
    t: '10:04',
    from: 'b',
    text: "So the reason there's a second drink on the {D3} receipt is that the guy beside me couldn't get the card reader to work, so I put it on mine and he handed me the cash, and honestly I only stopped in at all because the garage was full and I had to wait it out, which is also why the timestamp looks so late, anyway it's nothing",
  },
  { d: 1, t: '11:30', from: 'a', text: 'You told me you went straight home' },
  { d: 1, t: '11:52', from: 'b', text: "I said I wasn't driving past it. Big difference." },
  { d: 1, t: '20:15', from: 'a', text: "I got a ride back from someone tonight, don't wait up" },
  { d: 1, t: '22:40', from: 'a', text: 'It was just a colleague' },

  // ── Today ──
  { m: 620, from: 'a', text: "I'm not trying to fight. I just want the actual timeline" },
  { m: 612, from: 'b', text: "You're overthinking this. You always do this." },
  { m: 610, from: 'b', text: "Why don't you trust me, after everything I've done for you?" },
  { m: 540, from: 'a', text: 'Just answer it. Who were you with on {D3}?' },
  { m: 300, from: 'b', text: 'Someone from work. I already told you.' },
  { m: 296, from: 'b', text: "I never said I was at the office all night — you're remembering it wrong" },
  { m: 150, from: 'a', text: '…' },
  { m: 96, from: 'b', text: "Can we drop this? I'm not doing this right now." },
  {
    m: 92,
    from: 'b',
    text: 'Look — on {D3} I stayed late, then I helped a person carry a couch up three flights, then I stopped for exactly one drink because I was dead on my feet, then I came home. That is the whole thing. Why is that so hard to believe?',
  },
  { m: 40, from: 'a', text: 'ok.' },
  { m: 12, from: 'b', text: '🙄' },
]

const HOURS_MS = 60 * 60 * 1000
const MIN_MS = 60 * 1000

function atDay(now, daysAgo, hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return startOfDay(now - daysAgo * DAY) + h * HOURS_MS + m * MIN_MS
}

/** Build the seeded conversation anchored to `now`. */
export function buildSeed(now = Date.now()) {
  const d3 = weekdayName(now - 3 * DAY)
  const d6 = weekdayName(now - 6 * DAY)

  const messages = SCRIPT.map((entry, i) => {
    const ts = entry.m != null ? now - entry.m * MIN_MS : atDay(now, entry.d, entry.t)
    return {
      id: `seed_${String(i).padStart(3, '0')}`,
      from: entry.from,
      text: (entry.text || '').replaceAll('{D3}', d3).replaceAll('{D6}', d6),
      ts,
      status: 'read',
      attachment: entry.attachment ?? null,
      seed: true,
    }
  }).sort((x, y) => x.ts - y.ts)

  const last = messages[messages.length - 1]
  if (last) last.status = 'delivered'
  return messages
}

/**
 * Canned replies for the "simulate the other side" toggle. Deliberately written
 * in the same evasive register as the script so a live demo keeps producing
 * something for the scanner to chew on.
 */
export const AUTO_REPLIES = [
  "You're reading way too much into this.",
  'I already explained that. Twice.',
  'Someone from work, like I said.',
  "Why does it matter who it was? It's honestly not important.",
  "I'm not doing this right now.",
  'Look, I stayed late, then I got food, then I came home, that is genuinely the whole story.',
  "You're remembering it wrong.",
  'Can we talk about this later',
]
