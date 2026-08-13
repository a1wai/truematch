import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Loader2, TriangleAlert } from 'lucide-react'
import { fileToAttachment } from '../lib/image.js'

/**
 * Shown once, right after sign-up: every account gets a picture before it can
 * start chatting. The image is downscaled client-side and stored on the profile
 * row, so it syncs with the account rather than living on one device.
 */
export default function AvatarSetup({ username, onSave, onSignOut }) {
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const pick = async (event) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    setError(null)
    try {
      const { src } = await fileToAttachment(file)
      setPreview(src)
    } catch (err) {
      setError(err.message || 'Could not read that image')
    } finally {
      input.value = ''
    }
  }

  const save = async () => {
    if (!preview || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSave(preview)
    } catch (err) {
      setError(err.message || 'Could not save your picture')
      setBusy(false)
    }
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-tm-bg">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-tm-rose/20 blur-[110px]" />

      <div className="relative flex flex-1 flex-col overflow-y-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="m-auto w-full max-w-sm text-center"
        >
          <h1 className="text-2xl font-bold text-tm-text">Add your picture</h1>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-tm-muted">
            This is how <span className="text-tm-text">@{username}</span> shows up to everyone you
            chat with.
          </p>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative mx-auto mt-8 grid h-40 w-40 place-items-center overflow-hidden rounded-full border-2 border-dashed border-tm-rose/40 bg-tm-panel-2/60 transition active:scale-95 hover:border-tm-rose"
          >
            {preview ? (
              <img src={preview} alt="Your picture" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-tm-muted">
                <Camera className="h-8 w-8 text-tm-rose" />
                <span className="text-[12.5px]">Tap to choose</span>
              </span>
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={pick}
            className="hidden"
            aria-hidden="true"
          />

          {preview && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 text-[12.5px] font-medium text-tm-rose-bright"
            >
              Choose a different one
            </button>
          )}

          {error && (
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-rose-500/12 px-3 py-2.5 text-left text-[12.5px] leading-relaxed text-rose-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <button
            onClick={save}
            disabled={!preview || busy}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-tm-rose py-3.5 text-sm font-semibold text-white transition active:scale-[0.99] hover:bg-tm-rose-bright disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue
          </button>

          <button
            onClick={onSignOut}
            className="mt-4 text-[12px] text-tm-muted transition hover:text-tm-text"
          >
            Sign out
          </button>
        </motion.div>
      </div>
    </div>
  )
}
