import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind-aware className joiner. */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const MINUTE = 60 * 1000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
export const WEEK = 7 * DAY

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/** 24h-ish clock label used inside bubbles, e.g. "21:04". */
export function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "TODAY" / "YESTERDAY" / "TUESDAY" / "12 MARCH 2026" separators. */
export function dayLabel(ts) {
  const d = new Date(ts)
  const today = startOfDay(Date.now())
  const that = startOfDay(ts)
  const diffDays = Math.round((today - that) / DAY)
  if (diffDays === 0) return 'TODAY'
  if (diffDays === 1) return 'YESTERDAY'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' }).toUpperCase()
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}

export function startOfDay(ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function weekdayName(ts) {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'long' })
}

/** "3d ago" / "4h ago" / "just now" — used in the report evidence cards. */
export function relativeTime(ts) {
  const diff = Date.now() - ts
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  return `${Math.floor(diff / DAY)}d ago`
}

/** Human duration for latency callouts, e.g. "3h 12m". */
export function duration(ms) {
  const mins = Math.round(ms / MINUTE)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
