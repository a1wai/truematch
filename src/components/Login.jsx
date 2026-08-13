import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Heart, Lock, Mail, ScanFace, Sparkles, Wifi } from 'lucide-react'
import { USERS } from '../data/seed.js'
import { cloudConfig, isCloudConfigured } from '../lib/supabase.js'
import { cn } from '../lib/utils.js'
import Avatar from './Avatar.jsx'

export default function Login({ onLogin, settings }) {
  const [mode, setMode] = useState('login')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const cloud = isCloudConfigured(settings)
  const { room } = cloudConfig(settings)

  const submit = (e) => {
    e.preventDefault()
    // Prototype auth: the address just picks which of the two accounts you are.
    const guess = email.trim().toLowerCase().startsWith('bisma') ? 'b' : 'a'
    onLogin(guess)
  }

  return (
    <div className="relative min-h-dvh overflow-y-auto bg-tm-bg">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-tm-rose/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-52 -right-24 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/10 blur-[130px]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-center"
        >
          <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center">
            <span
              className="absolute inset-0 rounded-full bg-tm-rose/25 blur-xl"
              style={{ animation: 'heartbeat 2.6s ease-in-out infinite' }}
            />
            <Heart className="relative h-9 w-9 fill-tm-rose text-tm-rose" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-tm-text">
            True<span className="text-tm-rose">Match</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-xs text-[13.5px] leading-relaxed text-tm-muted">
            Private messaging for two — with a quiet honesty check running underneath every
            conversation.
          </p>
        </motion.div>

        {/* Demo accounts — the fast path, so this sits above the form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="rounded-2xl border border-tm-rose/20 bg-tm-panel/80 p-4 shadow-2xl shadow-black/40 backdrop-blur"
        >
          <p className="mb-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-tm-rose-bright">
            <Sparkles className="h-3.5 w-3.5" /> Tap to enter
          </p>
          <div className="grid gap-2.5">
            {Object.values(USERS).map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onLogin(user.id)}
                className="group flex items-center gap-3 rounded-xl border border-white/8 bg-tm-panel-2/70 p-3 text-left transition active:scale-[0.99] hover:border-tm-rose/50 hover:bg-tm-panel-2"
              >
                <Avatar user={user} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-tm-text">{user.name}</span>
                  <span className="block truncate text-[12px] text-tm-muted">
                    {user.label} · {user.email}
                  </span>
                </span>
                <span className="rounded-lg bg-tm-rose/15 px-2.5 py-1.5 text-[11px] font-semibold text-tm-rose-bright">
                  Login
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-tm-muted/80">
            Test accounts — no password needed. Open one on each phone to chat for real.
          </p>
        </motion.div>

        {/* Credential form */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16 }}
          className="rounded-2xl border border-white/5 bg-tm-panel/70 p-5 backdrop-blur"
        >
          <div className="mb-4 flex rounded-xl bg-tm-bg/70 p-1">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2 text-[13px] font-medium transition',
                  mode === m ? 'bg-tm-rose text-white' : 'text-tm-muted hover:text-tm-text',
                )}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <Field icon={Mail} label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usama@truematch.app"
                className="w-full bg-transparent text-sm text-tm-text placeholder:text-tm-muted/60 focus:outline-none"
              />
            </Field>
            <Field icon={Lock} label="Password">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-sm text-tm-text placeholder:text-tm-muted/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-tm-muted transition hover:text-tm-text"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>

            <button
              type="submit"
              className="w-full rounded-xl bg-tm-rose py-3 text-sm font-semibold text-white transition hover:bg-tm-rose-bright active:scale-[0.99]"
            >
              {mode === 'login' ? 'Continue' : 'Create account'}
            </button>
          </form>
        </motion.div>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-tm-muted/70">
          {cloud ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              Live sync on · room <span className="font-mono text-tm-muted">{room}</span>
            </>
          ) : (
            <>
              <ScanFace className="h-3.5 w-3.5" />
              Running on this device only — add a sync room in Settings
            </>
          )}
        </p>
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, children }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-white/5 bg-tm-bg/60 px-4 py-3 transition focus-within:border-tm-rose/50">
      <Icon className="h-4 w-4 shrink-0 text-tm-muted" />
      <span className="sr-only">{label}</span>
      {children}
    </label>
  )
}
