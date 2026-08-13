import { forwardRef } from 'react'
import { Check, CheckCheck, Clock3, FileText, ImageIcon, Play } from 'lucide-react'
import { cn, timeLabel } from '../lib/utils.js'

const WAVE = [6, 11, 17, 9, 14, 20, 13, 8, 16, 22, 12, 7, 15, 10, 18, 9, 13, 6]

function Ticks({ status }) {
  if (status === 'pending') return <Clock3 className="h-3.5 w-3.5 text-white/50" />
  if (status === 'sent') return <Check className="h-3.5 w-3.5 text-white/55" />
  if (status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-wa-blue" />
  return <CheckCheck className="h-3.5 w-3.5 text-white/55" />
}

function Attachment({ attachment, outgoing }) {
  if (attachment.kind === 'image') {
    return (
      <div className="mb-1.5 overflow-hidden rounded-lg">
        <div
          className={cn(
            'relative flex h-44 w-60 max-w-full items-end bg-gradient-to-br p-2.5',
            attachment.tint || 'from-slate-500/40 to-slate-800/40',
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.18),transparent_60%)]" />
          <div className="absolute inset-0 grid place-items-center">
            <ImageIcon className="h-8 w-8 text-white/30" />
          </div>
          <span className="relative rounded-md bg-black/45 px-2 py-1 text-[11px] text-white/85 backdrop-blur">
            {attachment.name}
          </span>
        </div>
      </div>
    )
  }

  if (attachment.kind === 'voice') {
    return (
      <div className="mb-1 flex w-60 max-w-full items-center gap-3 py-1">
        <button
          type="button"
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-full transition',
            outgoing ? 'bg-white/15 hover:bg-white/25' : 'bg-wa-teal/20 hover:bg-wa-teal/30',
          )}
          aria-label="Play voice message"
        >
          <Play className="h-4 w-4 translate-x-px fill-current text-wa-teal-bright" />
        </button>
        <div className="flex flex-1 items-center gap-[3px]">
          {WAVE.map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}px` }}
              className={cn('w-[3px] rounded-full', i < 6 ? 'bg-wa-teal-bright/80' : 'bg-white/25')}
            />
          ))}
        </div>
        <span className="shrink-0 text-[11px] text-white/60">{attachment.length}</span>
      </div>
    )
  }

  return (
    <div className="mb-1.5 flex w-60 max-w-full items-center gap-3 rounded-lg bg-black/20 p-2.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-500/20 text-rose-300">
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-white/90">{attachment.name}</span>
        <span className="block text-[11px] uppercase tracking-wide text-white/50">
          PDF · {attachment.size}
        </span>
      </span>
    </div>
  )
}

/** Wraps every flagged fragment in a highlight so the report and chat agree. */
function HighlightedText({ text, highlights }) {
  if (!highlights?.length) return text
  const escaped = highlights
    .filter(Boolean)
    .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
  if (!escaped.length) return text

  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
  const set = new Set(highlights.map((h) => h.toLowerCase()))
  return parts.map((part, i) =>
    set.has(part.toLowerCase()) ? (
      <mark key={i} className="rounded bg-amber-400/25 px-0.5 text-amber-100 decoration-amber-300/60 underline-offset-2">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

const MessageBubble = forwardRef(function MessageBubble(
  { message, outgoing, showTail, flagged, highlights, revealFlags, pulsing },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('flex px-3 sm:px-6', outgoing ? 'justify-end' : 'justify-start')}
      data-message-id={message.id}
    >
      <div
        className={cn(
          'relative max-w-[85%] rounded-lg px-2.5 py-1.5 text-[14.5px] leading-relaxed shadow-sm sm:max-w-[65%]',
          outgoing ? 'bg-wa-teal-deep text-wa-text' : 'bg-wa-panel-2 text-wa-text',
          showTail && (outgoing ? 'bubble-out rounded-tr-none' : 'bubble-in rounded-tl-none'),
          revealFlags && flagged && 'ring-1 ring-rose-400/60',
          pulsing && 'ring-2 ring-amber-300/80',
          'transition-shadow duration-500',
        )}
      >
        {revealFlags && flagged && (
          <span className="absolute -top-1.5 -left-1.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400/70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
          </span>
        )}

        {message.attachment && <Attachment attachment={message.attachment} outgoing={outgoing} />}

        {message.text ? (
          <p className="whitespace-pre-wrap break-words">
            {revealFlags && flagged ? (
              <HighlightedText text={message.text} highlights={highlights} />
            ) : (
              message.text
            )}
            {/* reserves room so the timestamp never lands on the last word */}
            <span className="inline-block w-[64px]" aria-hidden="true" />
          </p>
        ) : (
          <span className="block h-4" />
        )}

        <span className="absolute bottom-1 right-2 flex items-center gap-1 text-[10.5px] text-white/50">
          {timeLabel(message.ts)}
          {outgoing && <Ticks status={message.status} />}
        </span>
      </div>
    </div>
  )
})

export default MessageBubble
