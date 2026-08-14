import { useCallback, useEffect, useRef, useState } from 'react'
import { isAppActive, notifyMessage } from './notify.js'
import { getClient } from './supabase.js'

/* ==================================================================
   The inbox.

   The realtime handler patches the list in place from the payload
   itself rather than re-querying — that is what makes the preview under
   each username update the instant a message lands, and it keeps
   working even if a refetch would be slow or rate limited.

   A refetch only happens when something arrives that the list has never
   seen: a brand new conversation, or a sender whose profile is not
   cached yet.
   ================================================================== */

function previewFrom(row) {
  return {
    text: row.body || '',
    attachment: row.attachment || null,
    ts: new Date(row.created_at).getTime(),
    from: row.sender,
  }
}

/**
 * Fold one realtime row into the inbox list.
 *
 * Pure on purpose: this is the piece that decides what shows under a
 * username, so it is kept free of hooks and network calls and can be
 * reasoned about (and tested) on its own.
 */
export function applyIncoming(list, row, { meId, activeId, eventType }) {
  const preview = previewFrom(row)
  const incoming = row.sender !== meId
  const isOpen = activeId === row.conversation_id

  return list
    .map((c) => {
      if (c.id !== row.conversation_id) return c
      // A late-arriving older row must never overwrite a newer preview.
      const stale = c.last && preview.ts < c.last.ts
      let unread = c.unread || 0
      if (isOpen) unread = 0
      else if (incoming && eventType === 'INSERT') unread += 1
      return { ...c, last: stale ? c.last : preview, unread }
    })
    .sort((a, b) => (b.last?.ts || 0) - (a.last?.ts || 0))
}

export function useConversations({ settings, profile, activeConversationId }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Refs so the realtime callback always sees current values without
  // tearing down and rebuilding the subscription on every render.
  const activeRef = useRef(activeConversationId)
  const profilesRef = useRef(new Map())
  const knownRef = useRef(new Set())
  useEffect(() => {
    activeRef.current = activeConversationId
  }, [activeConversationId])

  const refresh = useCallback(async () => {
    const supabase = getClient(settings)
    if (!supabase || !profile) return
    try {
      const { data: mine, error: mineError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', profile.id)
      if (mineError) throw new Error(mineError.message)

      const ids = [...new Set((mine || []).map((m) => m.conversation_id))]
      knownRef.current = new Set(ids)
      if (!ids.length) {
        setConversations([])
        setLoading(false)
        return
      }

      const { data: members, error: membersError } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id')
        .in('conversation_id', ids)
      if (membersError) throw new Error(membersError.message)

      const otherIds = [
        ...new Set((members || []).map((m) => m.user_id).filter((id) => id !== profile.id)),
      ]
      const { data: profiles, error: profilesError } = otherIds.length
        ? await supabase.from('profiles').select('id, username, avatar').in('id', otherIds)
        : { data: [], error: null }
      if (profilesError) throw new Error(profilesError.message)
      for (const p of profiles || []) profilesRef.current.set(p.id, p)

      const { data: recent, error: recentError } = await supabase
        .from('messages')
        .select('id, conversation_id, sender, body, attachment, status, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(400)
      if (recentError) throw new Error(recentError.message)

      const lastByConversation = new Map()
      const unreadByConversation = new Map()
      for (const row of recent || []) {
        // Pick by timestamp rather than trusting the order rows came back
        // in — the preview under a username is too visible to hinge on that.
        const preview = previewFrom(row)
        const held = lastByConversation.get(row.conversation_id)
        if (!held || preview.ts > held.ts) {
          lastByConversation.set(row.conversation_id, preview)
        }
        if (row.sender !== profile.id && row.status !== 'read') {
          unreadByConversation.set(
            row.conversation_id,
            (unreadByConversation.get(row.conversation_id) || 0) + 1,
          )
        }
      }

      const list = ids
        .map((id) => {
          const otherId = (members || []).find(
            (m) => m.conversation_id === id && m.user_id !== profile.id,
          )?.user_id
          return {
            id,
            other: profilesRef.current.get(otherId) || {
              id: otherId,
              username: 'unknown',
              avatar: null,
            },
            last: lastByConversation.get(id) || null,
            unread: unreadByConversation.get(id) || 0,
          }
        })
        .filter((c) => c.other?.id)
        .sort((a, b) => (b.last?.ts || 0) - (a.last?.ts || 0))

      setConversations(list)
      setError(null)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [settings, profile])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  useEffect(() => {
    const supabase = getClient(settings)
    if (!supabase || !profile) return undefined

    const onMessage = (payload) => {
      const row = payload.new
      if (!row?.conversation_id) return

      // Something we have never seen — a new conversation, or a first
      // message from someone whose profile is not cached. Go and fetch.
      if (!knownRef.current.has(row.conversation_id)) {
        refresh()
        return
      }

      const incoming = row.sender !== profile.id
      const isOpen = activeRef.current === row.conversation_id

      setConversations((prev) =>
        applyIncoming(prev, row, {
          meId: profile.id,
          activeId: activeRef.current,
          eventType: payload.eventType,
        }),
      )

      if (incoming && payload.eventType === 'INSERT') {
        const sender = profilesRef.current.get(row.sender)
        notifyMessage({
          title: sender ? `@${sender.username}` : 'New message',
          body: row.body,
          conversationId: row.conversation_id,
          // Nothing to announce if they are already reading that thread.
          suppress: isOpen && isAppActive(),
        })
      }
    }

    const channel = supabase
      .channel(`inbox:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onMessage)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_members' },
        () => refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [settings, profile, refresh])

  /** Clear the badge locally the moment a thread is opened. */
  const markConversationRead = useCallback((id) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))
  }, [])

  const startWith = useCallback(
    async (otherId) => {
      const supabase = getClient(settings)
      if (!supabase) throw new Error('Not connected')
      const { data, error: rpcError } = await supabase.rpc('start_direct_conversation', {
        other: otherId,
      })
      if (rpcError) throw new Error(rpcError.message)
      await refresh()
      return data
    },
    [settings, refresh],
  )

  return { conversations, loading, error, refresh, startWith, markConversationRead }
}
