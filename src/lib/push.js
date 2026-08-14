import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { getClient } from './supabase.js'

/* ==================================================================
   Push, for when the app is not running.

   The local notifications in notify.js are raised by the app itself, so
   they need the app alive. Nothing in a phone lets a killed app wake
   itself up — that is the whole reason push exists. Android routes it
   through Firebase Cloud Messaging: Google holds one connection for the
   whole device and hands the message to us, starting the app if it has
   to.

   The device registers a token here; the server side lives in
   supabase/functions/push and is triggered by an insert into messages.

   Without a google-services.json in android/app this registers nothing
   and quietly does nothing, which is exactly what should happen — the
   app still works, it just relies on being open.
   ================================================================== */

const native = Capacitor.isNativePlatform()
let registered = false

async function saveToken({ settings, profile, token }) {
  const supabase = getClient(settings)
  if (!supabase || !profile || !token) return
  await supabase.from('device_tokens').upsert(
    {
      token,
      user_id: profile.id,
      platform: Capacitor.getPlatform(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  )
}

/**
 * Register for push and store the token against this account.
 * Call after login. Safe to call more than once.
 *
 * @param onOpenConversation called with a conversation id when a push is tapped
 */
export async function registerPush({ settings, profile, onOpenConversation }) {
  if (!native || registered) return false
  try {
    const status = await PushNotifications.checkPermissions()
    if (status.receive !== 'granted') {
      const asked = await PushNotifications.requestPermissions()
      if (asked.receive !== 'granted') return false
    }

    PushNotifications.addListener('registration', ({ value }) => {
      saveToken({ settings, profile, token: value })
    })

    // Most often a missing or malformed google-services.json. Not worth
    // troubling the user about — everything else still works.
    PushNotifications.addListener('registrationError', () => {})

    // Tapped while the app was in the background or closed.
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const id = action?.notification?.data?.conversationId
      if (id) onOpenConversation?.(id)
    })

    await PushNotifications.register()
    registered = true
    return true
  } catch {
    return false
  }
}

/**
 * Drop this device's token on sign-out, so the next person to use the
 * phone does not get the previous account's messages.
 */
export async function unregisterPush({ settings, profile }) {
  if (!native) return
  try {
    const supabase = getClient(settings)
    if (supabase && profile) {
      await supabase.from('device_tokens').delete().eq('user_id', profile.id)
    }
    await PushNotifications.removeAllListeners()
    registered = false
  } catch {
    /* signing out must never fail because of this */
  }
}
