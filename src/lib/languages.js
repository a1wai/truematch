/* ==================================================================
   Report languages.

   Two separate jobs live here:

   1. `detect()` guesses which romanised language the couple is texting in,
      from stop-word frequency. Roman Urdu and Roman Hindi overlap almost
      completely once romanised, so the split between them is a best guess —
      the user can always override it, and that override is what the report
      and the model prompt both obey.

   2. `strings` gives every language a small offline vocabulary so the report
      is still readable in that language with no API key. Full per-flag
      explanations in the local language come from the model when live
      analysis is switched on; without it, the fixed lines below carry the
      report and the detailed reasoning stays in English.
   ================================================================== */

export const LANGUAGES = [
  {
    id: 'auto',
    label: 'Auto-detect',
    native: 'Auto',
    hint: 'Pick the language from the conversation itself',
  },
  { id: 'en', label: 'English', native: 'English', hint: 'Standard English' },
  {
    id: 'roman-ur',
    label: 'Roman Urdu',
    native: 'Roman Urdu',
    hint: 'kya kar rahe ho, main office mein tha',
  },
  {
    id: 'roman-hi',
    label: 'Roman Hindi',
    native: 'Roman Hindi',
    hint: 'kya kar rahe ho, main office mein tha',
  },
  {
    id: 'roman-id',
    label: 'Roman Indonesian',
    native: 'Bahasa Indonesia',
    hint: 'kamu lagi apa, aku di kantor',
  },
  { id: 'roman-tr', label: 'Roman Turkish', native: 'Türkçe', hint: 'ne yapiyorsun, ofisteydim' },
  { id: 'roman-ro', label: 'Roman Romanian', native: 'Română', hint: 'ce faci, am fost la birou' },
  { id: 'ur', label: 'Urdu (اردو script)', native: 'اردو', hint: 'Native Urdu script' },
  { id: 'hi', label: 'Hindi (देवनागरी)', native: 'हिन्दी', hint: 'Native Devanagari script' },
]

export const LANGUAGE_BY_ID = Object.fromEntries(LANGUAGES.map((l) => [l.id, l]))

/** Stop words that are distinctive enough to fingerprint a romanised language. */
const MARKERS = {
  'roman-ur': [
    'nahi', 'nahin', 'kya', 'mujhe', 'tum', 'tumhe', 'tumhara', 'main', 'mein', 'tha', 'thi',
    'hai', 'hain', 'kar', 'raha', 'rahi', 'rahe', 'bohat', 'bahut', 'acha', 'theek', 'kyun',
    'kyu', 'phir', 'abhi', 'sath', 'saath', 'baat', 'gaya', 'gayi', 'ghar', 'yaar', 'bilkul',
    'shayad', 'wapas', 'chhoro', 'choro', 'batao', 'suno', 'dekho', 'apna', 'apni', 'koi',
  ],
  'roman-hi': [
    'nahi', 'kya', 'mujhe', 'tum', 'tumhe', 'main', 'mein', 'tha', 'thi', 'hai', 'hain', 'kar',
    'raha', 'rahi', 'rahe', 'bahut', 'accha', 'theek', 'kyun', 'phir', 'abhi', 'saath', 'baat',
    'gaya', 'gayi', 'ghar', 'yaar', 'bilkul', 'shayad', 'wapas', 'bolo', 'dekho', 'koi', 'kuch',
  ],
  'roman-id': [
    'aku', 'kamu', 'gak', 'nggak', 'tidak', 'kenapa', 'sudah', 'udah', 'lagi', 'sama', 'saja',
    'aja', 'kan', 'dong', 'banget', 'sih', 'yang', 'dengan', 'kantor', 'rumah', 'pulang', 'tapi',
  ],
  'roman-tr': [
    'ben', 'sen', 'degil', 'değil', 'neden', 'niye', 'simdi', 'şimdi', 'sonra', 'evde', 'ofiste',
    'yok', 'var', 'cok', 'çok', 'tamam', 'ama', 'bir', 'icin', 'için', 'gittim', 'geldim',
  ],
  'roman-ro': [
    'sunt', 'esti', 'ești', 'nu', 'ceva', 'acasa', 'acasă', 'birou', 'pentru', 'dar', 'foarte',
    'atunci', 'acum', 'cand', 'când', 'unde', 'cine', 'bine', 'inca', 'încă', 'fost', 'facut',
  ],
}

const SCRIPT_TESTS = [
  { id: 'ur', re: /[؀-ۿ]/ },
  { id: 'hi', re: /[ऀ-ॿ]/ },
]

/**
 * Score every language against the transcript and return the best fit.
 * Falls back to English, which is also what a tie resolves to.
 */
export function detectLanguage(texts) {
  const joined = texts.join(' ')
  for (const s of SCRIPT_TESTS) if (s.re.test(joined)) return s.id

  const words = joined.toLowerCase().match(/[a-zçğıöşüăâîț]+/g) || []
  if (words.length < 8) return 'en'
  const counts = new Map(words.map((w) => [w, 0]))
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1)

  let best = { id: 'en', score: 0 }
  for (const [id, markers] of Object.entries(MARKERS)) {
    let score = 0
    for (const m of markers) score += counts.get(m) || 0
    const ratio = score / words.length
    if (ratio > best.score) best = { id, score: ratio }
  }
  // Needs a real concentration of markers, not one stray "koi".
  return best.score >= 0.045 ? best.id : 'en'
}

/** Resolve 'auto' against the actual conversation. */
export function resolveLanguage(setting, texts) {
  if (setting && setting !== 'auto') return setting
  return detectLanguage(texts)
}

const EN = {
  reportTitle: 'Deception Intelligence Report',
  riskLabel: 'dishonesty risk',
  categories: {
    over_explaining: 'Over-explaining & unnecessary detail',
    distancing: 'Distancing language',
    timeline: 'Timeline & fact contradictions',
    deflection: 'Deflection & emotional manipulation',
  },
  gist: {
    over_explaining: 'Explained far more than was asked.',
    distancing: 'Avoided naming the person involved.',
    timeline: 'Gave two versions of the same evening.',
    deflection: 'Turned the question back on you instead of answering.',
  },
  bands: {
    high: 'High probability of indirect deception',
    elevated: 'Elevated inconsistency',
    moderate: 'Minor inconsistencies detected',
    low: 'No meaningful deception signal',
  },
  severity: { high: 'Strong', medium: 'Medium', low: 'Weak' },
  simplify: 'Simplify this report',
  simplified: 'Plain-language summary',
  full: 'Show full report',
  nothing: 'Nothing worth flagging in this period.',
  bottomLine: 'Bottom line',
}

/**
 * Offline vocabulary per language. Deliberately short: these are the lines the
 * report can always show without a model. Anything longer is either English or
 * comes back from the LLM already localised.
 */
export const STRINGS = {
  en: EN,
  'roman-ur': {
    reportTitle: 'Jhoot Pakadne Wali Report',
    riskLabel: 'jhoot ka imkaan',
    categories: {
      over_explaining: 'Zaroorat se zyada tafseel',
      distancing: 'Naam chupana / faasla',
      timeline: 'Waqt aur baat ka tazaad',
      deflection: 'Baat ghumana aur emotional dabao',
    },
    gist: {
      over_explaining: 'Jitna pucha gaya tha, us se kahin zyada safai di.',
      distancing: 'Banday ka naam lene se bachte rahe.',
      timeline: 'Aik hi raat ki do alag alag kahaniyan batayin.',
      deflection: 'Jawab dene ke bajaye ulta aap par sawal kar diya.',
    },
    bands: {
      high: 'Jhoot ka imkaan bohat zyada hai',
      elevated: 'Kaafi tazaad mile hain',
      moderate: 'Thora bohat tazaad hai',
      low: 'Koi khaas mashkook baat nahi',
    },
    severity: { high: 'Mazboot', medium: 'Darmiyana', low: 'Halka' },
    simplify: 'Report ko asaan karein',
    simplified: 'Asaan alfaz mein khulasa',
    full: 'Poori report dekhein',
    nothing: 'Is arse mein koi khaas mashkook baat nahi mili.',
    bottomLine: 'Khulasa',
  },
  'roman-hi': {
    reportTitle: 'Jhooth Pakadne Wali Report',
    riskLabel: 'jhooth ki sambhavna',
    categories: {
      over_explaining: 'Zaroorat se zyada safai',
      distancing: 'Naam chhupana / doori',
      timeline: 'Samay aur baat ka virodh',
      deflection: 'Baat ghumana aur emotional dabav',
    },
    gist: {
      over_explaining: 'Jitna poocha tha, usse kahin zyada bata diya.',
      distancing: 'Insaan ka naam lene se bachte rahe.',
      timeline: 'Ek hi raat ki do alag kahaniyan batayin.',
      deflection: 'Jawab dene ke bajay ulta aap par sawal kar diya.',
    },
    bands: {
      high: 'Jhooth ki sambhavna bahut zyada hai',
      elevated: 'Kaafi virodhabhas mile hain',
      moderate: 'Thoda bahut virodhabhas hai',
      low: 'Koi khaas sandeh wali baat nahi',
    },
    severity: { high: 'Majboot', medium: 'Madhyam', low: 'Halka' },
    simplify: 'Report ko aasan banayein',
    simplified: 'Aasan bhasha mein saar',
    full: 'Poori report dekhein',
    nothing: 'Is samay mein koi khaas sandigdh baat nahi mili.',
    bottomLine: 'Saar',
  },
  'roman-id': {
    reportTitle: 'Laporan Deteksi Kebohongan',
    riskLabel: 'kemungkinan bohong',
    categories: {
      over_explaining: 'Penjelasan berlebihan',
      distancing: 'Menghindari menyebut nama',
      timeline: 'Cerita waktu yang bertentangan',
      deflection: 'Mengalihkan dan menekan secara emosional',
    },
    gist: {
      over_explaining: 'Menjelaskan jauh lebih banyak daripada yang ditanya.',
      distancing: 'Menghindari menyebut nama orangnya.',
      timeline: 'Memberi dua versi untuk malam yang sama.',
      deflection: 'Balik bertanya daripada menjawab.',
    },
    bands: {
      high: 'Kemungkinan besar berbohong',
      elevated: 'Cukup banyak kejanggalan',
      moderate: 'Sedikit kejanggalan',
      low: 'Tidak ada tanda yang berarti',
    },
    severity: { high: 'Kuat', medium: 'Sedang', low: 'Lemah' },
    simplify: 'Sederhanakan laporan',
    simplified: 'Ringkasan bahasa sederhana',
    full: 'Lihat laporan lengkap',
    nothing: 'Tidak ada yang mencurigakan pada periode ini.',
    bottomLine: 'Kesimpulan',
  },
  'roman-tr': {
    reportTitle: 'Yalan Tespit Raporu',
    riskLabel: 'yalan ihtimali',
    categories: {
      over_explaining: 'Gereginden fazla aciklama',
      distancing: 'Isim vermekten kacinma',
      timeline: 'Zaman ve olay celiskisi',
      deflection: 'Konuyu saptirma ve duygusal baski',
    },
    gist: {
      over_explaining: 'Sorulandan cok daha fazlasini anlatti.',
      distancing: 'Kisinin adini soylemekten kacindi.',
      timeline: 'Ayni gece icin iki farkli anlatim verdi.',
      deflection: 'Cevap vermek yerine soruyu sana cevirdi.',
    },
    bands: {
      high: 'Yalan ihtimali cok yuksek',
      elevated: 'Belirgin tutarsizliklar var',
      moderate: 'Kucuk tutarsizliklar var',
      low: 'Kayda deger bir sey yok',
    },
    severity: { high: 'Guclu', medium: 'Orta', low: 'Zayif' },
    simplify: 'Raporu sadelestir',
    simplified: 'Sade dille ozet',
    full: 'Tam raporu goster',
    nothing: 'Bu donemde dikkat cekici bir sey bulunamadi.',
    bottomLine: 'Sonuc',
  },
  'roman-ro': {
    reportTitle: 'Raport de Detectare a Minciunii',
    riskLabel: 'probabilitate de minciuna',
    categories: {
      over_explaining: 'Explicatii excesive',
      distancing: 'Evita sa spuna numele',
      timeline: 'Contradictii de timp si fapte',
      deflection: 'Devierea discutiei si presiune emotionala',
    },
    gist: {
      over_explaining: 'A explicat mult mai mult decat s-a intrebat.',
      distancing: 'A evitat sa spuna numele persoanei.',
      timeline: 'A dat doua versiuni pentru aceeasi seara.',
      deflection: 'A intors intrebarea spre tine in loc sa raspunda.',
    },
    bands: {
      high: 'Probabilitate mare de minciuna',
      elevated: 'Inconsecvente semnificative',
      moderate: 'Inconsecvente minore',
      low: 'Nimic ingrijorator',
    },
    severity: { high: 'Puternic', medium: 'Mediu', low: 'Slab' },
    simplify: 'Simplifica raportul',
    simplified: 'Rezumat pe intelesul tuturor',
    full: 'Vezi raportul complet',
    nothing: 'Nimic demn de semnalat in aceasta perioada.',
    bottomLine: 'Concluzie',
  },
}

// Native-script variants reuse the romanised vocabulary for structure; the model
// supplies properly scripted text when live analysis is on.
STRINGS.ur = { ...STRINGS['roman-ur'], reportTitle: 'جھوٹ پکڑنے والی رپورٹ' }
STRINGS.hi = { ...STRINGS['roman-hi'], reportTitle: 'झूठ पकड़ने वाली रिपोर्ट' }

export function strings(langId) {
  return STRINGS[langId] || EN
}

/** Instruction fragment handed to the model so it answers in the right register. */
export function languageInstruction(langId) {
  const map = {
    en: 'Write all explanations in clear, plain English.',
    'roman-ur':
      'Write all explanations in Roman Urdu (Urdu written with English letters, e.g. "usne do alag baatein kahin"). Do not use Arabic script. Keep it natural and conversational, the way people actually text.',
    'roman-hi':
      'Write all explanations in Roman Hindi (Hindi written with English letters, e.g. "usne do alag baatein kahin"). Do not use Devanagari script. Keep it natural and conversational.',
    'roman-id': 'Write all explanations in casual Indonesian (Bahasa Indonesia), the way people text.',
    'roman-tr': 'Write all explanations in casual Turkish, the way people text.',
    'roman-ro': 'Write all explanations in casual Romanian, the way people text.',
    ur: 'Write all explanations in Urdu using Arabic script (اردو).',
    hi: 'Write all explanations in Hindi using Devanagari script (हिन्दी).',
  }
  return map[langId] || map.en
}
