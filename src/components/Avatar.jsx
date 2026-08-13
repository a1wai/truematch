import { useState } from 'react'
import { cn } from '../lib/utils.js'

const SIZES = {
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
}

// Deterministic so the same person is always the same colour on every device.
const TINTS = [
  'from-rose-400 to-pink-600',
  'from-fuchsia-400 to-purple-600',
  'from-sky-400 to-indigo-600',
  'from-amber-400 to-orange-600',
  'from-emerald-400 to-teal-600',
  'from-violet-400 to-indigo-600',
]

function tintFor(seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return TINTS[hash % TINTS.length]
}

/**
 * Works with a Supabase profile ({ username, avatar }) or a locally defined
 * character ({ name, initials, tint }). A missing or broken picture falls back
 * to a monogram rather than a broken-image icon.
 */
export default function Avatar({ user, size = 'md', online = false, ring = false, className }) {
  const [failed, setFailed] = useState(false)
  if (!user) return null

  const label = user.name || user.username || '?'
  const initials = user.initials || label.slice(0, 2).toUpperCase()
  const src = user.avatar || null
  const showPhoto = src && !failed

  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'grid place-items-center overflow-hidden rounded-full bg-gradient-to-br font-semibold tracking-wide text-white/95',
          SIZES[size],
          user.tint || tintFor(label),
          ring ? 'ring-2 ring-tm-rose/60' : 'ring-1 ring-white/10',
        )}
      >
        {showPhoto ? (
          <img
            src={src}
            alt={label}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-tm-panel bg-emerald-400" />
      )}
    </div>
  )
}
