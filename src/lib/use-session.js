import { useCallback, useEffect, useState } from 'react'
import { currentSession, signIn, signOut, signUp, updateAvatar } from './auth.js'
import { isCloudConfigured } from './supabase.js'

/**
 * Who is signed in. Supabase persists the session itself, so a restart of the
 * app (or the APK) resumes without asking again.
 *
 * `stage` drives which screen App renders:
 *   loading  -> splash
 *   auth     -> login / sign-up
 *   avatar   -> new account, still needs a picture
 *   ready    -> the app proper
 */
export function useSession({ settings }) {
  const [profile, setProfile] = useState(null)
  const [stage, setStage] = useState('loading')
  const [error, setError] = useState(null)
  const configured = isCloudConfigured(settings)

  useEffect(() => {
    let cancelled = false
    if (!configured) {
      setStage('auth')
      setError('No Supabase project configured — add one in Settings')
      return () => {
        cancelled = true
      }
    }
    currentSession(settings)
      .then((found) => {
        if (cancelled) return
        setProfile(found)
        setStage(found ? (found.avatar ? 'ready' : 'avatar') : 'auth')
      })
      .catch(() => {
        if (!cancelled) setStage('auth')
      })
    return () => {
      cancelled = true
    }
  }, [configured, settings])

  const doSignIn = useCallback(
    async (username, password) => {
      setError(null)
      const found = await signIn(settings, username, password)
      setProfile(found)
      setStage(found.avatar ? 'ready' : 'avatar')
      return found
    },
    [settings],
  )

  const doSignUp = useCallback(
    async (username, password) => {
      setError(null)
      const created = await signUp(settings, username, password)
      setProfile(created)
      setStage('avatar') // every new account picks a picture before continuing
      return created
    },
    [settings],
  )

  const doSignOut = useCallback(async () => {
    await signOut(settings).catch(() => {})
    setProfile(null)
    setStage('auth')
  }, [settings])

  const saveAvatar = useCallback(
    async (avatar) => {
      if (!profile) return
      await updateAvatar(settings, profile.id, avatar)
      setProfile((p) => ({ ...p, avatar }))
      setStage('ready')
    },
    [profile, settings],
  )

  return { profile, stage, error, signIn: doSignIn, signUp: doSignUp, signOut: doSignOut, saveAvatar }
}
