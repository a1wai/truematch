import { motion } from 'framer-motion'

const GROUPS = [
  {
    label: 'Feelings',
    emoji: ['❤️', '💜', '💔', '🥺', '😭', '😊', '😅', '🙄', '😐', '😑', '😤', '😡', '🥰', '😍', '😔', '😳'],
  },
  {
    label: 'Reactions',
    emoji: ['😂', '🤣', '😏', '🤔', '👀', '🙃', '😬', '🫠', '💀', '🔥', '✨', '👍', '👎', '🙏', '🤝', '👏'],
  },
  {
    label: 'Everyday',
    emoji: ['☕', '🍕', '🎉', '🌙', '☀️', '🚗', '🏠', '💼', '📱', '⏰', '📍', '🎁', '🌹', '💐', '🍰', '💍'],
  },
]

/** Small, fast, no dependency — a full emoji library is not worth 400 kB here. */
export default function EmojiPicker({ onPick, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.16 }}
      className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-tm-panel-2 p-3 shadow-2xl shadow-black/50 sm:left-2 sm:right-auto sm:w-80"
    >
      {GROUPS.map((group) => (
        <div key={group.label} className="mb-3 last:mb-0">
          <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-tm-muted">
            {group.label}
          </p>
          <div className="grid grid-cols-8 gap-1">
            {group.emoji.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onPick(e)
                  onClose()
                }}
                className="grid h-9 w-9 place-items-center rounded-lg text-xl transition active:scale-90 hover:bg-white/10"
                aria-label={`Insert ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  )
}
