import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AUTO_REPLIES, OTHER } from '../data/seed.js'
import { loadMessages, saveMessages } from './storage.js'
import { cloudConfig, getClient, isCloudConfigured, messageToRow, rowToMessage } from './supabase.js'
import { uid } from './utils.js'

/* ==================================================================
   One hook, two backends.

   'local'  — localStorage, plus the scripted auto-reply so a solo demo
              still produces a conversation.
   'cloud'  — Supabase Postgres + realtime, so a message typed on one
              device shows up on the other one.

   The component tree does not care which is active; it gets the same
   messages array, send(), and typing flag either way.
   ================================================================== */

const SIMULATED_TYPING_MS = 1100
const SIMULATED_REPLY_MS = 3400

export function useChat({ settings, userId }) {
  const [messages, setMessages] = useState(() => loadMessages())
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [partnerOnline, setPartnerOnline] = useState(false)
  const [status, setStatus] = useState('local') // local | connecting | live | error
  const [error, setError] = useState(null)

  const channelRef = useRef(null)
  const timers = useRef([])
  const cloud = isCloudConfigured(settings)
  const { room } = useMemo(() => cloudConfig(settings), [settings])

  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }, [])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    },
    [],
  )

  /* ---------------- local persistence ---------------- */

  useEffect(() => {
    if (!cloud) saveMessages(messages)
  }, [messages, cloud])

  /* ---------------- cloud connection ---------------- */

  useEffect(() => {
    if (!cloud || !userId) {
      setStatus('local')
      return undefined
    }

    const client = getClient(settings)
    if (!client) return undefined

    let cancelled = false
    setStatus('connecting')
    setError(null)

    const upsert = (incoming) =>
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== incoming.id)
        next.push(incoming)
        return next.sort((x, y) => x.ts - y.ts)
      })

    async function connect() {
      const { data, error: loadError } = await client
        .from('messages')
        .select('*')
        .eq('room', room)
        .order('created_at', { ascending: true })
        .limit(1000)

      if (cancelled) return
      if (loadError) {
        setError(loadError.message)
        setStatus('error')
        return
      }
      setMessages(data.map(rowToMessage))

      const channel = client
        .channel(`room:${room}`, { config: { presence: { key: userId } } })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `room=eq.${room}` },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              setMessages((prev) => prev.filter((m) => m.id !== payload.old?.id))
              return
            }
            upsert(rowToMessage(payload.new))
          },
        )
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (payload?.from === userId) return
          setPartnerTyping(Boolean(payload?.typing))
          if (payload?.typing) later(() => setPartnerTyping(false), 6000)
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          const others = Object.keys(state).filter((k) => k !== userId)
          setPartnerOnline(others.length > 0)
        })

      channel.subscribe((state) => {
        if (cancelled) return
        if (state === 'SUBSCRIBED') {
          setStatus('live')
          channel.track({ user: userId, at: Date.now() })
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          setStatus('error')
          setError('Realtime channel dropped. Check the project URL, key and RLS policies.')
        }
      })

      channelRef.current = channel
    }

    connect().catch((err) => {
      if (cancelled) return
      setError(err?.message || String(err))
      setStatus('error')
    })

    return () => {
      cancelled = true
      const channel = channelRef.current
      channelRef.current = null
      if (channel) client.removeChannel(channel)
      setPartnerOnline(false)
      setPartnerTyping(false)
    }
  }, [cloud, room, settings, userId, later])

  /* ---------------- actions ---------------- */

  const send = useCallback(
    async (text) => {
      if (!userId) return
      const message = {
        id: uid('msg'),
        from: userId,
        text,
        ts: Date.now(),
        status: 'sent',
        attachment: null,
      }

      if (cloud) {
        // Optimistic: the row echoes back through the realtime subscription and
        // replaces this one by id.
        setMessages((prev) => [...prev, message])
        const client = getClient(settings)
        const { error: sendError } = await client.from('messages').insert(messageToRow(message, room))
        if (sendError) {
          setError(sendError.message)
          setMessages((prev) =>
            prev.map((m) => (m.id === message.id ? { ...m, status: 'failed' } : m)),
          )
        }
        return
      }

      setMessages((prev) => [...prev, message])
      later(
        () =>
          setMessages((prev) =>
            prev.map((m) => (m.id === message.id ? { ...m, status: 'delivered' } : m)),
          ),
        700,
      )

      if (!settings.simulateReplies) return
      later(() => setPartnerTyping(true), SIMULATED_TYPING_MS)
      later(() => {
        setPartnerTyping(false)
        setMessages((prev) => [
          ...prev.map((m) => (m.id === message.id ? { ...m, status: 'read' } : m)),
          {
            id: uid('msg'),
            from: OTHER[userId],
            text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)],
            ts: Date.now(),
            status: 'delivered',
            attachment: null,
          },
        ])
      }, SIMULATED_REPLY_MS)
    },
    [cloud, later, room, settings, userId],
  )

  /** Broadcast-only; never persisted. */
  const setTyping = useCallback(
    (isTyping) => {
      if (!cloud) return
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { from: userId, typing: isTyping },
      })
    },
    [cloud, userId],
  )

  /** Everything addressed to the current viewer counts as read. */
  const markRead = useCallback(async () => {
    if (!userId) return
    const unread = messages.filter((m) => m.from !== userId && m.status !== 'read')
    if (!unread.length) return
    setMessages((prev) =>
      prev.map((m) => (m.from !== userId && m.status !== 'read' ? { ...m, status: 'read' } : m)),
    )
    if (!cloud) return
    const client = getClient(settings)
    await client
      .from('messages')
      .update({ status: 'read' })
      .eq('room', room)
      .neq('sender', userId)
      .neq('status', 'read')
  }, [cloud, messages, room, settings, userId])

  const replaceLocal = useCallback((next) => setMessages(next), [])

  return {
    messages,
    send,
    setTyping,
    markRead,
    replaceLocal,
    partnerTyping,
    partnerOnline,
    status,
    error,
    mode: cloud ? 'cloud' : 'local',
    room,
  }
}
