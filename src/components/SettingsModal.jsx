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
  Languages,
  RefreshCw,
  Server,
  Trash2,
  TriangleAlert,
  Wifi,
  X,
  Zap,
} from 'lucide-react'
import { DEFAULT_MODEL_BY_PROVIDER, PROVIDERS, testConnection } from '../lib/ai.js'
import { LANGUAGES } from '../lib/languages.js'
import { isCloudConfigured, testCloud } from '../lib/supabase.js'
import { cn } from '../lib/utils.js'

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl border border-white/5 bg-tm-panel-2/40 p-3.5 text-left transition hover:border-white/10"
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition',
          checked ? 'bg-tm-rose' : 'bg-tm-panel-3',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={cn('h-4 w-4 rounded-full bg-white shadow', checked && 'ml-auto')}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-tm-text">{label}</span>
        <span className="block text-[11.5px] leading-relaxed text-tm-muted">{hint}</span>
      </span>
    </button>
  )
}

export default function SettingsModal({ open, settings, onChange, onClose, onWipe }) {
  const [showKey, setShowKey] = useState(false)
  const [showCloudKey, setShowCloudKey] = useState(false)
  const [testState, setTestState] = useState({ status: 'idle' })
  const [cloudState, setCloudState] = useState({ status: 'idle' })
  const provider = PROVIDERS[settings.provider] || PROVIDERS.groq
  const cloudReady = isCloudConfigured(settings)

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

  const runCloudTest = async () => {
    setCloudState({ status: 'running' })
    try {
      const res = await testCloud(settings)
      setCloudState({
        status: 'ok',
        message: `Connected in ${res.ms}ms · ${res.count} messages in ${res.room}`,
      })
    } catch (err) {
      setCloudState({ status: 'error', message: err.message || 'Could not reach the project' })
    }
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
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-tm-panel shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-tm-rose/15 text-tm-rose-bright">
                <Bot className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-tm-text">Settings</h2>
                <p className="text-xs text-tm-muted">Sync, language and the AI engine</p>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-xl text-tm-muted transition hover:bg-tm-panel-2 hover:text-tm-text"
                aria-label="Close settings"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Realtime sync */}
              <div className="rounded-2xl border border-white/5 bg-tm-panel-2/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-tm-muted">
                    <Wifi className="h-3.5 w-3.5" /> Realtime sync
                  </p>
                  <span
                    className={cn(
                      'rounded-lg border px-2 py-0.5 text-[10.5px] font-medium',
                      cloudReady
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                        : 'border-white/10 text-tm-muted',
                    )}
                  >
                    {cloudReady ? 'Cloud' : 'This device only'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-tm-bg/60 px-3.5 py-3">
                    <Server className="h-4 w-4 shrink-0 text-tm-muted" />
                    <input
                      value={settings.supabaseUrl}
                      onChange={(e) => onChange({ ...settings, supabaseUrl: e.target.value })}
                      placeholder="https://xxxxx.supabase.co"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full bg-transparent text-[13px] text-tm-text placeholder:text-tm-muted/60 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-tm-bg/60 px-3.5 py-3">
                    <Key className="h-4 w-4 shrink-0 text-tm-muted" />
                    <input
                      type={showCloudKey ? 'text' : 'password'}
                      value={settings.supabaseKey}
                      onChange={(e) => onChange({ ...settings, supabaseKey: e.target.value })}
                      placeholder="anon public key"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full bg-transparent font-mono text-[13px] text-tm-text placeholder:text-tm-muted/60 focus:outline-none"
                    />
                    <button
                      onClick={() => setShowCloudKey((v) => !v)}
                      className="text-tm-muted transition hover:text-tm-text"
                      aria-label={showCloudKey ? 'Hide key' : 'Show key'}
                    >
                      {showCloudKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={runCloudTest}
                    disabled={!cloudReady || cloudState.status === 'running'}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-[12.5px] font-medium text-tm-text transition hover:border-tm-rose/40 disabled:opacity-40"
                  >
                    {cloudState.status === 'running' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wifi className="h-4 w-4 text-tm-rose-bright" />
                    )}
                    Test sync
                  </button>
                  {cloudState.status === 'ok' && (
                    <span className="min-w-0 flex-1 truncate text-[12px] text-emerald-400">
                      {cloudState.message}
                    </span>
                  )}
                  {cloudState.status === 'error' && (
                    <span
                      className="min-w-0 flex-1 truncate text-[12px] text-rose-400"
                      title={cloudState.message}
                    >
                      {cloudState.message}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-[11.5px] leading-relaxed text-tm-muted">
                  Accounts, chats and photos all live in this project. Setup SQL is in{' '}
                  <code className="font-mono">supabase/schema.sql</code>. Changing this signs you out.
                </p>
              </div>

              {/* Report language */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-tm-muted">
                  <Languages className="mr-1 inline h-3.5 w-3.5" /> Report language
                </label>
                <div className="relative">
                  <select
                    value={settings.reportLanguage}
                    onChange={(e) => onChange({ ...settings, reportLanguage: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-white/8 bg-tm-bg/60 px-3.5 py-3 pr-10 text-[13px] text-tm-text focus:border-tm-rose/50 focus:outline-none"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id} className="bg-tm-panel">
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tm-muted" />
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-tm-muted">
                  Reports come back in this language. Romanised input (Roman Urdu, Hindi, Indonesian,
                  Turkish, Romanian) is translated to English internally before analysis, so mixed
                  spelling never counts as a signal.
                </p>
              </div>

              {/* Provider */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-tm-muted">
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
                          ? 'border-tm-rose/50 bg-tm-rose/15 text-tm-rose-bright'
                          : 'border-white/8 bg-tm-panel-2/40 text-tm-muted hover:text-tm-text',
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-tm-muted">{provider.hint}</p>
              </div>

              {/* Custom endpoint */}
              {settings.provider === 'custom' && (
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-tm-muted">
                    Endpoint URL
                  </label>
                  <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-tm-bg/60 px-3.5 py-3">
                    <Server className="h-4 w-4 shrink-0 text-tm-muted" />
                    <input
                      value={settings.endpoint}
                      onChange={(e) => onChange({ ...settings, endpoint: e.target.value })}
                      placeholder="http://localhost:11434/v1/chat/completions"
                      className="w-full bg-transparent text-[13px] text-tm-text placeholder:text-tm-muted/60 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* API key */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-tm-muted">
                    API key
                  </label>
                  {provider.keysUrl && (
                    <a
                      href={provider.keysUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-tm-rose-bright hover:underline"
                    >
                      Get a free key <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-tm-bg/60 px-3.5 py-3">
                  <Key className="h-4 w-4 shrink-0 text-tm-muted" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={settings.apiKey}
                    onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
                    placeholder={settings.provider === 'groq' ? 'gsk_…' : 'sk-…'}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-transparent font-mono text-[13px] text-tm-text placeholder:text-tm-muted/60 focus:outline-none"
                  />
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="text-tm-muted transition hover:text-tm-text"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-tm-muted">
                  Model
                </label>
                <div className="relative">
                  <select
                    value={settings.model}
                    onChange={(e) => onChange({ ...settings, model: e.target.value })}
                    className="w-full appearance-none rounded-xl border border-white/8 bg-tm-bg/60 px-3.5 py-3 pr-10 text-[13px] text-tm-text focus:border-tm-rose/50 focus:outline-none"
                  >
                    {provider.models.map((m) => (
                      <option key={m.id} value={m.id} className="bg-tm-panel">
                        {m.label}
                        {m.tag ? ` — ${m.tag}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tm-muted" />
                </div>
                <p className="mt-2 text-[11.5px] text-tm-muted">
                  Open-weight models only. Reasoning models return better contradiction analysis but are
                  slower.
                </p>
              </div>

              {/* Test */}
              <div className="flex items-center gap-3">
                <button
                  onClick={runTest}
                  disabled={testState.status === 'running' || (!settings.apiKey && settings.provider !== 'custom')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-[12.5px] font-medium text-tm-text transition hover:border-tm-rose/40 disabled:opacity-40"
                >
                  {testState.status === 'running' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 text-tm-rose-bright" />
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

              {/* Local data */}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-tm-muted">
                  <Cpu className="h-3.5 w-3.5" /> This device
                </p>
                <p className="mb-2.5 text-[11.5px] leading-relaxed text-tm-muted">
                  Clears saved scan reports, your AI-friend thread and settings on this device.
                  Conversations stay in Supabase and come back when you log in.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                                    <button
                    onClick={onWipe}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-[12.5px] font-medium text-rose-300 transition hover:bg-rose-500/20 sm:col-span-2"
                  >
                    <Trash2 className="h-4 w-4" /> Clear local data
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
