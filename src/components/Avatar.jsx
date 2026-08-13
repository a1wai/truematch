import { cn } from '../lib/utils.js'

const SIZES = {
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
}

export default function Avatar({ user, size = 'md', online = false, className }) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'grid place-items-center rounded-full bg-gradient-to-br font-semibold tracking-wide text-white/95 ring-1 ring-white/10',
          SIZES[size],
          user.tint,
        )}
      >
        {user.initials}
      </div>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-wa-panel bg-wa-teal-bright" />
      )}
    </div>
  )
}
