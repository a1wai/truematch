import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Cloud,
  CloudOff,
  ImagePlus,
  MessageCircleHeart,
  Search,
  Send,
  Smile,
  Sparkles,
  X,
} from 'lucide-react'
import { fileToAttachment } from '../lib/image.js'
import { cn, dayLabel, relativeTime, startOfDay } from '../lib/utils.js'
import Avatar from './Avatar.jsx'
import EmojiPicker from './EmojiPicker.jsx'
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
      <span className="pb-1 text-[11px] text-tm-muted">
        {user.name || `@${user.username}`} is typing…
      </span>
    </motion.div>
  )
}

function EmptyState({ partner, partnerName, isAI }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <span className="relative mb-5 grid h-20 w-20 place-items-center">
        <span
          className="absolute inset-0 rounded-full bg-tm-rose/20 blur-xl"
          style={{ animation: 'heartbeat 2.6s ease-in-out infinite' }}
        />
        {isAI ? (
          <Sparkles className="relative h-8 w-8 text-tm-rose" />
        ) : (
          <MessageCircleHeart className="relative h-8 w-8 text-tm-rose" />
        )}
      </span>
      <p className="text-[15px] font-semibold text-tm-text">
        {isAI ? `Say hi to ${partnerName}` : `No messages with ${partnerName} yet`}
      </p>
      <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-tm-muted">
        {isAI
          ? 'She texts like a friend — vent, overthink out loud, or just say salam.'
          : 'Send the first message. Once there is a bit of history here, the scan has something to work with.'}
      </p>
    </div>
  )
}

export default function ChatWindow({
  messages,
  viewingAs,
  partner,
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
  connectionError = false,
  onTypingChange,
  isAI = false,
}) {
  const partnerName = partner.name || `@${partner.username}`
  const [draft, setDraft] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [attachError, setAttachError] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const typingTimer = useRef(null)

  const lastIncoming = useMemo(
    () => [...messages].reverse().find((m) => m.from !== viewingAs),
    [messages, viewingAs],
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

  /* ------------------------- search ------------------------- */

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return messages.filter((m) => m.text?.toLowerCase().includes(q)).map((m) => m.id)
  }, [messages, query])

  useEffect(() => setMatchIndex(0), [query])

  const jumpToMatch = (index) => {
    const id = matches[index]
    if (!id) return
    scrollRef.current
      ?.querySelector(`[data-message-id="${id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  useEffect(() => {
    if (matches.length) jumpToMatch(matchIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIndex, matches.length])

  const stepMatch = (delta) => {
    if (!matches.length) return
    setMatchIndex((i) => (i + delta + matches.length) % matches.length)
  }

  /* ------------------------- scrolling ------------------------- */

  useLayoutEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ block: 'end' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, typing])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!focusMessageId) return
    scrollRef.current
      ?.querySelector(`[data-message-id="${focusMessageId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusMessageId])

  useEffect(() => {
    if (!injectedDraft) return
    setDraft(injectedDraft)
    inputRef.current?.focus()
    onDraftConsumed?.()
  }, [injectedDraft, onDraftConsumed])

  /* ------------------------- composing ------------------------- */

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

  const send = async (e) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    clearTimeout(typingTimer.current)
    typingTimer.current = null
    onTypingChange?.(false)
    setDraft('')
    setEmojiOpen(false)
    setAtBottom(true)
    setSending(true)
    try {
      await onSend(text)
    } finally {
      setSending(false)
    }
  }

  const pickImage = async (event) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    setAttachError('')
    try {
      // Read the file before resetting the input: clearing it first revokes the
      // browser's handle on the picked file and the decode fails.
      const attachment = await fileToAttachment(file)
      setAtBottom(true)
      await onSend(draft.trim(), attachment)
      setDraft('')
    } catch (err) {
      setAttachError(err.message || 'Could not attach that file')
      setTimeout(() => setAttachError(''), 4000)
    } finally {
      // Reset so picking the same photo twice in a row still fires onChange.
      input.value = ''
    }
  }

  const insertEmoji = (emoji) => {
    setDraft((d) => d + emoji)
    inputRef.current?.focus()
  }

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-tm-bg">
      {/* Header */}
      <header className="z-20 flex items-center gap-2 border-b border-white/5 bg-tm-panel px-1.5 py-2 sm:gap-3 sm:px-4">
        <button
          onClick={onBack}
          className="grid h-11 w-9 shrink-0 place-items-center rounded-full text-tm-muted transition active:bg-tm-panel-2 md:hidden"
          aria-label="Back to chats"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Avatar user={partner} size="md" online={online} ring={online} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[15px] font-medium text-tm-text">
            {partnerName}
            {isAI && (
              <span className="rounded bg-tm-rose/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-tm-rose-bright">
                AI
              </span>
            )}
          </p>
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

        {!isAI && (
          <span
            className={cn(
              'hidden shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[10.5px] font-medium lg:inline-flex',
              live
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                : connectionError
                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                  : 'border-white/10 text-tm-muted',
            )}
            title={live ? 'Connected' : connectionError ? 'Reconnecting' : 'Connecting'}
          >
            {live ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            {live ? 'Live' : connectionError ? 'Offline' : '…'}
          </span>
        )}

        {!isAI && (
          <button
            onClick={onOpenScan}
            className="group relative flex shrink-0 items-center gap-1.5 rounded-xl bg-tm-rose px-2.5 py-2.5 text-xs font-semibold text-white transition active:scale-95 hover:bg-tm-rose-bright sm:gap-2 sm:px-4"
            style={{ animation: 'pulse-glow 2.4s ease-in-out infinite' }}
            title="Run Sneaky Lie Scan"
          >
            <span className="text-sm leading-none">🕵️‍♂️</span>
            <span className="hidden md:inline">Run Sneaky Lie Scan</span>
            <span className="md:hidden">Scan</span>
          </button>
        )}

        <button
          onClick={() => {
            setSearchOpen((v) => !v)
            setQuery('')
          }}
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:bg-tm-panel-2',
            searchOpen ? 'text-tm-rose-bright' : 'text-tm-muted hover:text-tm-text',
          )}
          aria-label="Search in conversation"
        >
          {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-[18px] w-[18px]" />}
        </button>
      </header>

      {/* Search bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="z-10 overflow-hidden border-b border-white/5 bg-tm-panel"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-tm-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') stepMatch(e.shiftKey ? -1 : 1)
                  if (e.key === 'Escape') setSearchOpen(false)
                }}
                placeholder="Search messages…"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-tm-text placeholder:text-tm-muted/60 focus:outline-none"
              />
              <span className="shrink-0 text-[11px] tabular-nums text-tm-muted">
                {query.trim().length < 2 ? '' : matches.length ? `${matchIndex + 1}/${matches.length}` : 'none'}
              </span>
              <button
                onClick={() => stepMatch(-1)}
                disabled={!matches.length}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-tm-muted transition active:bg-tm-panel-2 disabled:opacity-30"
                aria-label="Previous match"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => stepMatch(1)}
                disabled={!matches.length}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-tm-muted transition active:bg-tm-panel-2 disabled:opacity-30"
                aria-label="Next match"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed */}
      <div ref={scrollRef} className="chat-wallpaper flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-3">
        {messages.length === 0 ? (
          <EmptyState partner={partner} partnerName={partnerName} isAI={isAI} />
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-0.5">
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
                  pulsing={focusMessageId === row.message.id || matches[matchIndex] === row.message.id}
                  searchTerm={searchOpen ? query : ''}
                />
              ),
            )}
          </div>
        )}
        <AnimatePresence>{typing && <TypingIndicator user={partner} />}</AnimatePresence>
        <div ref={bottomRef} className="h-2 shrink-0" />
      </div>

      {/* Jump to latest */}
      <AnimatePresence>
        {!atBottom && messages.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onClick={() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              setAtBottom(true)
            }}
            className="absolute bottom-24 right-4 grid h-11 w-11 place-items-center rounded-full bg-tm-panel-2 text-tm-text shadow-lg shadow-black/40 active:scale-95"
            aria-label="Jump to latest message"
          >
            <ArrowDown className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {!isAI && connectionError && (
        <p className="shrink-0 bg-amber-500/15 px-4 py-1.5 text-center text-[11.5px] text-amber-200">
          Offline — reconnecting…
        </p>
      )}

      {attachError && (
        <p className="bg-rose-500/15 px-4 py-1.5 text-center text-[11.5px] text-rose-200">{attachError}</p>
      )}

      {/* Composer */}
      <form
        onSubmit={send}
        className="relative flex items-end gap-1 border-t border-white/5 bg-tm-panel px-1.5 py-2 sm:gap-2 sm:px-4"
      >
        <AnimatePresence>
          {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setEmojiOpen((v) => !v)}
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:bg-tm-panel-2',
            emojiOpen ? 'text-tm-rose-bright' : 'text-tm-muted hover:text-tm-text',
          )}
          aria-label="Emoji"
        >
          <Smile className="h-5 w-5" />
        </button>

        {!isAI && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={pickImage}
              className="hidden"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-tm-muted transition active:bg-tm-panel-2 hover:text-tm-text"
              aria-label="Send a photo"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
          </>
        )}

        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(e) => handleDraft(e.target.value)}
          onFocus={() => setEmojiOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e)
          }}
          placeholder={isAI ? `Message ${partnerName}…` : 'Type a message…'}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl bg-tm-panel-2 px-4 py-3 text-[15px] text-tm-text placeholder:text-tm-muted/70 focus:outline-none focus:ring-1 focus:ring-tm-rose/40"
        />

        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-90',
            draft.trim() && !sending
              ? 'bg-tm-rose text-white hover:bg-tm-rose-bright'
              : 'bg-tm-panel-2 text-tm-muted',
          )}
          aria-label="Send"
        >
          <Send className="h-[18px] w-[18px]" />
        </button>
      </form>
    </section>
  )
}
