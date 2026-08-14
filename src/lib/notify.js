import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'

/* ==================================================================
   Message notifications.

   On Android these are Capacitor local notifications, fired the moment
   a row arrives over the realtime socket — no polling, no server round
   trip beyond the message itself.

   LIMIT WORTH KNOWING: local notifications need the app process to be
   alive. Foreground and backgrounded both work; fully swiped-away does
   not. Delivery to a killed app requires Firebase Cloud Messaging and a
   server to send from, which is a much larger piece of work.
   ================================================================== */

const native = Capacitor.isNativePlatform()
let ready = false
let appActive = true

/** Track foreground state so an open app does not notify about itself. */
if (native) {
  CapApp.addListener('appStateChange', ({ isActive }) => {
    appActive = isActive
  }).catch(() => {})
} else if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    appActive = document.visibilityState === 'visible'
  })
}

export function isAppActive() {
  return appActive
}

let webTapHandler = null

/**
 * Run `handler(conversationId)` when a notification is tapped, so the app
 * lands on the thread the notification was about rather than the inbox.
 * Returns an unsubscribe function.
 */
export function onNotificationTap(handler) {
  if (native) {
    const pending = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => {
        const id = action?.notification?.extra?.conversationId
        if (id) handler(id)
      },
    )
    return () => {
      pending.then((h) => h.remove()).catch(() => {})
    }
  }
  webTapHandler = handler
  return () => {
    webTapHandler = null
  }
}

/** Ask once, after login. Silent if the user says no — notifications are not essential. */
export async function ensureNotificationPermission() {
  if (ready) return true
  try {
    if (native) {
      const status = await LocalNotifications.checkPermissions()
      if (status.display !== 'granted') {
        const asked = await LocalNotifications.requestPermissions()
        if (asked.display !== 'granted') return false
      }
      // Android 8+ ignores notifications without a channel.
      await LocalNotifications.createChannel({
        id: 'messages',
        name: 'Messages',
        description: 'New messages from your chats',
        importance: 5,
        visibility: 1,
        lights: true,
        lightColor: '#FF2E63',
        vibration: true,
      }).catch(() => {})
      ready = true
      return true
    }

    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') {
      ready = true
      return true
    }
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    ready = result === 'granted'
    return ready
  } catch {
    return false
  }
}

let counter = 1

/**
 * Fire a notification for an incoming message.
 * `suppress` is true when the user is already looking at that conversation.
 */
export async function notifyMessage({ title, body, conversationId, suppress = false }) {
  if (suppress) return
  try {
    if (native) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: (counter = (counter % 2000000000) + 1),
            channelId: 'messages',
            title,
            body: body || 'Sent a photo',
            // White-silhouette status-bar icon; Android tints it with iconColor.
            smallIcon: 'ic_stat_truematch',
            iconColor: '#FF2E63',
            // Same group + tag per thread, so a burst of messages collapses
            // into one entry instead of stacking up.
            group: conversationId,
            extra: { conversationId },
          },
        ],
      })
      return
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const note = new Notification(title, { body: body || 'Sent a photo', tag: conversationId })
      note.onclick = () => {
        window.focus?.()
        note.close?.()
        webTapHandler?.(conversationId)
      }
    }
  } catch {
    /* notifications are a nicety; never let one break the chat */
  }
}
