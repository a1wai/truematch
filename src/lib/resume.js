import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'

/* ==================================================================
   "Something changed, go and check."

   A phone suspends the WebView when you switch apps or lock the screen.
   The realtime socket usually dies with it — and the painful part is
   that it does not always say so: the channel can sit in SUBSCRIBED
   while nothing is delivered any more. That is what leaves a chat
   showing a message from ten minutes ago.

   So nothing here trusts the socket to be honest. Anything that needs
   to stay current subscribes to onResume() and re-checks whenever the
   app comes back to the foreground or the network returns, and polls
   slowly in the background as a floor under it.
   ================================================================== */

const native = Capacitor.isNativePlatform()
const listeners = new Set()

function fire(reason) {
  for (const fn of listeners) {
    try {
      fn(reason)
    } catch {
      /* one bad listener must not stop the others */
    }
  }
}

if (native) {
  CapApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) fire('foreground')
  }).catch(() => {})
  CapApp.addListener('resume', () => fire('foreground')).catch(() => {})
} else if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fire('foreground')
  })
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => fire('online'))
  window.addEventListener('focus', () => fire('focus'))
}

/**
 * Call `handler(reason)` whenever the app wakes up or the network comes
 * back. Returns an unsubscribe function.
 */
export function onResume(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

/** True when there is no network at all. Unknown counts as online. */
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

let lastReconnect = 0
const RECONNECT_COOLDOWN_MS = 30000

/**
 * Force the realtime socket to rebuild itself.
 *
 * After a suspend, supabase-js often believes it is still connected.
 * Disconnecting explicitly makes it notice, and every channel rejoins on
 * the next connect.
 *
 * Throttled: a busy conversation on a dead socket would otherwise ask for
 * this every few seconds and never leave the socket alone long enough to
 * finish rejoining.
 */
export function reconnectRealtime(supabase, { force = false } = {}) {
  const now = Date.now()
  if (!force && now - lastReconnect < RECONNECT_COOLDOWN_MS) return
  lastReconnect = now
  try {
    const socket = supabase?.realtime
    if (!socket) return
    if (typeof socket.isConnected === 'function' && socket.isConnected()) {
      socket.disconnect()
    }
    socket.connect?.()
  } catch {
    /* best effort — the polling above is what actually guarantees delivery */
  }
}
