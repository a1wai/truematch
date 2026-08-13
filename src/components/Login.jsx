import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Fingerprint, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { USERS } from '../data/seed.js'
import { cn } from '../lib/utils.js'
import Avatar from './Avatar.jsx'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = (e) => {
    e.preventDefault()
    // Prototype auth: any address resolves to the user it looks most like.
    const guess = email.trim().toLowerCase().startsWith('jordan') ? 'b' : 'a'
    onLogin(guess)
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-wa-bg">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-wa-teal/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-52 -right-24 h-[28rem] w-[28rem] rounded-full bg-emerald-500/10 blur-[130px]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center gap-10 px-5 py-12 lg:flex-row lg:gap-16">
        {/* Brand side */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md text-center lg:text-left"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-wa-teal/30 bg-wa-teal/10 px-3 py-1 text-xs font-medium text-wa-teal-bright">
            <Sparkles className="h-3.5 w-3.5" />
            Prototype build · v1.0
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-wa-text sm:text-5xl">
            True<span className="text-wa-teal">Match</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-wa-muted">
            End-to-end encrypted messaging for two. Simple, quiet, and yours — with a
            <span className="text-wa-text"> language integrity engine</span> running quietly in the
            background of every conversation.
          </p>
          <ul className="mt-7 space-y-3 text-sm text-wa-muted">
            {[
              ['Nothing leaves this device', ShieldCheck],
              ['Analysis runs locally, on demand', Fingerprint],
              ['Bring your own open-source model', Sparkles],
            ].map(([label, Icon]) => (
              <li key={label} className="flex items-center justify-center gap-3 lg:justify-start">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-wa-panel-2 text-wa-teal">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Card side */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md rounded-2xl border border-white/5 bg-wa-panel/90 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8"
        >
          <div className="mb-6 flex rounded-xl bg-wa-bg/70 p-1">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition',
                  mode === m ? 'bg-wa-teal text-wa-bg' : 'text-wa-muted hover:text-wa-text',
                )}
              >
                {m === 'login' ? 'Log in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field icon={Mail} label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@truematch.app"
                className="w-full bg-transparent text-sm text-wa-text placeholder:text-wa-muted/60 focus:outline-none"
              />
            </Field>
            <Field icon={Lock} label="Password">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-sm text-wa-text placeholder:text-wa-muted/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-wa-muted transition hover:text-wa-text"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>

            <button
              type="submit"
              className="w-full rounded-xl bg-wa-teal py-3 text-sm font-semibold text-wa-bg transition hover:bg-wa-teal-bright active:scale-[0.99]"
            >
              {mode === 'login' ? 'Continue' : 'Create account'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-wa-muted/70">
            <span className="h-px flex-1 bg-white/5" />
            demo accounts
            <span className="h-px flex-1 bg-white/5" />
          </div>

          <div className="grid gap-3">
            {Object.values(USERS).map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onLogin(user.id)}
                className="group flex items-center gap-3 rounded-xl border border-white/5 bg-wa-panel-2/70 p-3 text-left transition hover:border-wa-teal/40 hover:bg-wa-panel-2"
              >
                <Avatar user={user} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-wa-text">
                    Login as {user.label}
                  </span>
                  <span className="block truncate text-xs text-wa-muted">
                    {user.name} · {user.email}
                  </span>
                </span>
                <span className="rounded-lg bg-wa-teal/10 px-2.5 py-1 text-[11px] font-medium text-wa-teal-bright opacity-0 transition group-hover:opacity-100">
                  Enter
                </span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-wa-muted/70">
            Prototype only — no real authentication, no server. Both accounts live on this device so
            you can play both sides of the conversation.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, children }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-white/5 bg-wa-bg/60 px-4 py-3 transition focus-within:border-wa-teal/50">
      <Icon className="h-4 w-4 shrink-0 text-wa-muted" />
      <span className="sr-only">{label}</span>
      {children}
    </label>
  )
}
