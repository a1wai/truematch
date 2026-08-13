import { useCallback, useEffect, useRef, useState } from 'react'
import { getClient } from './supabase.js'

/**
 * The chat list: every conversation this account belongs to, with the other
 * person's profile and the last message attached.
 *
 * Kept deliberately simple — a handful of queries rather than one clever join —
 * because PostgREST embedding across a join table is fragile and this list is
 * small in a beta.
 */
export function useConversations({ settings, profile }) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const channelRef = useRef(null)

  const refresh = useCallback(async () => {
    const supabase = getClient(settings)
    if (!supabase || !profile) return
    try {
      const { data: mine, error: mineError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', profile.id)
      if (mineError) throw new Error(mineError.message)

      const ids = (mine || []).map((m) => m.conversation_id)
      if (!ids.length) {
        setConversations([])
        setLoading(false)
        return
      }

      // Everyone in those conversations, so we can pick out the other person.
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
      const byId = new Map((profiles || []).map((p) => [p.id, p]))

      const { data: recent, error: recentError } = await supabase
        .from('messages')
        .select('id, conversation_id, sender, body, attachment, status, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(300)
      if (recentError) throw new Error(recentError.message)

      const lastByConversation = new Map()
      const unreadByConversation = new Map()
      for (const row of recent || []) {
        if (!lastByConversation.has(row.conversation_id)) {
          lastByConversation.set(row.conversation_id, row)
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
          const last = lastByConversation.get(id)
          return {
            id,
            other: byId.get(otherId) || { id: otherId, username: 'unknown', avatar: null },
            last: last
              ? {
                  text: last.body,
                  attachment: last.attachment,
                  ts: new Date(last.created_at).getTime(),
                  from: last.sender,
                }
              : null,
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
    refresh()
  }, [refresh])

  // Any new message anywhere re-sorts the list and updates previews.
  useEffect(() => {
    const supabase = getClient(settings)
    if (!supabase || !profile) return undefined
    const channel = supabase
      .channel(`inbox:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refresh())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_members' },
        () => refresh(),
      )
      .subscribe()
    channelRef.current = channel
    return () => {
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [settings, profile, refresh])

  /** Open (or reopen) the 1:1 thread with someone. Server-side, so no dupes. */
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

  return { conversations, loading, error, refresh, startWith }
}
