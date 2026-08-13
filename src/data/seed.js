import { DAY, startOfDay, weekdayName } from '../lib/utils.js'

/**
 * The two test accounts. Both are pre-authorised — tapping either one on the
 * login screen drops you straight into the thread, which is what the APK demo
 * needs.
 *
 * `photo` is looked up under `public/avatars/`. If the file is missing the
 * Avatar component falls back to the monogram, so nothing breaks before the
 * real pictures are dropped in.
 */
export const USERS = {
  a: {
    id: 'a',
    label: 'User 1',
    name: 'Usama',
    initials: 'U',
    email: 'usama@truematch.app',
    photo: 'usama.jpg',
    tint: 'from-rose-400 to-pink-600',
    about: 'Busy season 🙃',
  },
  b: {
    id: 'b',
    label: 'User 2',
    name: 'Bisma',
    initials: 'B',
    email: 'bisma@truematch.app',
    photo: 'bisma.jpg',
    tint: 'from-fuchsia-400 to-purple-600',
    about: 'Pooch lena, bata dungi 🌸',
  },
}

export const OTHER = { a: 'b', b: 'a' }

/**
 * Seed script — code-switched Roman Urdu and English, the way the two of them
 * actually text. Both sides carry planted cues, so the report is worth reading
 * whichever account you log in as.
 *
 * Entries use either:
 *   { d, t }  -> `d` days ago at local clock time `t` ("HH:MM")
 *   { m }     -> `m` minutes before now (used for "today")
 *
 * `{D3}` / `{D6}` become the real weekday names of those dates so the timeline
 * claims line up with the actual timestamps.
 */
const SCRIPT = [
  // ── 8 days ago: everyone still has a name ──
  { d: 8, t: '09:10', from: 'b', text: 'Good morning ☀️ meri cousin Ayesha aaj shopping ke liye bula rahi hai' },
  { d: 8, t: '09:14', from: 'a', text: 'theek hai jao. main mere dost Kamran ke saath gym ja raha hoon' },
  { d: 8, t: '09:15', from: 'b', text: 'Kamran wohi na jo shaadi pe mila tha?' },
  { d: 8, t: '09:16', from: 'a', text: 'haan wohi 🙂' },
  {
    d: 8,
    t: '19:40',
    from: 'b',
    text: 'dekho kitna pyara lag raha hai',
    attachment: { kind: 'image', name: 'shopping_day.jpg', tint: 'from-rose-400/40 to-fuchsia-500/30' },
  },
  { d: 8, t: '19:45', from: 'a', text: 'bohat pyara 😍' },

  // ── 6 days ago ──
  { d: 6, t: '18:30', from: 'a', text: 'Sorry call miss ho gaya, main gym mein tha 8 baje tak, phir seedha ghar aa gaya' },
  { d: 6, t: '18:35', from: 'b', text: 'koi baat nahi. main ghar pe hi thi saara din' },
  { d: 6, t: '18:37', from: 'a', text: 'acha chalo' },
  {
    d: 6,
    t: '21:10',
    from: 'b',
    text: '',
    attachment: { kind: 'voice', name: 'Voice message', length: '0:38' },
  },

  // ── 3 days ago: the night everything hinges on ──
  { d: 3, t: '17:40', from: 'b', text: 'aaj 8 baje mil rahe hain na?' },
  {
    d: 3,
    t: '17:55',
    from: 'a',
    text: 'aaj nahi ho payega, main office mein phansa hua hoon. presentation kal subah deni hai',
  },
  { d: 3, t: '17:57', from: 'b', text: 'ok' },
  {
    d: 3,
    t: '18:05',
    from: 'a',
    text: 'main 11 baje tak office mein hi rahunga, waise bhi agar jaldi free ho gaya to message kar dunga, lekin VPN baar baar disconnect ho raha hai is liye poora export dobara karna parta hai, aur parking 11:30 pe band ho jati hai to shayad cab le lunga, khair tum wait mat karna, love you',
  },
  { d: 3, t: '21:15', from: 'b', text: 'kisi ne tumhari gaari abhi cafe ke bahar dekhi?' },
  { d: 3, t: '22:35', from: 'a', text: 'nahi wo main nahi tha. main 9:30 baje office se nikla aur seedha ghar aa gaya' },

  // ── 2 days ago: the name quietly disappears ──
  { d: 2, t: '12:20', from: 'b', text: 'Ayesha keh rahi thi tumhe {D3} ko cafe mein dekha' },
  {
    d: 2,
    t: '13:05',
    from: 'a',
    text: 'usko galat fehmi hui hai. {D3} ko main office ke kisi banday ki madad kar raha tha, uska saman shift ho raha tha',
  },
  { d: 2, t: '13:06', from: 'b', text: 'kaun tha?' },
  { d: 2, t: '13:09', from: 'a', text: 'office ka koi tha. kya farq parta hai?' },
  { d: 2, t: '13:10', from: 'a', text: 'waise bhi ye important nahi ke kaun tha' },
  { d: 2, t: '13:12', from: 'b', text: 'tum ne kaha tha 11 baje tak office mein ho' },
  { d: 2, t: '13:20', from: 'a', text: 'maine kaha tha *shayad*. tum meri baat ghuma rahi ho' },
  {
    d: 2,
    t: '19:40',
    from: 'b',
    text: 'main baat nahi ghuma rahi, sirf pooch rahi hoon. tum hamesha mujhe hi ghalat bana dete ho',
  },
  {
    d: 2,
    t: '19:44',
    from: 'b',
    text: 'aur {D6} ko main Ayesha ke ghar thi, ghar pe nahi thi — tumhe yaad nahi shayad',
  },

  // ── Yesterday ──
  {
    d: 1,
    t: '10:02',
    from: 'a',
    text: 'lo dekh lo, kuch nahi hai ismein',
    attachment: { kind: 'doc', name: 'cafe_bill_{D3}.pdf', size: '132 KB' },
  },
  {
    d: 1,
    t: '10:04',
    from: 'a',
    text: '{D3} wale cafe bill pe doosri chai is liye hai kyunki mere saath wale banday ka card machine nahi chal raha tha, to maine apne card pe laga di aur usne mujhe cash de diya, aur main waise bhi sirf is liye ruka tha kyunki parking bhari hui thi aur mujhe wait karna tha, isi liye timing itni late lag rahi hai, khair koi baat nahi',
  },
  { d: 1, t: '11:30', from: 'b', text: 'tum ne kaha tha seedha ghar aaye the' },
  { d: 1, t: '11:52', from: 'a', text: 'maine kaha tha gaari wahan nahi thi. farq hai dono mein' },
  { d: 1, t: '20:15', from: 'b', text: 'mujhe aaj kisi ne drop kiya hai, wait mat karna' },
  { d: 1, t: '22:40', from: 'b', text: 'bas office ka colleague tha' },
  {
    d: 1,
    t: '22:45',
    from: 'b',
    text: 'usne bas is liye drop kiya kyunki barish ho rahi thi aur rickshaw mil hi nahi raha tha, waise bhi wo usi raste se ja raha tha, is liye maine socha theek hai, aur main sirf 10 minute gaari mein thi, bas itna hi',
  },

  // ── Today ──
  { m: 620, from: 'b', text: 'main larna nahi chahti. bas sach jaanna chahti hoon' },
  { m: 612, from: 'a', text: 'tum bohat zyada soch rahi ho. tum hamesha aisa karti ho' },
  { m: 610, from: 'a', text: 'itne saalon baad bhi tumhe mujh par bharosa nahi?' },
  { m: 540, from: 'b', text: '{D3} ko kis ke saath thay, bas ye bata do' },
  { m: 300, from: 'a', text: 'office ka koi tha. main pehle bhi bata chuka hoon' },
  { m: 296, from: 'a', text: 'maine kabhi nahi kaha ke main poori raat office mein tha, tumhe ghalat yaad hai' },
  { m: 150, from: 'b', text: '…' },
  { m: 96, from: 'a', text: 'chhoro is baat ko. abhi main ye nahi karna chahta' },
  {
    m: 92,
    from: 'a',
    text: 'dekho — {D3} ko main late tak ruka, phir maine ek banday ka saman teesri manzil tak pahunchaya, phir sirf ek chai peene ruka kyunki main thak gaya tha, phir ghar aa gaya. bas itni si baat hai. isme yaqeen na karne wali kya baat hai?',
  },
  { m: 40, from: 'b', text: 'theek hai.' },
  { m: 12, from: 'a', text: '🙄' },
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
  const fill = (s) => (s || '').replaceAll('{D3}', d3).replaceAll('{D6}', d6)

  const messages = SCRIPT.map((entry, i) => {
    const ts = entry.m != null ? now - entry.m * MIN_MS : atDay(now, entry.d, entry.t)
    return {
      id: `seed_${String(i).padStart(3, '0')}`,
      from: entry.from,
      text: fill(entry.text),
      ts,
      status: 'read',
      attachment: entry.attachment
        ? { ...entry.attachment, name: fill(entry.attachment.name) }
        : null,
      seed: true,
    }
  }).sort((x, y) => x.ts - y.ts)

  const last = messages[messages.length - 1]
  if (last) last.status = 'delivered'
  return messages
}

/**
 * Canned replies for the "simulate the other side" toggle — only used when the
 * cloud backend is off. Written in the same evasive register as the script so a
 * solo demo still gives the scanner something to chew on.
 */
export const AUTO_REPLIES = [
  'tum bohat zyada soch rahi ho.',
  'main pehle bhi bata chuka hoon. do dafa.',
  'office ka koi tha, bataya to tha.',
  'kya farq parta hai kaun tha? ye important nahi.',
  'abhi main ye baat nahi karna chahta.',
  'dekho main late tak ruka, phir khana khaya, phir ghar aa gaya, bas itni si baat hai.',
  'tumhe ghalat yaad hai.',
  'baad mein baat karte hain na',
]
