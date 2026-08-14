import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'

/* ==================================================================
   The device back gesture.

   Every Android phone has one — a button, a swipe from the edge, a
   three-finger something — and in a messaging app it is the main way
   people move around. Without it, back closes the whole app from
   wherever you are, which is what made this feel like a web page
   rather than an app.

   The handler is asked to deal with the press and says whether it did.
   If nothing wanted it, the app closes, which is what Android expects
   from the home screen of an app.

   The web path uses a history entry as a trap so the same code answers
   the browser back button, which also makes this testable outside an
   APK.
   ================================================================== */

const native = Capacitor.isNativePlatform()

/**
 * @param handler () => boolean — true when the press was consumed.
 * @returns unsubscribe
 */
export function onHardwareBack(handler) {
  if (native) {
    const pending = CapApp.addListener('backButton', () => {
      if (!handler()) CapApp.exitApp()
    })
    return () => {
      pending.then((h) => h.remove()).catch(() => {})
    }
  }

  if (typeof window === 'undefined' || !window.history) return () => {}

  // Sit one entry deep, so there is always something for back to pop
  // without leaving the app.
  const arm = () => window.history.pushState({ truematch: true }, '')
  arm()

  const onPop = () => {
    const consumed = handler()
    // Re-arm either way: consumed means stay put, and not-consumed on the
    // web means there is nowhere to go anyway.
    arm()
    return consumed
  }

  window.addEventListener('popstate', onPop)
  return () => window.removeEventListener('popstate', onPop)
}
