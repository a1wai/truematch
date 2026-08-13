import { Archive, MessageSquarePlus, Search, Users } from 'lucide-react'
import { USERS } from '../data/seed.js'
import { cn, dayLabel, timeLabel } from '../lib/utils.js'
import Avatar from './Avatar.jsx'

/** WhatsApp-Web style chat list. There is exactly one thread — that is the app. */
export default function Sidebar({ messages, viewingAs, partnerId, className }) {
  const partner = USERS[partnerId]
  const last = messages[messages.length - 1]
  const preview = last?.text || (last?.attachment ? `📎 ${last.attachment.name}` : '')
  const unread = messages.filter((m) => m.from === partnerId && m.status !== 'read').length

  return (
    <aside
      className={cn(
        'w-full min-w-0 shrink-0 flex-col border-r border-white/5 bg-wa-panel md:w-[340px] lg:w-[380px]',
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-semibold text-wa-text">Chats</h2>
        <div className="flex items-center gap-1 text-wa-muted">
          <button className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-wa-panel-2 hover:text-wa-text">
            <Users className="h-[18px] w-[18px]" />
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-wa-panel-2 hover:text-wa-text">
            <MessageSquarePlus className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-3 rounded-lg bg-wa-panel-2 px-3.5 py-2">
          <Search className="h-4 w-4 text-wa-muted" />
          <input
            placeholder="Search or start a new chat"
            className="w-full bg-transparent text-[13px] text-wa-text placeholder:text-wa-muted/70 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <button className="flex w-full items-center gap-3 border-b border-white/5 bg-wa-panel-2/40 px-4 py-3 text-left">
          <Avatar user={partner} size="lg" online />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[15px] font-medium text-wa-text">{partner.name}</span>
              <span className={cn('shrink-0 text-[11px]', unread ? 'text-wa-teal-bright' : 'text-wa-muted')}>
                {last ? timeLabel(last.ts) : ''}
              </span>
            </span>
            <span className="mt-0.5 flex items-center justify-between gap-2">
              <span className="truncate text-[13px] text-wa-muted">
                {last?.from === viewingAs ? 'You: ' : ''}
                {preview}
              </span>
              {unread > 0 && (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-wa-teal px-1.5 text-[11px] font-semibold text-wa-bg">
                  {unread}
                </span>
              )}
            </span>
          </span>
        </button>

        <div className="px-4 py-6 text-center">
          <Archive className="mx-auto mb-2 h-5 w-5 text-wa-muted/50" />
          <p className="text-xs text-wa-muted/70">
            No other conversations. True Match pairs exactly two people —
            <br className="hidden lg:block" /> that is the whole product.
          </p>
        </div>
      </div>

      <div className="border-t border-white/5 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-wa-muted/70">
          Last message {last ? `${dayLabel(last.ts).toLowerCase()} at ${timeLabel(last.ts)}` : '—'} ·{' '}
          {messages.length} messages stored locally
        </p>
      </div>
    </aside>
  )
}
