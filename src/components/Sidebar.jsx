import { Loader2, Settings, Sparkles, UserPlus } from 'lucide-react'
import { cn, timeLabel } from '../lib/utils.js'
import Avatar from './Avatar.jsx'

function Row({ user, active, last, unread, meId, onSelect }) {
  const preview = last?.text || (last?.attachment ? '📷 Photo' : 'Tap to start chatting')
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition active:bg-tm-panel-2',
        active ? 'bg-tm-panel-2/70' : 'hover:bg-tm-panel-2/40',
      )}
    >
      <Avatar user={user} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-medium text-tm-text">
              {user.name || `@${user.username}`}
            </span>
          </span>
          <span className={cn('shrink-0 text-[11px]', unread ? 'text-tm-rose-bright' : 'text-tm-muted')}>
            {last ? timeLabel(last.ts) : ''}
          </span>
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-tm-muted">
            {last?.from === meId ? 'You: ' : ''}
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
  profile,
  conversations,
  loading,
  activeChat,
  onSelectChat,
  onAddUser,
  onOpenMenu,
  className,
}) {
  return (
    <aside
      className={cn(
        'h-full w-full min-w-0 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-tm-panel md:w-[320px] lg:w-[380px]',
        className,
      )}
    >
      {/* Header: identity, add someone, and the settings gear */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-3">
        <Avatar user={profile} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-tm-text">@{profile.username}</p>
          <p className="text-[11px] text-tm-muted">Chats</p>
        </div>
        <button
          onClick={onAddUser}
          className="grid h-11 w-11 place-items-center rounded-full bg-tm-rose/15 text-tm-rose-bright transition active:scale-90"
          aria-label="Add someone"
          title="Add someone"
        >
          <UserPlus className="h-5 w-5" />
        </button>
        <button
          onClick={onOpenMenu}
          className="grid h-11 w-11 place-items-center rounded-full text-tm-muted transition active:bg-tm-panel-2 hover:text-tm-text"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.map((c) => (
          <Row
            key={c.id}
            user={c.other}
            active={activeChat === c.id}
            last={c.last}
            unread={c.unread}
            meId={profile.id}
            onSelect={() => onSelectChat(c.id)}
          />
        ))}


        {loading && (
          <p className="flex items-center justify-center gap-2 px-4 py-6 text-[12.5px] text-tm-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your chats…
          </p>
        )}

        {!loading && conversations.length === 0 && (
          <div className="px-6 py-10 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-tm-rose/60" />
            <p className="text-[13.5px] font-medium text-tm-text">No chats yet</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-tm-muted">
              Tap the <span className="text-tm-rose-bright">add</span> button and search for
              someone&rsquo;s username to start talking.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
