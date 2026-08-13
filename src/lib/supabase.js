import { createClient } from '@supabase/supabase-js'
import { BAKED_SUPABASE_ANON_KEY, BAKED_SUPABASE_URL, normalizeSupabaseUrl } from './cloud-config.js'

/* ==================================================================
   Supabase wiring.

   Config comes from two places, in this order:
     1. Whatever the user typed into Settings (kept in localStorage)
     2. Build-time env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

   The runtime override matters for the APK: an installed Android build
   cannot be re-built with new env vars, so the settings screen has to be
   able to point it at a project after the fact.
   ================================================================== */

export function cloudConfig(settings = {}) {
  const url = normalizeSupabaseUrl(
    settings.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || BAKED_SUPABASE_URL,
  )
  const key = (
    settings.supabaseKey ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    BAKED_SUPABASE_ANON_KEY ||
    ''
  ).trim()
  return { url, key }
}

export function isCloudConfigured(settings) {
  const { url, key } = cloudConfig(settings)
  return Boolean(url && key && /^https?:\/\//.test(url))
}

const REQUEST_TIMEOUT_MS = 20000

/**
 * Without this, a phone on a dead connection leaves the sign-in button
 * spinning forever — supabase-js has no default timeout of its own.
 */
async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('The server did not respond — check your connection and try again')
    }
    throw new Error('Could not reach the server — check your connection')
  } finally {
    clearTimeout(timer)
  }
}

let cached = { signature: null, client: null }

/** One client per url+key pair; swapping config in Settings rebuilds it. */
export function getClient(settings) {
  const { url, key } = cloudConfig(settings)
  if (!url || !key) return null
  const signature = `${url}::${key}`
  if (cached.signature === signature && cached.client) return cached.client
  cached = {
    signature,
    client: createClient(url, key, {
      // Sessions must persist: an installed APK should reopen already signed in.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 10 } },
      global: { fetch: fetchWithTimeout },
    }),
  }
  return cached.client
}

/** Quick reachability probe for the Settings "Test connection" button. */
export async function testCloud(settings) {
  const client = getClient(settings)
  if (!client) throw new Error('Add a project URL and anon key first')
  const started = performance.now()
  const { error, count } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return { ms: Math.round(performance.now() - started), count: count ?? 0 }
}
