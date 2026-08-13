/* Local device state only. Accounts, conversations, messages and media all
   live in Supabase — what stays here is app preferences, saved scan reports
   and the private AI-friend thread. */

const NS = 'truematch.v1'
export const KEYS = {
  settings: `${NS}.settings`,
  reports: `${NS}.reports`,
  aiChat: `${NS}.aichat`,
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Private mode / quota exhausted — the app still works, it just forgets.
    return false
  }
}

export const DEFAULT_SETTINGS = {
  // AI engine
  provider: 'groq',
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
  endpoint: '',
  useLiveAI: false,
  // Realtime sync — blank means the app runs in local-only mode
  supabaseUrl: '',
  supabaseKey: '',
  roomCode: 'TRUEMATCH-DEMO',
  // Report
  reportLanguage: 'auto',
  // Behaviour
  stealthMode: true,
}


export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }
}

export function saveSettings(settings) {
  write(KEYS.settings, settings)
}

/** Keeps the 12 most recent reports so the "previous scans" list stays useful. */
export function loadReports() {
  const list = read(KEYS.reports, [])
  return Array.isArray(list) ? list : []
}

export function saveReport(report) {
  const next = [report, ...loadReports().filter((r) => r.id !== report.id)].slice(0, 12)
  write(KEYS.reports, next)
  return next
}

export function clearReports() {
  write(KEYS.reports, [])
  return []
}

/** The AI friend thread is private to each account, so it is keyed by user. */
export function loadAiChat(userId) {
  const all = read(KEYS.aiChat, {})
  return Array.isArray(all?.[userId]) ? all[userId] : []
}

export function saveAiChat(userId, messages) {
  const all = read(KEYS.aiChat, {})
  write(KEYS.aiChat, { ...all, [userId]: messages })
}

export function wipeEverything() {
  for (const key of Object.values(KEYS)) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* nothing sensible to do here */
    }
  }
}
