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
  if (error) throw new Error(describeDbError(error.message))
  return Boolean(data)
}

export async function signUp(settings, username, password) {
  const supabase = client(settings)
  const clean = normalizeUsername(username)

  if (await isUsernameTaken(settings, clean)) {
    throw new Error('That username is taken')
  }

  // Preferred path: create the account in the database.
  //
  // Supabase Auth's sign-up endpoint is email-shaped — it tries to send
  // confirmation mail, and two separate dashboard toggles can disable it
  // outright. This app has usernames and no inboxes, so create_account() makes
  // the auth row directly and marks it confirmed. Login below is still ordinary
  // Supabase Auth.
  const { error: rpcError } = await supabase.rpc('create_account', {
    p_username: clean,
    p_password: password,
  })

  if (rpcError) {
    const missing =
      /could not find the function|schema cache|does not exist|404/i.test(rpcError.message)
    if (!missing) throw new Error(describeDbError(rpcError.message))
    // Older setup that has not run the updated SQL yet — fall back to the
    // built-in endpoint so the app still works.
    return signUpViaAuthEndpoint(supabase, clean, password)
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailFor(clean),
    password,
  })
  if (error) throw new Error(friendlyAuthError(error.message))
  return loadProfile(settings, data.user.id)
}

/** Fallback for projects still on the older schema. */
async function signUpViaAuthEndpoint(supabase, clean, password) {
  const { data, error } = await supabase.auth.signUp({
    email: emailFor(clean),
    password,
  })
  if (error) throw new Error(friendlyAuthError(error.message))
  if (!data.session) {
    throw new Error(
      'This project still has email confirmation enabled. Re-run supabase/setup.sql, or turn it off under Authentication → Sign In / Providers → Email.',
    )
  }
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, username: clean })
  if (profileError) {
    if (/duplicate|unique/i.test(profileError.message)) throw new Error('That username is taken')
    throw new Error(describeDbError(profileError.message))
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
  if (error) throw new Error(describeDbError(error.message))
  if (!data) throw new Error('Profile missing for this account')
  return data
}

export async function updateAvatar(settings, id, avatar) {
  const { error } = await client(settings).from('profiles').update({ avatar }).eq('id', id)
  if (error) throw new Error(describeDbError(error.message))
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
  if (error) throw new Error(describeDbError(error.message))
  return (data || []).filter((p) => p.id !== excludeId)
}

/**
 * PostgREST reports a missing table as a "schema cache" miss, which tells the
 * person holding the phone nothing. Name the actual fix instead.
 */
export function describeDbError(message = '') {
  const m = message.toLowerCase()
  if (m.includes('schema cache') || m.includes('does not exist') || m.includes('relation')) {
    return 'The database is not set up yet. Run supabase/schema.sql in the Supabase SQL editor, then try again.'
  }
  if (m.includes('row-level security') || m.includes('violates row-level') || m.includes('permission denied')) {
    return 'The database rejected that. Re-run supabase/schema.sql so the access policies are in place.'
  }
  if (m.includes('jwt') || m.includes('invalid api key') || m.includes('apikey')) {
    return 'This build has the wrong project key. Check Settings → Realtime sync.'
  }
  return message
}

/** Supabase's auth errors are written for developers, not for this screen. */
function friendlyAuthError(message = '') {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Wrong username or password'
  if (m.includes('signups not allowed') || m.includes('email signups are disabled') ||
      m.includes('signup_disabled') || m.includes('email_provider_disabled')) {
    return 'Sign-ups are switched off in Supabase. Re-run supabase/setup.sql so the app can create accounts itself, or re-enable the Email provider.'
  }
  if (m.includes('user already registered')) return 'That username is taken'
  if (m.includes('password should be')) return 'Password must be at least 6 characters'
  if (m.includes('email address') && m.includes('invalid')) {
    return 'That username cannot be used — try letters, numbers, dots or underscores'
  }
  // The built-in mailer allows only a couple of sends per hour. Hitting that
  // limit means confirmation emails are still being sent — i.e. "Confirm email"
  // was never switched off. Saying "too many attempts" hides the real cause.
  if (
    m.includes('email rate limit') ||
    m.includes('over_email_send_rate_limit') ||
    (m.includes('rate limit') && m.includes('email'))
  ) {
    return 'Sign-ups are still trying to send a confirmation email. Turn OFF Authentication → Sign In / Providers → Email → "Confirm email", then wait a minute and try again.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts — wait a minute. If this keeps happening, check that "Confirm email" is switched off in Supabase.'
  }
  if (m.includes('database error') || m.includes('unexpected_failure')) {
    return 'The database is not set up yet. Run supabase/schema.sql in the Supabase SQL editor, then try again.'
  }
  return describeDbError(message)
}
