import { useState } from 'react'
import { motion } from 'framer-motion'
import { AtSign, Eye, EyeOff, Heart, Loader2, Lock, TriangleAlert } from 'lucide-react'
import { validatePassword, validateUsername } from '../lib/auth.js'
import { cn } from '../lib/utils.js'

/**
 * Username + password only. No email, no demo accounts, no recovery link —
 * losing the password means contacting whoever runs the project, and the
 * screen says so rather than offering a dead "forgot password" link.
 *
 * Fixed height with its own inner scroll so the keyboard opening on a small
 * phone never scrolls the whole app.
 */
export default function AuthScreen({ mode: initialMode = 'login', onSignIn, onSignUp, configError }) {
  const [mode, setMode] = useState(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const isSignup = mode === 'signup'

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError(null)

    const usernameError = validateUsername(username)
    if (usernameError) return setError(usernameError)
    const passwordError = validatePassword(password)
    if (passwordError) return setError(passwordError)

    setBusy(true)
    try {
      if (isSignup) await onSignUp(username, password)
      else await onSignIn(username, password)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-tm-bg">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-tm-rose/20 blur-[120px]" />

      <div className="relative flex flex-1 flex-col overflow-y-auto px-5 py-6">
        <div className="m-auto w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-7 text-center"
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
            <p className="mt-2 text-[13px] text-tm-muted">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="rounded-2xl border border-white/5 bg-tm-panel/80 p-5 shadow-2xl shadow-black/40 backdrop-blur"
          >
            <div className="mb-5 flex rounded-xl bg-tm-bg/70 p-1">
              {[
                ['login', 'Log in'],
                ['signup', 'Sign up'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMode(id)
                    setError(null)
                  }}
                  className={cn(
                    'flex-1 rounded-lg px-4 py-2.5 text-[13.5px] font-medium transition',
                    mode === id ? 'bg-tm-rose text-white' : 'text-tm-muted',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              <label className="flex items-center gap-3 rounded-xl border border-white/8 bg-tm-bg/60 px-4 py-3 transition focus-within:border-tm-rose/50">
                <AtSign className="h-4 w-4 shrink-0 text-tm-muted" />
                <span className="sr-only">Username</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  spellCheck={false}
                  className="w-full bg-transparent text-tm-text placeholder:text-tm-muted/60 focus:outline-none"
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/8 bg-tm-bg/60 px-4 py-3 transition focus-within:border-tm-rose/50">
                <Lock className="h-4 w-4 shrink-0 text-tm-muted" />
                <span className="sr-only">Password</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className="w-full bg-transparent text-tm-text placeholder:text-tm-muted/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 text-tm-muted transition hover:text-tm-text"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>

              {(error || configError) && (
                <p className="flex items-start gap-2 rounded-xl bg-rose-500/12 px-3 py-2.5 text-[12.5px] leading-relaxed text-rose-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {error || configError}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-tm-rose py-3.5 text-sm font-semibold text-white transition active:scale-[0.99] hover:bg-tm-rose-bright disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSignup ? 'Create account' : 'Log in'}
              </button>
            </form>

            <p className="mt-4 text-center text-[11.5px] leading-relaxed text-tm-muted/80">
              {isSignup
                ? 'Pick something you will remember. There is no password reset — if you lose it, only the team can help.'
                : 'Forgot your password? There is no self-service reset. Contact the team.'}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
