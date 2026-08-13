import { getClient } from './supabase.js'

/* ==================================================================
   Username + password accounts on top of Supabase Auth.

   People sign in with a username. Supabase Auth needs an email, so the
   app derives a synthetic one (<username>@truematch.app) and never shows
   it. That keeps password hashing, sessions and refresh tokens inside
   Supabase rather than hand-rolled in the client.

   There is no password reset by design — the schema comment and the UI
   both say so. Recovery means asking an admin.
   ================================================================== */

const EMAIL_DOMAIN = 'truematch.app'

export const USERNAME_RULES = {
  min: 3,
  max: 20,
  pattern: /^[a-z0-9_.]+$/,
}

export function normalizeUsername(value) {
  return (value || '').trim().toLowerCase()
}

/** Returns an error string, or null when the username is acceptable. */
export function validateUsername(value) {
  const u = normalizeUsername(value)
  if (u.length < USERNAME_RULES.min) return `At least ${USERNAME_RULES.min} characters`
  if (u.length > USERNAME_RULES.max) return `At most ${USERNAME_RULES.max} characters`
  if (!USERNAME_RULES.pattern.test(u)) return 'Only letters, numbers, dots and underscores'
  return null
}

export function validatePassword(value) {
  if (!value || value.length < 6) return 'At least 6 characters'
  return null
}

function emailFor(username) {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`
}

function client(settings) {
  const c = getClient(settings)
  if (!c) throw new Error('No Supabase project configured')
  return c
}

/** Cheap pre-check so sign-up can say "taken" before submitting. */
export async function isUsernameTaken(settings, username) {
  const { data, error } = await client(settings)
    .from('profiles')
    .select('id')
    .eq('username', normalizeUsername(username))
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function signUp(settings, username, password) {
  const supabase = client(settings)
  const clean = normalizeUsername(username)

  if (await isUsernameTaken(settings, clean)) {
    throw new Error('That username is taken')
  }

  const { data, error } = await supabase.auth.signUp({
    email: emailFor(clean),
    password,
  })
  if (error) throw new Error(friendlyAuthError(error.message))

  // No session means the project still has email confirmation switched on —
  // fatal here, because these accounts have no real inbox to confirm from.
  if (!data.session) {
    throw new Error(
      'This project still has email confirmation enabled. Turn it off under Authentication → Sign In / Providers → Email, then sign up again.',
    )
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, username: clean })
  if (profileError) {
    if (/duplicate|unique/i.test(profileError.message)) throw new Error('That username is taken')
    throw new Error(profileError.message)
  }

  return { id: data.user.id, username: clean, avatar: null }
}

export async function signIn(settings, username, password) {
  const supabase = client(settings)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailFor(username),
    password,
  })
  if (error) throw new Error(friendlyAuthError(error.message))
  return loadProfile(settings, data.user.id)
}

export async function signOut(settings) {
  await client(settings).auth.signOut()
}

export async function currentSession(settings) {
  const supabase = getClient(settings)
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (!data?.session?.user) return null
  try {
    return await loadProfile(settings, data.session.user.id)
  } catch {
    return null
  }
}

export async function loadProfile(settings, id) {
  const { data, error } = await client(settings)
    .from('profiles')
    .select('id, username, avatar')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Profile missing for this account')
  return data
}

export async function updateAvatar(settings, id, avatar) {
  const { error } = await client(settings).from('profiles').update({ avatar }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Username search for the "add someone" screen. Prefix match, case-insensitive. */
export async function searchProfiles(settings, query, excludeId) {
  const q = normalizeUsername(query)
  if (q.length < 2) return []
  const { data, error } = await client(settings)
    .from('profiles')
    .select('id, username, avatar')
    .ilike('username', `${q}%`)
    .limit(20)
  if (error) throw new Error(error.message)
  return (data || []).filter((p) => p.id !== excludeId)
}

/** Supabase's auth errors are written for developers, not for this screen. */
function friendlyAuthError(message = '') {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Wrong username or password'
  if (m.includes('user already registered')) return 'That username is taken'
  if (m.includes('password should be')) return 'Password must be at least 6 characters'
  if (m.includes('email address') && m.includes('invalid')) {
    return 'That username cannot be used — try letters, numbers, dots or underscores'
  }
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts — wait a minute'
  return message
}
