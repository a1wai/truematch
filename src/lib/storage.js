import { WEEK } from './utils.js'
import { buildSeed } from '../data/seed.js'

const NS = 'truematch.v1'
export const KEYS = {
  messages: `${NS}.messages`,
  session: `${NS}.session`,
  settings: `${NS}.settings`,
  reports: `${NS}.reports`,
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
  provider: 'groq',
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
  endpoint: '',
  useLiveAI: false,
  simulateReplies: true,
  stealthMode: true,
}

export const DEFAULT_SESSION = { userId: null, viewingAs: null }

/**
 * The demo script talks about specific weekdays, so it can only be shifted in
 * whole weeks — that keeps "on Monday" pointing at a Monday. If the saved
 * conversation has gone stale by a week or more, slide it forward.
 */
function reanchor(messages) {
  if (!messages.length) return messages
  const newest = Math.max(...messages.map((m) => m.ts))
  const staleness = Date.now() - newest
  if (staleness < WEEK) return messages
  const shift = Math.floor(staleness / WEEK) * WEEK
  return messages.map((m) => ({ ...m, ts: m.ts + shift }))
}

export function loadMessages() {
  const stored = read(KEYS.messages, null)
  if (Array.isArray(stored) && stored.length) {
    const fixed = reanchor(stored)
    if (fixed !== stored) write(KEYS.messages, fixed)
    return fixed
  }
  const seeded = buildSeed(Date.now())
  write(KEYS.messages, seeded)
  return seeded
}

export function saveMessages(messages) {
  write(KEYS.messages, messages)
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }
}

export function saveSettings(settings) {
  write(KEYS.settings, settings)
}

export function loadSession() {
  return { ...DEFAULT_SESSION, ...read(KEYS.session, {}) }
}

export function saveSession(session) {
  write(KEYS.session, session)
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

export function resetDemo() {
  const seeded = buildSeed(Date.now())
  write(KEYS.messages, seeded)
  write(KEYS.reports, [])
  return seeded
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
