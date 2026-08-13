import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Loader2, LogOut, Sliders, X } from 'lucide-react'
import { fileToAttachment } from '../lib/image.js'
import Avatar from './Avatar.jsx'

/**
 * The gear menu. Everything that used to sit in a persistent top bar lives
 * here: who you are, changing your picture, settings, and signing out.
 */
export default function MenuSheet({ open, profile, onClose, onOpenSettings, onSignOut, onSaveAvatar }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const changePhoto = async (event) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const { src } = await fileToAttachment(file)
      await onSaveAvatar(src)
    } catch (err) {
      setError(err.message || 'Could not update your picture')
    } finally {
      setBusy(false)
      input.value = ''
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full overflow-hidden rounded-t-2xl border border-white/10 bg-tm-panel pb-2 sm:max-w-sm sm:rounded-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
              <button
                onClick={() => fileRef.current?.click()}
                className="relative shrink-0 rounded-full transition active:scale-95"
                aria-label="Change your picture"
              >
                <Avatar user={profile} size="lg" />
                <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-tm-panel bg-tm-rose text-white">
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-tm-text">@{profile.username}</p>
                <p className="text-[11.5px] text-tm-muted">Tap your picture to change it</p>
              </div>
              <button
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-tm-muted transition active:bg-tm-panel-2"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={changePhoto}
              className="hidden"
              aria-hidden="true"
            />

            {error && (
              <p className="mx-4 mt-3 rounded-xl bg-rose-500/12 px-3 py-2.5 text-[12.5px] text-rose-200">
                {error}
              </p>
            )}

            <div className="p-2">
              <button
                onClick={onOpenSettings}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition active:bg-tm-panel-2"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-tm-panel-2 text-tm-muted">
                  <Sliders className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-tm-text">Settings</span>
                  <span className="block text-[11.5px] text-tm-muted">
                    AI engine, report language, sync
                  </span>
                </span>
              </button>

              <button
                onClick={onSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition active:bg-tm-panel-2"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-300">
                  <LogOut className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-rose-300">Log out</span>
                  <span className="block text-[11.5px] text-tm-muted">
                    You will need your password to get back in
                  </span>
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
