import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  RotateCcw,
  Server,
  Trash2,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react'
import { DEFAULT_MODEL_BY_PROVIDER, PROVIDERS, testConnection } from '../lib/ai.js'
import { cn } from '../lib/utils.js'

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl border border-white/5 bg-wa-panel-2/40 p-3.5 text-left transition hover:border-white/10"
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition',
          checked ? 'bg-wa-teal' : 'bg-wa-panel-3',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={cn('h-4 w-4 rounded-full bg-white shadow', checked && 'ml-auto')}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-wa-text">{label}</span>
        <span className="block text-[11.5px] leading-relaxed text-wa-muted">{hint}</span>
      </span>
    </button>
  )
}

export default function SettingsModal({ open, settings, onChange, onClose, onResetDemo, onWipe }) {
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState({ status: 'idle' })
  const provider = PROVIDERS[settings.provider] || PROVIDERS.groq

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => setTestState({ status: 'idle' }), [settings.provider, settings.model, settings.apiKey])

  const setProvider = (id) => {
    onChange({ ...settings, provider: id, model: DEFAULT_MODEL_BY_PROVIDER[id] })
  }

  const runTest = async () => {
    setTestState({ status: 'running' })
    try {
      const res = await testConnection(settings)
      setTestState({ status: 'ok', message: `Model replied in ${res.ms}ms` })
    } catch (err) {
      setTestState({ status: 'error', message: err.message || 'Request failed' })
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-wa-panel shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-wa-teal/15 text-wa-teal-bright">
                <Bot className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-wa-text">AI engine settings</h2>
                <p className="text-xs text-wa-muted">Open-source models, your key, your device</p>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-xl text-wa-muted transition hover:bg-wa-panel-2 hover:text-wa-text"
                aria-label="Close settings"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Provider */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-wa-muted">
                  Provider
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(PROVIDERS).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-[12.5px] font-medium transition',
                        settings.provider === p.id
                          ? 'border-wa-teal/50 bg-wa-teal/15 text-wa-teal-bright'
                          : 'border-white/8 bg-wa-panel-2/40 text-wa-muted hover:text-wa-text',
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-wa-muted">{provider.hint}</p>
              </div>

              {/* Custom endpoint */}
              {settings.provider === 'custom' && (
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-wa-muted">
                    Endpoint URL
                  </label>
                  <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-wa-bg/60 px-3.5 py-3">
                    <Server className="h-4 w-4 shrink-0 text-wa-muted" />
                    <input
                      value={settings.endpoint}
                      onChange={(e) => onChange({ ...settings, endpoint: e.target.value })}
                      placeholder="http://localhost:11434/v1/chat/completions"
                      className="w-full bg-transparent text-[13px] text-wa-text placeholder:text-wa-muted/60 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* API key */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-wa-muted">
                    API key
                  </label>
                  {provider.keysUrl && (
                    <a
                      href={provider.keysUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-wa-teal-bright hover:underline"
                    >
                      Get a free key <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-wa-bg/60 px-3.5 py-3">
                  <Key className="h-4 w-4 shrink-0 text-wa-muted" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={settings.apiKey}
                    onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
                    placeholder={settings.provider === 'groq' ? 'gsk_…' : 'sk-…'}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-transparent font-mono text-[13px] text-wa-text placeholder:text-wa-muted/60 focus:outline-none"
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="text-wa-muted transition hover:text-wa-text"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-wa-muted">
                  Model
                </label>
                <div className="relative">
                  <select
                    value={settings.model}
                    onChange={(e) => onChange({ ...settings, model: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-white/8 bg-wa-bg/60 px-3.5 py-3 pr-10 text-[13px] text-wa-text focus:border-wa-teal/50 focus:outline-none"
                  >
                    {provider.models.map((m) => (
                      <option key={m.id} value={m.id} className="bg-wa-panel">
                        {m.label}
                        {m.tag ? ` — ${m.tag}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-wa-muted" />
                </div>
                <p className="mt-2 text-[11.5px] text-wa-muted">
                  Open-weight models only. Reasoning models return better contradiction analysis but are
                  slower.
                </p>
              </div>

              {/* Test */}
              <div className="flex items-center gap-3">
                <button
                  onClick={runTest}
                  disabled={testState.status === 'running' || (!settings.apiKey && settings.provider !== 'custom')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-[12.5px] font-medium text-wa-text transition hover:border-wa-teal/40 disabled:opacity-40"
                >
                  {testState.status === 'running' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 text-wa-teal-bright" />
                  )}
                  Test connection
                </button>
                {testState.status === 'ok' && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> {testState.message}
                  </span>
                )}
                {testState.status === 'error' && (
                  <span className="min-w-0 flex-1 truncate text-[12px] text-rose-400" title={testState.message}>
                    {testState.message}
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                <Toggle
                  checked={settings.useLiveAI}
                  onChange={(v) => onChange({ ...settings, useLiveAI: v })}
                  label="Use live model for scans"
                  hint="Sends the transcript to the provider above and merges its findings with the on-device analysis. Off means everything stays local."
                />
                <Toggle
                  checked={settings.simulateReplies}
                  onChange={(v) => onChange({ ...settings, simulateReplies: v })}
                  label="Simulate the other side"
                  hint="After you send a message, the other account types and answers on its own so a solo demo still feels like a conversation."
                />
                <Toggle
                  checked={settings.stealthMode}
                  onChange={(v) => onChange({ ...settings, stealthMode: v })}
                  label="Stealth mode"
                  hint="Keeps flag markers hidden inside the chat feed. Findings stay in the report only."
                />
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3.5 py-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-[11.5px] leading-relaxed text-amber-200/85">
                  Keys are stored in this browser&rsquo;s <code className="font-mono">localStorage</code> and
                  sent directly from your device to the provider. Fine for a prototype on your own
                  machine — do not use a shared computer or a production key.
                </p>
              </div>

              {/* Danger zone */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-wa-muted">
                  <Cpu className="h-3.5 w-3.5" /> Local data
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={onResetDemo}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-[12.5px] font-medium text-wa-muted transition hover:text-wa-text"
                  >
                    <RotateCcw className="h-4 w-4" /> Reset demo conversation
                  </button>
                  <button
                    onClick={onWipe}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[12.5px] font-medium text-rose-300 transition hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-4 w-4" /> Erase everything
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
