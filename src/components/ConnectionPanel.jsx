import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, Loader2, Server, TriangleAlert } from 'lucide-react'
import { cloudConfig, testCloud } from '../lib/supabase.js'
import { cn } from '../lib/utils.js'

/**
 * Diagnostics on the login screen.
 *
 * Without this, a misconfigured build is a dead end: Settings lives behind the
 * login, so someone who cannot sign up has no way to see which project the app
 * is even talking to. This shows the host, runs a real query against it, and
 * reports the raw error rather than a friendly paraphrase — when setup is
 * broken, the exact message is the useful thing.
 */
export default function ConnectionPanel({ settings, onChange }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ status: 'idle' })
  const { url } = cloudConfig(settings)
  const host = url.replace(/^https?:\/\//, '') || 'not configured'

  const run = async () => {
    setState({ status: 'running' })
    try {
      const res = await testCloud(settings)
      setState({
        status: 'ok',
        message: `Connected in ${res.ms}ms · ${res.count} account${res.count === 1 ? '' : 's'} registered`,
      })
    } catch (err) {
      setState({ status: 'error', message: err.message || String(err) })
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mx-auto flex items-center gap-1.5 text-[11.5px] text-tm-muted/80 transition hover:text-tm-text"
      >
        <Server className="h-3.5 w-3.5" />
        <span className="font-mono">{host}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2.5 rounded-xl border border-white/8 bg-tm-panel/70 p-3.5">
              <p className="text-[11.5px] leading-relaxed text-tm-muted">
                The app talks to this project. Leave both boxes empty to use the one built into this
                APK.
              </p>

              <input
                value={settings.supabaseUrl}
                onChange={(e) => onChange({ ...settings, supabaseUrl: e.target.value })}
                placeholder="https://xxxxx.supabase.co"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-lg border border-white/8 bg-tm-bg/60 px-3 py-2.5 text-[12.5px] text-tm-text placeholder:text-tm-muted/50 focus:border-tm-rose/50 focus:outline-none"
              />
              <input
                value={settings.supabaseKey}
                onChange={(e) => onChange({ ...settings, supabaseKey: e.target.value })}
                placeholder="anon public key"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-lg border border-white/8 bg-tm-bg/60 px-3 py-2.5 font-mono text-[12.5px] text-tm-text placeholder:text-tm-muted/50 focus:border-tm-rose/50 focus:outline-none"
              />

              <button
                type="button"
                onClick={run}
                disabled={state.status === 'running'}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2.5 text-[12.5px] font-medium text-tm-text transition active:scale-[0.99] disabled:opacity-50"
              >
                {state.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Test connection
              </button>

              {state.status === 'ok' && (
                <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {state.message}
                </p>
              )}
              {state.status === 'error' && (
                <p className="flex items-start gap-2 rounded-lg bg-rose-500/12 px-3 py-2.5 text-[12px] leading-relaxed text-rose-200">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-words">{state.message}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
