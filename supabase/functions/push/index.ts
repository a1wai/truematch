/*
 * True Match — push delivery.
 *
 * Called by the messages trigger in supabase/push.sql. Works out who
 * should hear about the message, finds their devices, and hands the
 * notification to Firebase Cloud Messaging.
 *
 * Deploy:
 *   supabase functions deploy push --no-verify-jwt
 *
 * Secrets it needs:
 *   PUSH_SECRET          same string as private.push_config.secret
 *   FCM_SERVICE_ACCOUNT  the Firebase service account JSON, one line
 *   SUPABASE_URL         set automatically
 *   SUPABASE_SERVICE_ROLE_KEY  set automatically
 *
 * --no-verify-jwt is deliberate: the caller is Postgres, not a signed-in
 * user, so it authenticates with PUSH_SECRET instead.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface Payload {
  message_id: string
  conversation_id: string
  sender: string
  body: string | null
  has_attachment?: boolean
}

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

/* ---------- Google OAuth ------------------------------------------------ */

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const raw = atob(body)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

/** Access tokens last an hour; no point minting one per message. */
let cachedToken: { value: string; expires: number } | null = null

async function accessToken(serviceAccount: {
  client_email: string
  private_key: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expires > now + 60) return cachedToken.value

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: FCM_SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  )
  const assertion = `${header}.${claim}.${base64url(signature)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) throw new Error(`google oauth ${res.status}: ${await res.text()}`)

  const json = await res.json()
  cachedToken = { value: json.access_token, expires: now + (json.expires_in ?? 3600) }
  return cachedToken.value
}

/* ---------- the function ------------------------------------------------ */

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const expected = Deno.env.get('PUSH_SECRET')
  const offered = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!expected || offered !== expected) {
    return new Response('unauthorized', { status: 401 })
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return new Response('bad json', { status: 400 })
  }
  if (!payload?.conversation_id || !payload?.sender) {
    return new Response('missing fields', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Everyone in the thread except whoever just spoke.
  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', payload.conversation_id)

  const recipients = (members ?? [])
    .map((m) => m.user_id as string)
    .filter((id) => id !== payload.sender)
  if (!recipients.length) return Response.json({ sent: 0, reason: 'no recipients' })

  const { data: tokenRows } = await supabase
    .from('device_tokens')
    .select('token')
    .in('user_id', recipients)

  const tokens = (tokenRows ?? []).map((t) => t.token as string)
  if (!tokens.length) return Response.json({ sent: 0, reason: 'no devices registered' })

  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', payload.sender)
    .maybeSingle()

  const title = senderProfile?.username ? `@${senderProfile.username}` : 'New message'
  const body = payload.body?.trim()
    ? payload.body
    : payload.has_attachment
      ? 'Sent a photo'
      : 'New message'

  const account = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '{}')
  if (!account.project_id) {
    return new Response('FCM_SERVICE_ACCOUNT is not set', { status: 500 })
  }
  const bearer = await accessToken(account)
  const endpoint = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`

  let sent = 0
  const dead: string[] = []

  await Promise.all(
    tokens.map(async (token) => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            // Also in data, so the tap handler can open the right thread.
            data: {
              conversationId: payload.conversation_id,
              messageId: payload.message_id ?? '',
            },
            android: {
              priority: 'HIGH',
              notification: {
                channel_id: 'messages',
                icon: 'ic_stat_truematch',
                color: '#FF2E63',
                // One entry per thread, matching the in-app behaviour.
                tag: payload.conversation_id,
              },
            },
          },
        }),
      })

      if (res.ok) {
        sent += 1
        return
      }
      // A phone that was wiped, or the app uninstalled. Stop writing to it.
      if (res.status === 404 || res.status === 400) dead.push(token)
    }),
  )

  if (dead.length) {
    await supabase.from('device_tokens').delete().in('token', dead)
  }

  return Response.json({ sent, pruned: dead.length })
})
