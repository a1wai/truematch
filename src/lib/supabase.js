import { createClient } from '@supabase/supabase-js'

/* ==================================================================
   Supabase wiring.

   Config comes from two places, in this order:
     1. Whatever the user typed into Settings (kept in localStorage)
     2. Build-time env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

   The runtime override matters for the APK: an installed Android build
   cannot be re-built with new env vars, so the settings screen has to be
   able to point it at a project after the fact.
   ================================================================== */

export const DEFAULT_ROOM = 'TRUEMATCH-DEMO'

export function cloudConfig(settings = {}) {
  const url = (settings.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '').trim()
  const key = (settings.supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  const room = (settings.roomCode || DEFAULT_ROOM).trim().toUpperCase()
  return { url, key, room }
}

export function isCloudConfigured(settings) {
  const { url, key } = cloudConfig(settings)
  return Boolean(url && key && /^https?:\/\//.test(url))
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
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    }),
  }
  return cached.client
}

/** Database row -> the message shape the UI already speaks. */
export function rowToMessage(row) {
  return {
    id: row.id,
    from: row.sender,
    text: row.body || '',
    ts: new Date(row.created_at).getTime(),
    status: row.status || 'sent',
    attachment: row.attachment || null,
    remote: true,
  }
}

export function messageToRow(message, room) {
  return {
    id: message.id,
    room,
    sender: message.from,
    body: message.text,
    attachment: message.attachment,
    status: message.status || 'sent',
    created_at: new Date(message.ts).toISOString(),
  }
}

/** Quick reachability probe for the Settings "Test connection" button. */
export async function testCloud(settings) {
  const client = getClient(settings)
  if (!client) throw new Error('Add a project URL and anon key first')
  const { room } = cloudConfig(settings)
  const started = performance.now()
  const { error, count } = await client
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('room', room)
  if (error) throw new Error(error.message)
  return { ms: Math.round(performance.now() - started), count: count ?? 0, room }
}
