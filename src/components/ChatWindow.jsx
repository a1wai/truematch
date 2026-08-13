import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown,
  ChevronLeft,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Video,
} from 'lucide-react'
import { USERS } from '../data/seed.js'
import { cn, dayLabel, startOfDay } from '../lib/utils.js'
import Avatar from './Avatar.jsx'
import MessageBubble from './MessageBubble.jsx'

function DaySeparator({ ts }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-lg bg-wa-panel-2/90 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-wa-muted shadow-sm">
        {dayLabel(ts)}
      </span>
    </div>
  )
}

function TypingIndicator({ user }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex items-end gap-2 px-3 pb-1 sm:px-6"
    >
      <div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-wa-panel-2 px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-wa-muted"
            style={{ animation: 'bob 1.2s ease-in-out infinite', animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
      <span className="pb-1 text-[11px] text-wa-muted">{user.name.split(' ')[0]} is typing…</span>
    </motion.div>
  )
}

export default function ChatWindow({
  messages,
  viewingAs,
  partnerId,
  typing,
  onSend,
  onOpenScan,
  flaggedIds,
  highlightsById,
  revealFlags,
  focusMessageId,
  injectedDraft,
  onDraftConsumed,
  onBack,
}) {
  const [draft, setDraft] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const partner = USERS[partnerId]

  const rows = useMemo(() => {
    const out = []
    let lastDay = null
    let lastFrom = null
    for (const m of messages) {
      const day = startOfDay(m.ts)
      if (day !== lastDay) {
        out.push({ type: 'day', id: `day_${day}`, ts: m.ts })
        lastDay = day
        lastFrom = null
      }
      out.push({ type: 'msg', id: m.id, message: m, showTail: m.from !== lastFrom })
      lastFrom = m.from
    }
    return out
  }, [messages])

  // Stick to the bottom as the thread grows, unless the reader scrolled up.
  useLayoutEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ block: 'end' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, typing])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      setAtBottom(distance < 120)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Jumping from a flagged item in the report to the message itself.
  useEffect(() => {
    if (!focusMessageId) return
    const node = scrollRef.current?.querySelector(`[data-message-id="${focusMessageId}"]`)
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusMessageId])

  // "Load into composer" from a counter-strategy suggestion.
  useEffect(() => {
    if (!injectedDraft) return
    setDraft(injectedDraft)
    inputRef.current?.focus()
    onDraftConsumed?.()
  }, [injectedDraft, onDraftConsumed])

  const send = (e) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
    setAtBottom(true)
  }

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-wa-bg">
      {/* Header */}
      <header className="z-20 flex items-center gap-3 border-b border-white/5 bg-wa-panel px-2 py-2 sm:px-4">
        <button
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-full text-wa-muted transition hover:bg-wa-panel-2 md:hidden"
          aria-label="Back to chats"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Avatar user={partner} size="md" online />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-wa-text">{partner.name}</p>
          <p className="truncate text-xs text-wa-muted">
            {typing ? (
              <span className="text-wa-teal-bright">typing…</span>
            ) : (
              'online · end-to-end encrypted'
            )}
          </p>
        </div>

        <button
          onClick={onOpenScan}
          className="group relative flex items-center gap-2 rounded-xl bg-wa-teal px-3 py-2 text-xs font-semibold text-wa-bg transition hover:bg-wa-teal-bright active:scale-[0.98] sm:px-4"
          style={{ animation: 'pulse-glow 2.4s ease-in-out infinite' }}
          title="Run Sneaky Lie & Deception Scan"
        >
          <span className="text-sm leading-none">🕵️‍♂️</span>
          <span className="hidden sm:inline">Run Sneaky Lie &amp; Deception Scan</span>
          <span className="sm:hidden">Scan</span>
        </button>

        <div className="hidden items-center text-wa-muted lg:flex">
          {[Video, Phone, Search, MoreVertical].map((Icon, i) => (
            <button
              key={i}
              className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-wa-panel-2 hover:text-wa-text"
              aria-label="Chat action"
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>
      </header>

      {/* Feed */}
      <div ref={scrollRef} className="chat-wallpaper flex-1 overflow-y-auto py-3">
        <div className="mx-auto flex max-w-4xl flex-col gap-0.5">
          <div className="mx-3 mb-4 flex justify-center sm:mx-6">
            <p className="max-w-md rounded-lg bg-amber-400/10 px-3 py-2 text-center text-[11px] leading-relaxed text-amber-200/80">
              🔒 Messages are end-to-end encrypted. No one outside of this chat can read them.
            </p>
          </div>

          {rows.map((row) =>
            row.type === 'day' ? (
              <DaySeparator key={row.id} ts={row.ts} />
            ) : (
              <MessageBubble
                key={row.id}
                message={row.message}
                outgoing={row.message.from === viewingAs}
                showTail={row.showTail}
                flagged={flaggedIds?.has(row.message.id)}
                highlights={highlightsById?.get(row.message.id)}
                revealFlags={revealFlags}
                pulsing={focusMessageId === row.message.id}
              />
            ),
          )}

          <AnimatePresence>{typing && <TypingIndicator user={partner} />}</AnimatePresence>
          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {/* Jump to latest */}
      <AnimatePresence>
        {!atBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onClick={() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              setAtBottom(true)
            }}
            className="absolute bottom-24 right-5 grid h-10 w-10 place-items-center rounded-full bg-wa-panel-2 text-wa-text shadow-lg shadow-black/40 transition hover:bg-wa-panel-3"
            aria-label="Jump to latest message"
          >
            <ArrowDown className="h-4.5 w-4.5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Composer */}
      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-white/5 bg-wa-panel px-2 py-2.5 sm:px-4"
      >
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-wa-muted transition hover:bg-wa-panel-2 hover:text-wa-text"
          aria-label="Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-wa-muted transition hover:bg-wa-panel-2 hover:text-wa-text"
          aria-label="Attach"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e)
          }}
          placeholder={`Message as ${USERS[viewingAs].name.split(' ')[0]}…`}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl bg-wa-panel-2 px-4 py-2.5 text-[14.5px] text-wa-text placeholder:text-wa-muted/70 focus:outline-none focus:ring-1 focus:ring-wa-teal/40"
        />
        <button
          type="submit"
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-full transition',
            draft.trim()
              ? 'bg-wa-teal text-wa-bg hover:bg-wa-teal-bright'
              : 'text-wa-muted hover:bg-wa-panel-2 hover:text-wa-text',
          )}
          aria-label={draft.trim() ? 'Send' : 'Record voice message'}
        >
          {draft.trim() ? <Send className="h-4.5 w-4.5" /> : <Mic className="h-5 w-5" />}
        </button>
      </form>
    </section>
  )
}
