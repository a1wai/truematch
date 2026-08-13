import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { OTHER, USERS } from './data/seed.js'
import { COMPANION } from './lib/companion.js'
import { useAiChat } from './lib/use-ai-chat.js'
import { analyzeConversation, TIMEFRAMES } from './lib/analysis.js'
import { runLiveAnalysis, simplifyReport } from './lib/ai.js'
import { resolveLanguage } from './lib/languages.js'
import { buildPlainSummary } from './lib/report.js'
import { useChat } from './lib/use-chat.js'
import {
  loadReports,
  loadSampleConversation,
  loadSession,
  loadSettings,
  resetDemo,
  saveReport,
  saveSession,
  saveSettings,
  wipeEverything,
} from './lib/storage.js'
import ChatWindow from './components/ChatWindow.jsx'
import Login from './components/Login.jsx'
import PerspectiveBar from './components/PerspectiveBar.jsx'
import ScanModal from './components/ScanModal.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import Sidebar from './components/Sidebar.jsx'

const MIN_SCAN_MS = 1900

export default function App() {
  const [session, setSession] = useState(() => loadSession())
  const [settings, setSettings] = useState(() => loadSettings())
  const [reportCount, setReportCount] = useState(() => loadReports().length)

  const [scanOpen, setScanOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [report, setReport] = useState(null)
  const [liveError, setLiveError] = useState(null)
  const [timeframe, setTimeframe] = useState('all')

  const [plain, setPlain] = useState(null)
  const [simplified, setSimplified] = useState(false)
  const [simplifying, setSimplifying] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [focusMessageId, setFocusMessageId] = useState(null)
  const [injectedDraft, setInjectedDraft] = useState(null)
  const [mobilePane, setMobilePane] = useState('list')
  const [activeChat, setActiveChat] = useState('partner')

  const viewingAs = session.viewingAs
  const partnerId = viewingAs ? OTHER[viewingAs] : null

  const chat = useChat({ settings, userId: viewingAs })
  const { messages } = chat
  const ai = useAiChat({
    settings,
    userId: viewingAs,
    userName: viewingAs ? USERS[viewingAs].name : '',
  })
  const onAiChat = activeChat === 'ai'

  // Stealth mode is the single source of truth for whether the chat feed shows
  // flag markers, so the report footer and the settings toggle cannot disagree.
  const revealFlags = !settings.stealthMode
  const toggleReveal = () => setSettings((s) => ({ ...s, stealthMode: !s.stealthMode }))

  const timers = useRef([])
  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveSession(session), [session])

  // Opening the thread as someone marks everything addressed to them as read.
  useEffect(() => {
    if (!viewingAs) return
    chat.markRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingAs, messages.length])

  /* ---------------------------------------------------------------- */

  const handleLogin = (userId) => {
    setSession({ userId, viewingAs: userId })
    setMobilePane('list')
    setActiveChat('partner')
  }

  const openChat = (id) => {
    setActiveChat(id)
    setMobilePane('chat')
  }

  const closeReport = () => {
    setScanOpen(false)
    setSimplified(false)
  }

  const handleSwitch = () => {
    setSession((s) => ({ ...s, viewingAs: OTHER[s.viewingAs] }))
    setReport(null)
    setPlain(null)
    closeReport()
  }

  const handleLogout = () => {
    setSession({ userId: null, viewingAs: null })
    setReport(null)
    setPlain(null)
    closeReport()
  }

  /* ---------------------------------------------------------------- */

  const runScan = useCallback(
    async (tf = timeframe, langOverride) => {
      if (!viewingAs) return
      const target = OTHER[viewingAs]
      setScanning(true)
      setLiveError(null)
      setScanOpen(true)
      setSimplified(false)
      setPlain(null)

      const started = Date.now()
      const languageSetting = langOverride ?? settings.reportLanguage
      const language = resolveLanguage(
        languageSetting,
        messages.map((m) => m.text).filter(Boolean),
      )

      const base = {
        ...analyzeConversation({
          messages,
          targetId: target,
          targetName: USERS[target].name,
          timeframe: tf,
        }),
        language,
        languageSetting,
      }

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
            language,
            settings,
          })
          const seen = new Set(base.flags.map((f) => `${f.category}:${f.messageId}`))
          final = {
            ...base,
            engine: 'live model',
            language: live.detectedLanguage && languageSetting === 'auto' ? live.detectedLanguage : language,
            summary: live.summary,
            summaryLocal: live.summaryLocal,
            risk: live.risk == null ? base.risk : Math.round((live.risk + base.risk) / 2),
            flags: [
              ...base.flags,
              ...live.flags.filter((f) => !seen.has(`${f.category}:${f.messageId}`)),
            ].sort((a, b) => b.ts - a.ts),
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
              colors: ['#ff2e63', '#ff7597', '#ff5c86', '#fce9f1'],
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

  const handleLanguage = (lang) => {
    setSettings((s) => ({ ...s, reportLanguage: lang }))
    runScan(timeframe, lang)
  }

  /**
   * Simplify always produces something: the local summary renders instantly,
   * and a configured model then replaces it with a better-written version.
   */
  const handleSimplify = async () => {
    if (!report) return
    const targetName = USERS[OTHER[viewingAs]].name
    setSimplified(true)
    setPlain(buildPlainSummary({ report, language: report.language, targetName, messages }))

    if (!settings.useLiveAI || !(settings.apiKey || settings.provider === 'custom')) return
    setSimplifying(true)
    try {
      const better = await simplifyReport({
        report,
        targetName,
        language: report.language,
        settings,
      })
      setPlain({
        bottomLine: better.bottomLine,
        points: better.points.map((text, i) => ({ id: `p${i}`, text })),
        nextStep: better.nextStep,
        source: 'llm',
      })
    } catch (err) {
      setLiveError(err?.message ? `${err.message}.` : 'Simplify request failed.')
    } finally {
      setSimplifying(false)
    }
  }

  const handleJump = (messageId) => {
    closeReport()
    setActiveChat('partner')
    setMobilePane('chat')
    setFocusMessageId(messageId)
    later(() => setFocusMessageId(null), 2600)
  }

  const handleUseLine = (line) => {
    setInjectedDraft(line)
    closeReport()
    setActiveChat('partner')
    setMobilePane('chat')
  }

  const handleLoadSample = () => {
    chat.replaceLocal(loadSampleConversation())
    setReport(null)
    setPlain(null)
    setSettingsOpen(false)
    setActiveChat('partner')
    setMobilePane('chat')
  }

  const handleResetDemo = () => {
    chat.replaceLocal(resetDemo())
    ai.clear()
    setReport(null)
    setPlain(null)
    setReportCount(0)
    setSettingsOpen(false)
  }

  const handleWipe = () => {
    wipeEverything()
    setSettingsOpen(false)
    setReport(null)
    setPlain(null)
    setReportCount(0)
    chat.replaceLocal(resetDemo())
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

  if (!session.userId || !viewingAs) return <Login onLogin={handleLogin} settings={settings} />

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-tm-bg">
      <PerspectiveBar
        viewingAs={viewingAs}
        onSwitch={handleSwitch}
        onLogout={handleLogout}
        onSettings={() => setSettingsOpen(true)}
        connection={chat.status}
      />

      {/* Plain language, and only where it is relevant — the AI thread is local. */}
      {!onAiChat && chat.status === 'error' && (
        <p
          className="bg-amber-500/15 px-4 py-1.5 text-center text-[11.5px] text-amber-200"
          title={chat.error || ''}
        >
          Offline — your messages are saved here and will sync when you reconnect
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <Sidebar
          messages={messages}
          aiMessages={ai.messages}
          viewingAs={viewingAs}
          partner={USERS[partnerId]}
          companion={COMPANION}
          activeChat={activeChat}
          onSelectChat={openChat}
          className={mobilePane === 'list' ? 'flex md:flex' : 'hidden md:flex'}
        />
        <div className={mobilePane === 'list' ? 'hidden min-w-0 flex-1 md:flex' : 'flex min-w-0 flex-1'}>
          <ChatWindow
            key={activeChat}
            isAI={onAiChat}
            messages={onAiChat ? ai.messages : messages}
            viewingAs={viewingAs}
            partner={onAiChat ? COMPANION : USERS[partnerId]}
            typing={onAiChat ? ai.typing : chat.partnerTyping}
            online={onAiChat ? true : chat.mode === 'cloud' ? chat.partnerOnline : true}
            live={chat.status === 'live'}
            room={chat.room}
            onTypingChange={onAiChat ? undefined : chat.setTyping}
            onSend={onAiChat ? ai.send : chat.send}
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
        language={settings.reportLanguage}
        onLanguage={handleLanguage}
        plain={plain}
        simplified={simplified}
        simplifying={simplifying}
        onSimplify={handleSimplify}
        onFullReport={() => setSimplified(false)}
        onClose={closeReport}
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
        onLoadSample={handleLoadSample}
        onWipe={handleWipe}
      />
    </div>
  )
}
