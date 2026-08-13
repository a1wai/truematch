import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const BAND_COLORS = {
  high: { stroke: '#ff2e63', glow: 'rgb(255 46 99 / 0.4)', text: 'text-tm-rose' },
  elevated: { stroke: '#f59e0b', glow: 'rgb(245 158 11 / 0.32)', text: 'text-amber-400' },
  moderate: { stroke: '#eab308', glow: 'rgb(234 179 8 / 0.28)', text: 'text-yellow-400' },
  low: { stroke: '#22c55e', glow: 'rgb(34 197 94 / 0.28)', text: 'text-emerald-400' },
}

/** Counts from 0 to `value` so the number lands with the ring. */
function useCountUp(value, duration = 1200) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let frame
    const start = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration)
      // ease-out-cubic
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])
  return n
}

export default function RiskRing({ value = 0, band = 'low', size = 208, label }) {
  const colors = BAND_COLORS[band] || BAND_COLORS.low
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const shown = useCountUp(value)

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <div
        className="absolute inset-4 rounded-full blur-2xl"
        style={{ background: colors.glow }}
        aria-hidden="true"
      />
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2f1b2b"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * value) / 100 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${colors.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className={`text-5xl font-bold tabular-nums ${colors.text}`}>{shown}%</span>
        <span className="mt-1 max-w-[10rem] text-[11px] font-medium uppercase tracking-widest text-tm-muted">
          {label}
        </span>
      </div>
    </div>
  )
}

export { BAND_COLORS }
