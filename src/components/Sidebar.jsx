import { useMemo, useState } from 'react'
import { Search, Sparkles, X } from 'lucide-react'
import { cn, timeLabel } from '../lib/utils.js'
import Avatar from './Avatar.jsx'

function Row({ user, isAI, active, last, unread, viewingAs, onSelect }) {
  const preview = last?.text || (last?.attachment ? `📷 Photo` : 'Tap to start chatting')
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition active:bg-tm-panel-2',
        active ? 'bg-tm-panel-2/70' : 'hover:bg-tm-panel-2/40',
      )}
    >
      <Avatar user={user} size="lg" online={isAI} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-medium text-tm-text">{user.name}</span>
            {isAI && (
              <span className="shrink-0 rounded bg-tm-rose/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-tm-rose-bright">
                AI
              </span>
            )}
          </span>
          <span className={cn('shrink-0 text-[11px]', unread ? 'text-tm-rose-bright' : 'text-tm-muted')}>
            {last ? timeLabel(last.ts) : ''}
          </span>
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-tm-muted">
            {last?.from === viewingAs ? 'You: ' : ''}
            {preview}
          </span>
          {unread > 0 && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-tm-rose px-1.5 text-[11px] font-semibold text-white">
              {unread}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

export default function Sidebar({
  messages,
  aiMessages,
  viewingAs,
  partner,
  companion,
  activeChat,
  onSelectChat,
  className,
}) {
  const [query, setQuery] = useState('')

  const chats = useMemo(() => {
    const list = [
      {
        id: 'partner',
        user: partner,
        isAI: false,
        last: messages[messages.length - 1],
        unread: messages.filter((m) => m.from !== viewingAs && m.status !== 'read').length,
      },
      {
        id: 'ai',
        user: companion,
        isAI: true,
        last: aiMessages[aiMessages.length - 1],
        unread: 0,
      },
    ]
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (c) => c.user.name.toLowerCase().includes(q) || (c.last?.text || '').toLowerCase().includes(q),
    )
  }, [messages, aiMessages, partner, companion, viewingAs, query])

  return (
    <aside
      className={cn(
        'w-full min-w-0 shrink-0 flex-col border-r border-white/5 bg-tm-panel md:w-[320px] lg:w-[380px]',
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-semibold text-tm-text">Chats</h2>
        <span className="flex items-center gap-1.5 rounded-lg bg-tm-rose/10 px-2 py-1 text-[10.5px] font-medium text-tm-rose-bright">
          <Sparkles className="h-3 w-3" />
          {chats.length} active
        </span>
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2.5 rounded-xl bg-tm-panel-2 px-3.5 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-tm-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-tm-text placeholder:text-tm-muted/70 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="shrink-0 text-tm-muted transition hover:text-tm-text"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.map((chat) => (
          <Row
            key={chat.id}
            user={chat.user}
            isAI={chat.isAI}
            active={activeChat === chat.id}
            last={chat.last}
            unread={chat.unread}
            viewingAs={viewingAs}
            onSelect={() => onSelectChat(chat.id)}
          />
        ))}
        {chats.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-tm-muted">No chats match “{query}”</p>
        )}
      </div>

      <div className="border-t border-white/5 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-tm-muted/70">
          {messages.length} messages with {partner.name}
        </p>
      </div>
    </aside>
  )
}
