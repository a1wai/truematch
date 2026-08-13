import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  Braces,
  CheckCheck,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  Gauge,
  Lightbulb,
  ListFilter,
  Quote,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react'
import { CATEGORIES, CATEGORY_ORDER, TIMEFRAMES } from '../lib/analysis.js'
import { cn, copyText, relativeTime, timeLabel } from '../lib/utils.js'
import RiskRing from './RiskRing.jsx'

const ACCENT = {
  amber: {
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    bar: 'bg-amber-400',
    text: 'text-amber-300',
    ring: 'hover:border-amber-400/50',
  },
  violet: {
    chip: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
    bar: 'bg-violet-400',
    text: 'text-violet-300',
    ring: 'hover:border-violet-400/50',
  },
  rose: {
    chip: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    bar: 'bg-rose-400',
    text: 'text-rose-300',
    ring: 'hover:border-rose-400/50',
  },
  sky: {
    chip: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
    bar: 'bg-sky-400',
    text: 'text-sky-300',
    ring: 'hover:border-sky-400/50',
  },
}

const SEVERITY = {
  high: { label: 'High', pill: 'bg-rose-500/15 text-rose-300 border-rose-500/30', edge: 'bg-rose-500' },
  medium: { label: 'Medium', pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30', edge: 'bg-amber-400' },
  low: { label: 'Low', pill: 'bg-sky-500/15 text-sky-300 border-sky-500/30', edge: 'bg-sky-400' },
}

const SCAN_STEPS = [
  'Reading local message store…',
  'Tokenising conversation history…',
  'Cross-referencing timeline claims…',
  'Measuring referential distance…',
  'Scoring manipulation markers…',
  'Compiling counter-strategy…',
]

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-white/5 bg-wa-panel-2/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-wa-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-wa-text">{value}</p>
      {hint && <p className="text-[11px] text-wa-muted/80">{hint}</p>}
    </div>
  )
}

function Highlighted({ text, highlights }) {
  if (!highlights?.length || !text) return <>{text}</>
  const escaped = highlights
    .filter(Boolean)
    .map((h) => String(h).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
  if (!escaped.length) return <>{text}</>
  const set = new Set(highlights.map((h) => String(h).toLowerCase()))
  return (
    <>
      {text.split(new RegExp(`(${escaped.join('|')})`, 'gi')).map((part, i) =>
        set.has(part.toLowerCase()) ? (
          <mark key={i} className="rounded bg-rose-400/25 px-0.5 font-medium text-rose-200">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

function FlagCard({ flag, messages, onJump }) {
  const cat = CATEGORIES[flag.category]
  const accent = ACCENT[cat.accent]
  const sev = SEVERITY[flag.severity]
  const msg = messages.find((m) => m.id === flag.messageId)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="relative overflow-hidden rounded-xl border border-white/5 bg-wa-panel-2/40"
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', sev.edge)} />
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-medium', accent.chip)}>
            {cat.emoji} {cat.short}
          </span>
          <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-medium', sev.pill)}>
            {sev.label} confidence
          </span>
          {flag.source === 'llm' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-wa-teal/30 bg-wa-teal/10 px-2 py-0.5 text-[11px] text-wa-teal-bright">
              <Bot className="h-3 w-3" /> model
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[11px] text-wa-muted">
            <Clock className="h-3 w-3" />
            {relativeTime(flag.ts)}
          </span>
        </div>

        <p className="mt-2.5 text-[13px] font-semibold text-wa-text">{flag.headline}</p>

        {msg && (
          <blockquote className="mt-2 rounded-lg border-l-2 border-white/10 bg-wa-bg/60 px-3 py-2 text-[13px] leading-relaxed text-wa-text/90">
            <Quote className="mb-1 h-3 w-3 text-wa-muted" />
            <Highlighted text={msg.text || `[${msg.attachment?.kind} attachment]`} highlights={flag.highlights} />
            <span className="mt-1.5 block text-[11px] text-wa-muted">
              {new Date(msg.ts).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
              {timeLabel(msg.ts)}
            </span>
          </blockquote>
        )}

        <p className="mt-2.5 text-[12.5px] leading-relaxed text-wa-muted">{flag.reason}</p>

        {flag.evidence?.length > 0 && (
          <div className="mt-3 space-y-2">
            {flag.evidence.map((ev) => {
              const em = messages.find((m) => m.id === ev.messageId)
              if (!em) return null
              return (
                <div
                  key={ev.messageId + ev.note}
                  className="rounded-lg border border-dashed border-white/10 bg-wa-bg/40 px-3 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-wa-muted">
                    {ev.note} · {new Date(em.ts).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="mt-1 text-[12.5px] italic leading-relaxed text-wa-text/80">
                    “{em.text || `[${em.attachment?.kind} attachment]`}”
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {msg && (
          <button
            onClick={() => onJump(msg.id)}
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-wa-teal-bright transition hover:gap-2"
          >
            Jump to message in chat <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </motion.article>
  )
}

function SuggestionCard({ suggestion, onUse }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl border border-white/5 bg-gradient-to-b from-wa-panel-2/70 to-wa-panel-2/30 p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-wa-teal/15 text-wa-teal-bright">
          <Lightbulb className="h-3.5 w-3.5" />
        </span>
        <p className="text-[13px] font-semibold text-wa-text">{suggestion.title}</p>
      </div>
      <p className="mt-2.5 rounded-lg bg-wa-bg/60 px-3 py-2 text-[13px] italic leading-relaxed text-wa-text/90">
        “{suggestion.line}”
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-wa-muted">{suggestion.why}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={async () => {
            if (await copyText(suggestion.line)) {
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-wa-muted transition hover:border-white/20 hover:text-wa-text"
        >
          {copied ? <CheckCheck className="h-3.5 w-3.5 text-wa-teal-bright" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          onClick={() => onUse(suggestion.line)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-wa-teal/15 px-2.5 py-1.5 text-[11px] font-medium text-wa-teal-bright transition hover:bg-wa-teal/25"
        >
          <Send className="h-3.5 w-3.5" />
          Load into composer
        </button>
      </div>
    </div>
  )
}

/** The single strongest finding, promoted so the report has an obvious lead. */
function HeadlineSignal({ report, messages, onJump }) {
  const rank = { high: 2, medium: 1, low: 0 }
  const top = [...report.flags].sort(
    (a, b) => rank[b.severity] - rank[a.severity] || b.ts - a.ts,
  )[0]

  if (!top) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <CheckCheck className="h-5 w-5 shrink-0 text-emerald-400" />
        <p className="text-[12.5px] leading-relaxed text-emerald-100/80">
          Nothing in this window trips a single detector — statements are specific, consistent and
          answered directly.
        </p>
      </div>
    )
  }

  const cat = CATEGORIES[top.category]
  const msg = messages.find((m) => m.id === top.messageId)

  return (
    <div className="rounded-2xl border border-white/5 bg-wa-panel-2/40 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-wa-muted">
        <TriangleAlert className="h-3.5 w-3.5 text-rose-400" /> Strongest signal
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-medium', ACCENT[cat.accent].chip)}>
          {cat.emoji} {cat.short}
        </span>
        <span className="text-[12px] text-wa-muted">{top.headline}</span>
      </div>
      {msg && (
        <button
          onClick={() => onJump(msg.id)}
          className="mt-2 block w-full text-left text-[13px] italic leading-relaxed text-wa-text/90 transition hover:text-wa-text"
        >
          “{(msg.text || '').slice(0, 190)}
          {(msg.text || '').length > 190 ? '…' : ''}”
        </button>
      )}
    </div>
  )
}

function Scanning({ step, target }) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto mb-8 grid h-28 w-28 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-wa-teal/10" />
          <span className="absolute inset-3 rounded-full border border-wa-teal/30" />
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-wa-teal"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          />
          <ShieldAlert className="h-9 w-9 text-wa-teal" />
        </div>
        <p className="text-sm font-semibold text-wa-text">Analysing {target}&rsquo;s language</p>
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-wa-panel-2">
          <motion.div
            className="h-full bg-wa-teal"
            initial={{ width: '4%' }}
            animate={{ width: `${((step + 1) / SCAN_STEPS.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 text-xs text-wa-muted"
          >
            {SCAN_STEPS[step]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function ScanModal({
  open,
  scanning,
  report,
  messages,
  targetName,
  timeframe,
  onTimeframe,
  onClose,
  onRescan,
  onJump,
  onUseLine,
  revealFlags,
  onToggleReveal,
  liveError,
  savedCount,
}) {
  const [step, setStep] = useState(0)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!scanning) return
    setStep(0)
    const id = setInterval(() => setStep((s) => Math.min(SCAN_STEPS.length - 1, s + 1)), 340)
    return () => clearInterval(id)
  }, [scanning])

  useEffect(() => {
    if (open) setFilter('all')
  }, [open, report?.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const visibleFlags = useMemo(() => {
    if (!report) return []
    return filter === 'all' ? report.flags : report.flags.filter((f) => f.category === filter)
  }, [report, filter])

  const exportReport = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `truematch-report-${new Date(report.generatedAt).toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 backdrop-blur-sm sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-dvh w-full flex-col overflow-hidden border-white/10 bg-wa-panel shadow-2xl sm:h-[92vh] sm:max-w-6xl sm:rounded-2xl sm:border"
          >
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-white/5 bg-wa-panel px-4 py-3 sm:px-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-wa-teal/15 text-xl">
                🕵️‍♂️
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-semibold text-wa-text sm:text-base">
                  Deception Intelligence Report
                </h2>
                <p className="truncate text-xs text-wa-muted">
                  Subject: <span className="text-wa-text/80">{targetName}</span>
                  {report && ` · generated ${relativeTime(report.generatedAt)} · ${report.timeframeLabel}`}
                </p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-wa-muted md:inline-flex">
                {report?.engine === 'live model' ? (
                  <Bot className="h-3.5 w-3.5 text-wa-teal-bright" />
                ) : (
                  <Cpu className="h-3.5 w-3.5" />
                )}
                {report?.engine || 'on-device heuristics'}
              </span>
              <button
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-wa-muted transition hover:bg-wa-panel-2 hover:text-wa-text"
                aria-label="Close report"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {scanning || !report ? (
              <Scanning step={step} target={targetName} />
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-5 p-4 sm:p-6">
                  {liveError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-200">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        <span className="font-medium">Live model unavailable — </span>
                        {liveError} Showing the on-device analysis instead.
                      </p>
                    </div>
                  )}

                  {/* Risk + stats */}
                  <section className="grid gap-4 lg:grid-cols-3">
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-wa-panel-2/40 p-5">
                      <RiskRing value={report.risk} band={report.band.key} label="dishonesty risk" />
                      <p className="mt-4 text-center text-sm font-semibold text-wa-text">
                        {report.band.label}
                      </p>
                      <p className="mt-1.5 text-center text-[12px] leading-relaxed text-wa-muted">
                        {report.band.blurb}
                      </p>
                    </div>

                    <div className="space-y-4 lg:col-span-2">
                      {/* Timeframe */}
                      <div className="rounded-2xl border border-white/5 bg-wa-panel-2/40 p-4">
                        <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-wa-muted">
                          <ListFilter className="h-3.5 w-3.5" /> Scan timeframe
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {TIMEFRAMES.map((tf) => (
                            <button
                              key={tf.id}
                              onClick={() => onTimeframe(tf.id)}
                              className={cn(
                                'rounded-xl border px-3.5 py-2 text-[12.5px] font-medium transition',
                                timeframe === tf.id
                                  ? 'border-wa-teal/50 bg-wa-teal/15 text-wa-teal-bright'
                                  : 'border-white/8 bg-wa-bg/40 text-wa-muted hover:border-white/20 hover:text-wa-text',
                              )}
                            >
                              {tf.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatTile
                          icon={Braces}
                          label="Messages"
                          value={report.stats.analyzed}
                          hint={`${report.stats.fromTarget} from subject`}
                        />
                        <StatTile
                          icon={TriangleAlert}
                          label="Flagged"
                          value={report.stats.flagged}
                          hint={
                            report.stats.wordSpike > 0
                              ? `${report.flags.length} signals · +${report.stats.wordSpike}% wordier`
                              : `${report.flags.length} signals total`
                          }
                        />
                        <StatTile
                          icon={Gauge}
                          label="Contradictions"
                          value={report.stats.contradictions}
                          hint={`over ${report.stats.spanDays}d window`}
                        />
                        <StatTile
                          icon={Clock}
                          label="Reply lag"
                          value={report.stats.avgLatencyLabel}
                          hint="avg. after direct questions"
                        />
                      </div>

                      {report.summary && (
                        <div className="rounded-2xl border border-wa-teal/20 bg-wa-teal/5 p-4">
                          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-wa-teal-bright">
                            <Sparkles className="h-3.5 w-3.5" /> Model summary
                          </p>
                          <p className="text-[13px] leading-relaxed text-wa-text/90">{report.summary}</p>
                        </div>
                      )}

                      <HeadlineSignal report={report} messages={messages} onJump={onJump} />
                    </div>
                  </section>

                  {/* Linguistic anomaly breakdown */}
                  <section>
                    <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-wa-muted">
                      Linguistic anomaly breakdown
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {CATEGORY_ORDER.map((id) => {
                        const cat = report.categories.find((c) => c.id === id)
                        const accent = ACCENT[CATEGORIES[id].accent]
                        const active = filter === id
                        return (
                          <button
                            key={id}
                            onClick={() => setFilter(active ? 'all' : id)}
                            className={cn(
                              'flex flex-col rounded-2xl border bg-wa-panel-2/40 p-4 text-left transition',
                              active ? 'border-wa-teal/50 bg-wa-panel-2/70' : 'border-white/5',
                              accent.ring,
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[12.5px] font-semibold leading-snug text-wa-text">
                                {CATEGORIES[id].emoji} {CATEGORIES[id].label}
                              </span>
                              <span className={cn('shrink-0 text-lg font-bold tabular-nums', accent.text)}>
                                {cat.count}
                              </span>
                            </div>
                            <p className="mt-2 text-[11.5px] leading-relaxed text-wa-muted">
                              {CATEGORIES[id].blurb}
                            </p>
                            <div className="mt-auto pt-3">
                              <div className="h-1.5 overflow-hidden rounded-full bg-wa-bg/70">
                                <motion.div
                                  className={cn('h-full rounded-full', accent.bar)}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${cat.score}%` }}
                                  transition={{ duration: 0.9, ease: 'easeOut' }}
                                />
                              </div>
                              <p className="mt-1.5 text-[10.5px] uppercase tracking-wider text-wa-muted/70">
                                signal strength {cat.score}%
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>

                  {/* Feed + strategy */}
                  <section className="grid gap-5 xl:grid-cols-5">
                    <div className="xl:col-span-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-wa-muted">
                          Flagged messages
                        </h3>
                        {filter !== 'all' && (
                          <button
                            onClick={() => setFilter('all')}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-wa-muted transition hover:text-wa-text"
                          >
                            Clear filter · {CATEGORIES[filter].short}
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                          {visibleFlags.map((flag) => (
                            <FlagCard key={flag.id} flag={flag} messages={messages} onJump={onJump} />
                          ))}
                        </AnimatePresence>
                        {visibleFlags.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
                            <CheckCheck className="mx-auto mb-3 h-8 w-8 text-emerald-400/70" />
                            <p className="text-sm font-medium text-wa-text">Nothing flagged here</p>
                            <p className="mt-1 text-[12.5px] text-wa-muted">
                              No signals in this category for {report.timeframeLabel.toLowerCase()}. Try
                              widening the timeframe.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="xl:col-span-2">
                      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-wa-muted">
                        <Sparkles className="h-3.5 w-3.5 text-wa-teal-bright" />
                        Tactical counter-strategy
                      </h3>
                      <div className="rounded-2xl border border-wa-teal/20 bg-wa-teal/5 p-3">
                        <p className="px-1 pb-3 text-[12px] leading-relaxed text-wa-muted">
                          AI copilot suggestions — questions designed to surface the inconsistency
                          organically, without revealing that a scan was run.
                        </p>
                        <div className="space-y-3">
                          {report.suggestions.map((s) => (
                            <SuggestionCard key={s.id} suggestion={s} onUse={onUseLine} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  <p className="pb-2 text-center text-[11px] leading-relaxed text-wa-muted/60">
                    Heuristic signals, not proof. Linguistic patterns correlate weakly with deception and
                    are affected by stress, culture, neurodivergence and typing habits. Treat this as a
                    prompt for a conversation, never as a verdict about a person.
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <footer className="flex flex-wrap items-center gap-2 border-t border-white/5 bg-wa-panel px-4 py-3 sm:px-6">
              <button
                onClick={onToggleReveal}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition',
                  revealFlags
                    ? 'border-rose-400/40 bg-rose-500/10 text-rose-300'
                    : 'border-white/10 text-wa-muted hover:text-wa-text',
                )}
              >
                {revealFlags ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {revealFlags ? 'Flags visible in chat' : 'Hidden in chat'}
              </button>
              <span className="hidden text-[11px] text-wa-muted/70 sm:inline">
                {savedCount} report{savedCount === 1 ? '' : 's'} stored on this device
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={exportReport}
                  disabled={!report}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[12px] font-medium text-wa-muted transition hover:text-wa-text disabled:opacity-40"
                >
                  <Braces className="h-3.5 w-3.5" /> Export JSON
                </button>
                <button
                  onClick={onRescan}
                  disabled={scanning}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-wa-teal px-3.5 py-2 text-[12px] font-semibold text-wa-bg transition hover:bg-wa-teal-bright disabled:opacity-50"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', scanning && 'animate-spin')} /> Re-run scan
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
