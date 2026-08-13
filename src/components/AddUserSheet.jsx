import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AtSign, Loader2, Search, UserPlus, X } from 'lucide-react'
import { searchProfiles } from '../lib/auth.js'
import Avatar from './Avatar.jsx'

/**
 * Find someone by username and open a chat with them. Usernames only — there
 * is no directory browsing and no discovery by anything else, so you have to
 * already know who you are looking for.
 */
export default function AddUserSheet({ open, settings, profile, onClose, onStart }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [startingId, setStartingId] = useState(null)
  const debounce = useRef(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setError(null)
    }
  }, [open])

  useEffect(() => {
    clearTimeout(debounce.current)
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounce.current = setTimeout(async () => {
      try {
        setResults(await searchProfiles(settings, q, profile?.id))
        setError(null)
      } catch (err) {
        setError(err.message || 'Search failed')
      } finally {
        setSearching(false)
      }
    }, 320)
    return () => clearTimeout(debounce.current)
  }, [query, settings, profile])

  const start = async (person) => {
    setStartingId(person.id)
    try {
      await onStart(person)
    } catch (err) {
      setError(err.message || 'Could not open that chat')
    } finally {
      setStartingId(null)
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
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[75dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-tm-panel sm:h-[70dvh] sm:max-w-md sm:rounded-2xl"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-tm-rose/15 text-tm-rose-bright">
                <UserPlus className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-tm-text">Add someone</h2>
                <p className="text-[11.5px] text-tm-muted">Search by their exact username</p>
              </div>
              <button
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-xl text-tm-muted transition active:bg-tm-panel-2"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="shrink-0 px-4 py-3">
              <div className="flex items-center gap-2.5 rounded-xl bg-tm-panel-2 px-3.5 py-3">
                <AtSign className="h-4 w-4 shrink-0 text-tm-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value.replace(/\s/g, '').toLowerCase())}
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent text-tm-text placeholder:text-tm-muted/60 focus:outline-none"
                />
                {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-tm-muted" />}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {error && (
                <p className="mx-2 rounded-xl bg-rose-500/12 px-3 py-2.5 text-[12.5px] text-rose-200">
                  {error}
                </p>
              )}

              {results.map((person) => (
                <button
                  key={person.id}
                  onClick={() => start(person)}
                  disabled={startingId === person.id}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition active:bg-tm-panel-2 disabled:opacity-60"
                >
                  <Avatar user={person} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-tm-text">
                      @{person.username}
                    </span>
                  </span>
                  {startingId === person.id ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-tm-rose-bright" />
                  ) : (
                    <span className="rounded-lg bg-tm-rose/15 px-3 py-1.5 text-[11.5px] font-semibold text-tm-rose-bright">
                      Chat
                    </span>
                  )}
                </button>
              ))}

              {!searching && !error && query.trim().length >= 2 && results.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <Search className="mx-auto mb-3 h-7 w-7 text-tm-muted/50" />
                  <p className="text-[13.5px] font-medium text-tm-text">No one called “{query}”</p>
                  <p className="mt-1.5 text-[12.5px] text-tm-muted">
                    Usernames must match exactly from the start. Check the spelling with them.
                  </p>
                </div>
              )}

              {query.trim().length < 2 && (
                <p className="px-6 py-12 text-center text-[12.5px] leading-relaxed text-tm-muted">
                  Type at least two characters of their username.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
