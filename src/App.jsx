import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { OTHER, USERS, AUTO_REPLIES } from './data/seed.js'
import { analyzeConversation, TIMEFRAMES } from './lib/analysis.js'
import { runLiveAnalysis } from './lib/ai.js'
import {
  loadMessages,
  loadReports,
  loadSession,
  loadSettings,
  resetDemo,
  saveMessages,
  saveReport,
  saveSession,
  saveSettings,
  wipeEverything,
} from './lib/storage.js'
import { uid } from './lib/utils.js'
import ChatWindow from './components/ChatWindow.jsx'
import Login from './components/Login.jsx'
import PerspectiveBar from './components/PerspectiveBar.jsx'
import ScanModal from './components/ScanModal.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import Sidebar from './components/Sidebar.jsx'

const MIN_SCAN_MS = 1900

export default function App() {
  const [session, setSession] = useState(() => loadSession())
  const [messages, setMessages] = useState(() => loadMessages())
  const [settings, setSettings] = useState(() => loadSettings())
  const [reportCount, setReportCount] = useState(() => loadReports().length)

  const [scanOpen, setScanOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [report, setReport] = useState(null)
  const [liveError, setLiveError] = useState(null)
  const [timeframe, setTimeframe] = useState('all')

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [focusMessageId, setFocusMessageId] = useState(null)
  const [injectedDraft, setInjectedDraft] = useState(null)
  const [mobilePane, setMobilePane] = useState('chat')

  // Stealth mode is the single source of truth for whether the chat feed shows
  // flag markers, so the report footer and the settings toggle can never disagree.
  const revealFlags = !settings.stealthMode
  const toggleReveal = () => setSettings((s) => ({ ...s, stealthMode: !s.stealthMode }))

  const timers = useRef([])
  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const viewingAs = session.viewingAs
  const partnerId = viewingAs ? OTHER[viewingAs] : null

  useEffect(() => saveMessages(messages), [messages])
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveSession(session), [session])

  // Opening the thread as someone marks everything addressed to them as read.
  useEffect(() => {
    if (!viewingAs) return
    setMessages((prev) => {
      if (!prev.some((m) => m.from !== viewingAs && m.status !== 'read')) return prev
      return prev.map((m) => (m.from !== viewingAs && m.status !== 'read' ? { ...m, status: 'read' } : m))
    })
  }, [viewingAs])

  /* ---------------------------------------------------------------- */

  const handleLogin = (userId) => setSession({ userId, viewingAs: userId })

  const handleSwitch = () => {
    setTyping(false)
    setSession((s) => ({ ...s, viewingAs: OTHER[s.viewingAs] }))
    setReport(null)
    setScanOpen(false)
  }

  const handleLogout = () => {
    setSession({ userId: null, viewingAs: null })
    setReport(null)
    setScanOpen(false)
  }

  const handleSend = (text) => {
    const message = {
      id: uid('msg'),
      from: viewingAs,
      text,
      ts: Date.now(),
      status: 'sent',
      attachment: null,
    }
    setMessages((prev) => [...prev, message])

    later(
      () =>
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'delivered' } : m))),
      700,
    )

    if (!settings.simulateReplies) return

    later(() => setTyping(true), 1100)
    later(() => {
      setTyping(false)
      setMessages((prev) => [
        ...prev.map((m) => (m.id === message.id ? { ...m, status: 'read' } : m)),
        {
          id: uid('msg'),
          from: OTHER[viewingAs],
          text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)],
          ts: Date.now(),
          status: 'delivered',
          attachment: null,
        },
      ])
    }, 3400)
  }

  /* ---------------------------------------------------------------- */

  const runScan = useCallback(
    async (tf = timeframe) => {
      if (!viewingAs) return
      const target = OTHER[viewingAs]
      setScanning(true)
      setLiveError(null)
      setScanOpen(true)

      const started = Date.now()
      const base = analyzeConversation({
        messages,
        targetId: target,
        targetName: USERS[target].name,
        timeframe: tf,
      })

      let final = base
      if (settings.useLiveAI && (settings.apiKey || settings.provider === 'custom')) {
        const span = TIMEFRAMES.find((t) => t.id === tf)?.ms ?? Infinity
        const windowStart = span === Infinity ? -Infinity : Date.now() - span
        try {
          const live = await runLiveAnalysis({
            messages: messages.filter((m) => m.ts >= windowStart),
            targetId: target,
            targetName: USERS[target].name,
            viewerName: USERS[viewingAs].name,
            settings,
          })
          const seen = new Set(base.flags.map((f) => `${f.category}:${f.messageId}`))
          final = {
            ...base,
            engine: 'live model',
            summary: live.summary,
            risk: live.risk == null ? base.risk : Math.round((live.risk + base.risk) / 2),
            flags: [...base.flags, ...live.flags.filter((f) => !seen.has(`${f.category}:${f.messageId}`))].sort(
              (a, b) => b.ts - a.ts,
            ),
            suggestions: [...live.suggestions, ...base.suggestions].slice(0, 5),
          }
        } catch (err) {
          setLiveError(err?.message ? `${err.message}.` : 'The request failed.')
        }
      }

      const elapsed = Date.now() - started
      later(
        () => {
          setReport(final)
          setScanning(false)
          setReportCount(saveReport(final).length)
          if (final.risk < 25) {
            confetti({
              particleCount: 90,
              spread: 70,
              origin: { y: 0.35 },
              colors: ['#00a884', '#06cf9c', '#53bdeb', '#e9edef'],
              disableForReducedMotion: true,
            })
          }
        },
        Math.max(0, MIN_SCAN_MS - elapsed),
      )
    },
    [messages, settings, timeframe, viewingAs, later],
  )

  const handleTimeframe = (tf) => {
    setTimeframe(tf)
    runScan(tf)
  }

  const handleJump = (messageId) => {
    setScanOpen(false)
    setMobilePane('chat')
    setFocusMessageId(messageId)
    later(() => setFocusMessageId(null), 2600)
  }

  const handleUseLine = (line) => {
    setInjectedDraft(line)
    setScanOpen(false)
    setMobilePane('chat')
  }

  const handleResetDemo = () => {
    setMessages(resetDemo())
    setReport(null)
    setReportCount(0)
    setSettingsOpen(false)
  }

  const handleWipe = () => {
    wipeEverything()
    setSettingsOpen(false)
    setReport(null)
    setReportCount(0)
    setMessages(loadMessages())
    setSession({ userId: null, viewingAs: null })
  }

  /* ---------------------------------------------------------------- */

  const flaggedIds = useMemo(() => new Set((report?.flags || []).map((f) => f.messageId)), [report])
  const highlightsById = useMemo(() => {
    const map = new Map()
    for (const flag of report?.flags || []) {
      if (!flag.messageId) continue
      map.set(flag.messageId, [...(map.get(flag.messageId) || []), ...(flag.highlights || [])])
    }
    return map
  }, [report])

  if (!session.userId || !viewingAs) return <Login onLogin={handleLogin} />

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-wa-bg">
      <PerspectiveBar
        viewingAs={viewingAs}
        onSwitch={handleSwitch}
        onLogout={handleLogout}
        onSettings={() => setSettingsOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          messages={messages}
          viewingAs={viewingAs}
          partnerId={partnerId}
          className={mobilePane === 'list' ? 'flex md:flex' : 'hidden md:flex'}
        />
        <div className={mobilePane === 'list' ? 'hidden min-w-0 flex-1 md:flex' : 'flex min-w-0 flex-1'}>
          <ChatWindow
            messages={messages}
            viewingAs={viewingAs}
            partnerId={partnerId}
            typing={typing}
            onSend={handleSend}
            onOpenScan={() => runScan(timeframe)}
            flaggedIds={flaggedIds}
            highlightsById={highlightsById}
            revealFlags={revealFlags}
            focusMessageId={focusMessageId}
            injectedDraft={injectedDraft}
            onDraftConsumed={() => setInjectedDraft(null)}
            onBack={() => setMobilePane('list')}
          />
        </div>
      </div>

      <ScanModal
        open={scanOpen}
        scanning={scanning}
        report={report}
        messages={messages}
        targetName={USERS[partnerId].name}
        timeframe={timeframe}
        onTimeframe={handleTimeframe}
        onClose={() => setScanOpen(false)}
        onRescan={() => runScan(timeframe)}
        onJump={handleJump}
        onUseLine={handleUseLine}
        revealFlags={revealFlags}
        onToggleReveal={toggleReveal}
        liveError={liveError}
        savedCount={reportCount}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
        onResetDemo={handleResetDemo}
        onWipe={handleWipe}
      />
    </div>
  )
}
