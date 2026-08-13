import { useState } from 'react'
import { cn } from '../lib/utils.js'

const SIZES = {
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
}

/**
 * Photos live in `public/avatars/`. BASE_URL keeps the path correct whether the
 * app is served from a domain root (Vercel), a repo subpath (GitHub Pages) or
 * the Capacitor file:// shell on Android. A missing file falls back to the
 * monogram rather than a broken image.
 */
export default function Avatar({ user, size = 'md', online = false, ring = false, className }) {
  const [failed, setFailed] = useState(false)
  const src = user.photo ? `${import.meta.env.BASE_URL}avatars/${user.photo}` : null
  const showPhoto = src && !failed

  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'grid place-items-center overflow-hidden rounded-full bg-gradient-to-br font-semibold tracking-wide text-white/95',
          SIZES[size],
          user.tint,
          ring ? 'ring-2 ring-tm-rose/60' : 'ring-1 ring-white/10',
        )}
      >
        {showPhoto ? (
          <img
            src={src}
            alt={user.name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          user.initials
        )}
      </div>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-tm-panel bg-emerald-400" />
      )}
    </div>
  )
}
