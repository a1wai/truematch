import { useCallback, useEffect, useRef, useState } from 'react'
import { onResume, reconnectRealtime } from './resume.js'
import { getClient } from './supabase.js'
import { uid } from './utils.js'

/* ==================================================================
   One conversation, live.

   Messages, typing broadcasts, presence and read receipts all ride the
   same realtime channel. Everything is stored in Supabase — nothing
   about a conversation lives only on the device.

   The socket delivers in milliseconds when it is healthy, but a phone
   suspends the WebView the moment you switch apps and the socket can go
   quiet without reporting an error. So a catch-up query runs alongside
   it: every few seconds, and immediately on resume, ask for anything
   newer than the newest message held. It normally returns nothing and
   costs one indexed lookup — and it is the reason a chat cannot sit
   there stale.
   ================================================================== */

const CATCH_UP_MS = 6000

function rowToMessage(row) {
  return {
    id: row.id,
    from: row.sender,
    text: row.body || '',
    ts: new Date(row.created_at).getTime(),
    status: row.status || 'sent',
    attachment: row.attachment || null,
  }
}

export function useChat({ settings, profile, conversationId }) {
  const [messages, setMessages] = useState([])
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [partnerOnline, setPartnerOnline] = useState(false)
  const [status, setStatus] = useState('idle') // idle | connecting | live | error
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  const channelRef = useRef(null)
  const retryRef = useRef(null)
  const typingClearRef = useRef(null)
  // Newest created_at we hold, so the catch-up query stays tiny.
  const highWaterRef = useRef(null)

  useEffect(
    () => () => {
      clearTimeout(retryRef.current)
      clearTimeout(typingClearRef.current)
    },
    [],
  )

  /** Phones lose signal. Back off and retry instead of staying broken. */
  const scheduleRetry = useCallback((n) => {
    clearTimeout(retryRef.current)
    const delay = Math.min(60000, 5000 * 2 ** Math.min(n, 4))
    retryRef.current = setTimeout(() => setAttempt((a) => a + 1), delay)
  }, [])

  useEffect(() => {
    const supabase = getClient(settings)
    if (!supabase || !profile || !conversationId) {
      setMessages([])
      setStatus('idle')
      return undefined
    }

    let cancelled = false
    setStatus('connecting')
    setError(null)
    // Belongs to the conversation being left, not the one being opened.
    highWaterRef.current = null

    const upsert = (incoming) =>
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== incoming.id)
        next.push(incoming)
        return next.sort((x, y) => x.ts - y.ts)
      })

    const remember = (rows) => {
      for (const row of rows) {
        if (!highWaterRef.current || row.created_at > highWaterRef.current) {
          highWaterRef.current = row.created_at
        }
      }
    }

    async function connect() {
      const { data, error: loadError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(1000)

      if (cancelled) return
      if (loadError) {
        setError(loadError.message)
        setStatus('error')
        scheduleRetry(attempt)
        return
      }
      setMessages(data.map(rowToMessage))
      remember(data)

      const channel = supabase
        .channel(`conv:${conversationId}`, { config: { presence: { key: profile.id } } })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              setMessages((prev) => prev.filter((m) => m.id !== payload.old?.id))
              return
            }
            remember([payload.new])
            upsert(rowToMessage(payload.new))
          },
        )
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (payload?.from === profile.id) return
          setPartnerTyping(Boolean(payload?.typing))
          clearTimeout(typingClearRef.current)
          if (payload?.typing) {
            typingClearRef.current = setTimeout(() => setPartnerTyping(false), 6000)
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          setPartnerOnline(Object.keys(state).some((k) => k !== profile.id))
        })

      channel.subscribe((state) => {
        if (cancelled) return
        if (state === 'SUBSCRIBED') {
          clearTimeout(retryRef.current)
          setAttempt(0)
          setStatus('live')
          channel.track({ user: profile.id, at: Date.now() })
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          setStatus('error')
          setError('Connection dropped')
          scheduleRetry(attempt)
        }
      })

      channelRef.current = channel
    }

    connect().catch((err) => {
      if (cancelled) return
      setError(err?.message || String(err))
      setStatus('error')
      scheduleRetry(attempt)
    })

    return () => {
      cancelled = true
      const channel = channelRef.current
      channelRef.current = null
      if (channel) supabase.removeChannel(channel)
      setPartnerTyping(false)
      setPartnerOnline(false)
    }
  }, [settings, profile, conversationId, attempt, scheduleRetry])

  /* ------------------------------------------------------------------
     The safety net.

     Ask for anything newer than what we hold. Runs on a timer, and again
     the moment the app is brought back to the foreground — which is
     exactly when the socket has usually just been killed and has not
     admitted it yet.
     ------------------------------------------------------------------ */
  useEffect(() => {
    const supabase = getClient(settings)
    if (!supabase || !profile || !conversationId) return undefined

    let running = false
    const catchUp = async () => {
      if (running || typeof document === 'undefined') return
      if (document.visibilityState === 'hidden') return
      running = true
      try {
        let query = supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(200)
        if (highWaterRef.current) {
          // Overlap by half a minute. Two phones do not agree on the time,
          // and created_at is stamped by the sender — without the overlap a
          // message from a slow clock could land below the mark and never
          // be asked for. Rows are keyed by id, so re-reading is harmless.
          query = query.gt(
            'created_at',
            new Date(Date.parse(highWaterRef.current) - 30000).toISOString(),
          )
        }

        const { data, error: pollError } = await query
        if (pollError) return

        // A query that came back at all proves there is a working
        // connection, whatever the socket believes about itself.
        setStatus((s) => (s === 'error' ? 'live' : s))
        if (!data?.length) return

        for (const row of data) {
          if (!highWaterRef.current || row.created_at > highWaterRef.current) {
            highWaterRef.current = row.created_at
          }
        }
        let added = false
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]))
          for (const row of data) {
            if (!byId.has(row.id)) added = true
            byId.set(row.id, rowToMessage(row))
          }
          return added ? [...byId.values()].sort((x, y) => x.ts - y.ts) : prev
        })
        // Messages the socket should have delivered arrived by query
        // instead, so the socket is not doing its job. Rebuild it.
        if (added) reconnectRealtime(supabase)
      } catch {
        /* offline; the next tick tries again */
      } finally {
        running = false
      }
    }

    const timer = setInterval(catchUp, CATCH_UP_MS)
    const stop = onResume(() => {
      reconnectRealtime(supabase, { force: true })
      catchUp()
    })
    return () => {
      clearInterval(timer)
      stop()
    }
  }, [settings, profile, conversationId])

  const send = useCallback(
    async (text, attachment = null) => {
      const supabase = getClient(settings)
      if (!supabase || !profile || !conversationId) return
      if (!text?.trim() && !attachment) return

      const message = {
        id: uid('msg'),
        from: profile.id,
        text: text?.trim() || '',
        ts: Date.now(),
        status: 'sent',
        attachment,
      }
      // Optimistic; the realtime echo replaces it by id.
      setMessages((prev) => [...prev, message])

      const { error: sendError } = await supabase.from('messages').insert({
        id: message.id,
        conversation_id: conversationId,
        sender: profile.id,
        body: message.text,
        attachment,
        status: 'sent',
        created_at: new Date(message.ts).toISOString(),
      })

      if (sendError) {
        setError(sendError.message)
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'failed' } : m)))
      }
    },
    [settings, profile, conversationId],
  )

  const setTyping = useCallback(
    (isTyping) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { from: profile?.id, typing: isTyping },
      })
    },
    [profile],
  )

  const markRead = useCallback(async () => {
    const supabase = getClient(settings)
    if (!supabase || !profile || !conversationId) return
    const unread = messages.filter((m) => m.from !== profile.id && m.status !== 'read')
    if (!unread.length) return
    setMessages((prev) =>
      prev.map((m) => (m.from !== profile.id && m.status !== 'read' ? { ...m, status: 'read' } : m)),
    )
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('conversation_id', conversationId)
      .neq('sender', profile.id)
      .neq('status', 'read')
  }, [settings, profile, conversationId, messages])

  return { messages, send, setTyping, markRead, partnerTyping, partnerOnline, status, error }
}
