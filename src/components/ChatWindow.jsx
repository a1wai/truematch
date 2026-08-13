import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ChevronLeft, Cloud, CloudOff, Mic, Paperclip, Search, Send, Smile } from 'lucide-react'
import { USERS } from '../data/seed.js'
import { cn, dayLabel, relativeTime, startOfDay } from '../lib/utils.js'
import Avatar from './Avatar.jsx'
import MessageBubble from './MessageBubble.jsx'

function DaySeparator({ ts }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-lg bg-tm-panel-2/90 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-tm-muted shadow-sm">
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
      <div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-tm-panel-2 px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-tm-muted"
            style={{ animation: 'bob 1.2s ease-in-out infinite', animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
      <span className="pb-1 text-[11px] text-tm-muted">{user.name.split(' ')[0]} is typing…</span>
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
  online = false,
  live = false,
  room,
  onTypingChange,
}) {
  const [draft, setDraft] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimer = useRef(null)
  const partner = USERS[partnerId]

  const lastIncoming = useMemo(
    () => [...messages].reverse().find((m) => m.from === partnerId),
    [messages, partnerId],
  )
  const lastSeenLabel = lastIncoming ? `last seen ${relativeTime(lastIncoming.ts)}` : 'offline'

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

  // Broadcast "typing" on the first keystroke, then stop 2s after the last one.
  const handleDraft = (value) => {
    setDraft(value)
    if (!onTypingChange) return
    if (!typingTimer.current) onTypingChange(true)
    else clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      typingTimer.current = null
      onTypingChange(false)
    }, 2000)
  }

  useEffect(() => () => clearTimeout(typingTimer.current), [])

  const send = (e) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text) return
    clearTimeout(typingTimer.current)
    typingTimer.current = null
    onTypingChange?.(false)
    onSend(text)
    setDraft('')
    setAtBottom(true)
  }

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-tm-bg">
      {/* Header — presence, search, and the scan button. No call icons. */}
      <header className="z-20 flex items-center gap-2.5 border-b border-white/5 bg-tm-panel px-2 py-2 sm:gap-3 sm:px-4">
        <button
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-tm-muted transition hover:bg-tm-panel-2 md:hidden"
          aria-label="Back to chats"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Avatar user={partner} size="md" online={online} ring={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-tm-text">{partner.name}</p>
          <p className="truncate text-xs">
            {typing ? (
              <span className="text-tm-rose-bright">typing…</span>
            ) : online ? (
              <span className="text-emerald-400/90">online</span>
            ) : (
              <span className="text-tm-muted">{lastSeenLabel}</span>
            )}
          </p>
        </div>

        <span
          className={cn(
            'hidden shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10.5px] font-medium sm:inline-flex',
            live
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              : 'border-white/10 text-tm-muted',
          )}
          title={live ? `Live sync · room ${room}` : 'Offline — messages stay on this device'}
        >
          {live ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
          {live ? 'Live' : 'Local'}
        </span>

        <button
          onClick={onOpenScan}
          className="group relative flex shrink-0 items-center gap-2 rounded-xl bg-tm-rose px-3 py-2 text-xs font-semibold text-white transition hover:bg-tm-rose-bright active:scale-[0.98] sm:px-4"
          style={{ animation: 'pulse-glow 2.4s ease-in-out infinite' }}
          title="Run Sneaky Lie Scan"
        >
          <span className="text-sm leading-none">🕵️‍♂️</span>
          <span className="hidden sm:inline">Run Sneaky Lie Scan</span>
          <span className="sm:hidden">Scan</span>
        </button>

        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-tm-muted transition hover:bg-tm-panel-2 hover:text-tm-text"
          aria-label="Search in conversation"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
      </header>

      {/* Feed */}
      <div ref={scrollRef} className="chat-wallpaper flex-1 overflow-y-auto py-3">
        <div className="mx-auto flex max-w-4xl flex-col gap-0.5">
          <div className="mx-3 mb-4 flex justify-center sm:mx-6">
            <p className="max-w-md rounded-lg bg-tm-rose/10 px-3 py-2 text-center text-[11px] leading-relaxed text-tm-rose-soft/90">
              💕 Just the two of you. Messages sync live between your devices.
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
            className="absolute bottom-24 right-5 grid h-10 w-10 place-items-center rounded-full bg-tm-panel-2 text-tm-text shadow-lg shadow-black/40 transition hover:bg-tm-panel-3"
            aria-label="Jump to latest message"
          >
            <ArrowDown className="h-4.5 w-4.5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Composer */}
      <form
        onSubmit={send}
        className="flex items-end gap-2 border-t border-white/5 bg-tm-panel px-2 py-2.5 sm:px-4"
      >
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-tm-muted transition hover:bg-tm-panel-2 hover:text-tm-text"
          aria-label="Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-tm-muted transition hover:bg-tm-panel-2 hover:text-tm-text"
          aria-label="Attach"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(e) => handleDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e)
          }}
          placeholder={`Message as ${USERS[viewingAs].name}…`}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl bg-tm-panel-2 px-4 py-2.5 text-[14.5px] text-tm-text placeholder:text-tm-muted/70 focus:outline-none focus:ring-1 focus:ring-tm-rose/40"
        />
        <button
          type="submit"
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-full transition',
            draft.trim()
              ? 'bg-tm-rose text-tm-bg hover:bg-tm-rose-bright'
              : 'text-tm-muted hover:bg-tm-panel-2 hover:text-tm-text',
          )}
          aria-label={draft.trim() ? 'Send' : 'Record voice message'}
        >
          {draft.trim() ? <Send className="h-4.5 w-4.5" /> : <Mic className="h-5 w-5" />}
        </button>
      </form>
    </section>
  )
}
