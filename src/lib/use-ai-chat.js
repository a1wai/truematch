import { useCallback, useEffect, useRef, useState } from 'react'
import { COMPANION_OPENERS, companionReply, offlineReply } from './companion.js'
import { loadAiChat, saveAiChat } from './storage.js'
import { uid } from './utils.js'

/**
 * The AI friend thread. Local to the device and private to the logged-in
 * account — the other person never sees it, and it is not part of the
 * deception scan.
 */
export function useAiChat({ settings, userId, userName }) {
  const [messages, setMessages] = useState([])
  const [typing, setTyping] = useState(false)
  const pending = useRef(null)

  useEffect(() => {
    if (!userId) return
    const stored = loadAiChat(userId)
    if (stored.length) {
      setMessages(stored)
      return
    }
    // First open: she says hello rather than showing an empty room.
    const opener = {
      id: uid('ai'),
      from: 'ai',
      text: COMPANION_OPENERS[Math.floor(Math.random() * COMPANION_OPENERS.length)],
      ts: Date.now(),
      status: 'read',
      attachment: null,
    }
    setMessages([opener])
    saveAiChat(userId, [opener])
  }, [userId])

  useEffect(() => {
    if (userId && messages.length) saveAiChat(userId, messages)
  }, [messages, userId])

  useEffect(() => () => pending.current?.abort(), [])

  const send = useCallback(
    async (text) => {
      const mine = {
        id: uid('ai'),
        from: userId,
        text,
        ts: Date.now(),
        status: 'read',
        attachment: null,
      }
      const history = [...messages, mine]
      setMessages(history)
      setTyping(true)

      const hasModel = settings.apiKey || settings.provider === 'custom'
      let reply
      if (hasModel) {
        pending.current?.abort()
        pending.current = new AbortController()
        try {
          reply = await companionReply({
            history,
            userName,
            language: settings.reportLanguage,
            settings,
            signal: pending.current.signal,
          })
        } catch {
          reply = offlineReply(history)
        }
      } else {
        // A beat of delay so it does not feel like a canned instant reply.
        await new Promise((r) => setTimeout(r, 900 + Math.random() * 700))
        reply = offlineReply(history)
      }

      setTyping(false)
      setMessages((prev) => [
        ...prev,
        { id: uid('ai'), from: 'ai', text: reply, ts: Date.now(), status: 'read', attachment: null },
      ])
    },
    [messages, settings, userId, userName],
  )

  const clear = useCallback(() => {
    setMessages([])
    saveAiChat(userId, [])
  }, [userId])

  return { messages, send, typing, clear }
}
