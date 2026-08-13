import { ArrowLeftRight, LogOut, Settings2, ShieldQuestion } from 'lucide-react'
import { motion } from 'framer-motion'
import { USERS, OTHER } from '../data/seed.js'
import Avatar from './Avatar.jsx'

/**
 * Persistent perspective switcher. Both sides of the conversation live on this
 * one device, so this bar is the only thing telling you whose eyes you are using.
 */
export default function PerspectiveBar({ viewingAs, onSwitch, onLogout, onSettings }) {
  const me = USERS[viewingAs]
  const them = USERS[OTHER[viewingAs]]

  return (
    <div className="z-30 flex items-center gap-3 border-b border-white/5 bg-wa-panel px-3 py-2 sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-wa-teal/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-wa-teal-bright sm:inline-flex">
          <ShieldQuestion className="h-3.5 w-3.5" />
          True Match
        </span>
        <motion.div
          key={viewingAs}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="flex min-w-0 items-center gap-2.5"
        >
          <Avatar user={me} size="sm" online />
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-widest text-wa-muted">
              Currently viewing as
            </span>
            <span className="block truncate text-sm font-semibold text-wa-text">
              {me.name}
              <span className="ml-1.5 text-xs font-normal text-wa-muted">({me.label})</span>
            </span>
          </span>
        </motion.div>
      </div>

      <button
        onClick={onSwitch}
        className="group flex shrink-0 items-center gap-2 rounded-xl border border-wa-teal/30 bg-wa-teal/10 px-3 py-2 text-xs font-semibold text-wa-teal-bright transition hover:border-wa-teal/60 hover:bg-wa-teal/20"
        title={`Switch to ${them.name}`}
      >
        <ArrowLeftRight className="h-4 w-4 transition group-hover:rotate-180" />
        <span className="hidden sm:inline">Switch to {them.label}</span>
        <span className="sm:hidden">Switch</span>
      </button>

      <button
        onClick={onSettings}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-wa-muted transition hover:bg-wa-panel-2 hover:text-wa-text"
        title="AI settings"
      >
        <Settings2 className="h-4.5 w-4.5" />
      </button>
      <button
        onClick={onLogout}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-wa-muted transition hover:bg-wa-panel-2 hover:text-wa-text"
        title="Log out"
      >
        <LogOut className="h-4.5 w-4.5" />
      </button>
    </div>
  )
}
