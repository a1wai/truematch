import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { Heart } from 'lucide-react'
import { analyzeConversation, TIMEFRAMES } from './lib/analysis.js'
import { runLiveAnalysis, simplifyReport } from './lib/ai.js'
import { COMPANION } from './lib/companion.js'
import { resolveLanguage } from './lib/languages.js'
import { buildPlainSummary } from './lib/report.js'
import { loadReports, loadSettings, saveReport, saveSettings, wipeEverything } from './lib/storage.js'
import { useAiChat } from './lib/use-ai-chat.js'
import { useChat } from './lib/use-chat.js'
import { useConversations } from './lib/use-conversations.js'
import { useSession } from './lib/use-session.js'
import AddUserSheet from './components/AddUserSheet.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import AvatarSetup from './components/AvatarSetup.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import MenuSheet from './components/MenuSheet.jsx'
import ScanModal from './components/ScanModal.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import Sidebar from './components/Sidebar.jsx'

const MIN_SCAN_MS = 1900

export default function App() {
  const [settings, setSettings] = useState(() => loadSettings())
  const session = useSession({ settings })
  const { profile } = session

  const [activeChat, setActiveChat] = useState(null) // conversation id | 'ai' | null
  const [mobilePane, setMobilePane] = useState('list')
  const [addOpen, setAddOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [scanOpen, setScanOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [report, setReport] = useState(null)
  const [liveError, setLiveError] = useState(null)
  const [timeframe, setTimeframe] = useState('all')
  const [reportCount, setReportCount] = useState(() => loadReports().length)
  const [plain, setPlain] = useState(null)
  const [simplified, setSimplified] = useState(false)
  const [simplifying, setSimplifying] = useState(false)

  const [focusMessageId, setFocusMessageId] = useState(null)
  const [injectedDraft, setInjectedDraft] = useState(null)

  const inbox = useConversations({ settings, profile })
  const onAiChat = activeChat === 'ai'
  const conversationId = onAiChat ? null : activeChat
  const chat = useChat({ settings, profile, conversationId })
  const ai = useAiChat({ settings, userId: profile?.id, userName: profile?.username || '' })

  const activeConversation = useMemo(
    () => inbox.conversations.find((c) => c.id === activeChat) || null,
    [inbox.conversations, activeChat],
  )
  const partner = onAiChat ? COMPANION : activeConversation?.other || null

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

  useEffect(() => {
    if (conversationId) chat.markRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, chat.messages.length])

  /* ---------------------------------------------------------------- */

  const openChat = (id) => {
    setActiveChat(id)
    setMobilePane('chat')
    setReport(null)
    setPlain(null)
  }

  const closeReport = () => {
    setScanOpen(false)
    setSimplified(false)
  }

  const handleSignOut = async () => {
    setMenuOpen(false)
    setSettingsOpen(false)
    closeReport()
    setActiveChat(null)
    setMobilePane('list')
    await session.signOut()
  }

  const handleStartWith = async (person) => {
    const id = await inbox.startWith(person.id)
    setAddOpen(false)
    openChat(id)
  }

  /* ---------------------------------------------------------------- */

  const messages = onAiChat ? ai.messages : chat.messages

  const runScan = useCallback(
    async (tf = timeframe, langOverride) => {
      if (!partner || onAiChat) return
      setScanning(true)
      setLiveError(null)
      setScanOpen(true)
      setSimplified(false)
      setPlain(null)

      const started = Date.now()
      const languageSetting = langOverride ?? settings.reportLanguage
      const language = resolveLanguage(
        languageSetting,
        chat.messages.map((m) => m.text).filter(Boolean),
      )
      const targetName = `@${partner.username}`

      const base = {
        ...analyzeConversation({
          messages: chat.messages,
          targetId: partner.id,
          targetName,
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
            messages: chat.messages.filter((m) => m.ts >= windowStart),
            targetId: partner.id,
            targetName,
            viewerName: `@${profile.username}`,
            language,
            settings,
          })
          const seen = new Set(base.flags.map((f) => `${f.category}:${f.messageId}`))
          final = {
            ...base,
            engine: 'live model',
            language:
              live.detectedLanguage && languageSetting === 'auto' ? live.detectedLanguage : language,
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
          if (final.risk < 25 && final.flags.length) {
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
    [chat.messages, settings, timeframe, partner, profile, onAiChat, later],
  )

  const handleSimplify = async () => {
    if (!report || !partner) return
    const targetName = `@${partner.username}`
    setSimplified(true)
    setPlain(
      buildPlainSummary({ report, language: report.language, targetName, messages: chat.messages }),
    )
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
    setMobilePane('chat')
    setFocusMessageId(messageId)
    later(() => setFocusMessageId(null), 2600)
  }

  const handleUseLine = (line) => {
    setInjectedDraft(line)
    closeReport()
    setMobilePane('chat')
  }

  const handleWipe = () => {
    wipeEverything()
    setSettingsOpen(false)
    setReport(null)
    setPlain(null)
    setReportCount(0)
    ai.clear()
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

  /* ------------------------- screens ------------------------- */

  if (session.stage === 'loading') {
    return (
      <div className="grid h-dvh place-items-center bg-tm-bg">
        <Heart
          className="h-10 w-10 fill-tm-rose text-tm-rose"
          style={{ animation: 'heartbeat 2.6s ease-in-out infinite' }}
        />
      </div>
    )
  }

  if (session.stage === 'auth' || !profile) {
    return (
      <AuthScreen
        onSignIn={session.signIn}
        onSignUp={session.signUp}
        configError={session.error}
      />
    )
  }

  if (session.stage === 'avatar') {
    return (
      <AvatarSetup
        username={profile.username}
        onSave={session.saveAvatar}
        onSignOut={handleSignOut}
      />
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-tm-bg">
      <div className="flex min-h-0 flex-1">
        <Sidebar
          profile={profile}
          conversations={inbox.conversations}
          loading={inbox.loading}
          aiMessages={ai.messages}
          companion={COMPANION}
          activeChat={activeChat}
          onSelectChat={openChat}
          onAddUser={() => setAddOpen(true)}
          onOpenMenu={() => setMenuOpen(true)}
          className={mobilePane === 'list' ? 'flex md:flex' : 'hidden md:flex'}
        />

        <div
          className={
            mobilePane === 'list' ? 'hidden min-w-0 flex-1 md:flex' : 'flex min-w-0 flex-1'
          }
        >
          {partner ? (
            <ChatWindow
              key={activeChat}
              isAI={onAiChat}
              messages={messages}
              viewingAs={onAiChat ? profile.id : profile.id}
              partner={partner}
              typing={onAiChat ? ai.typing : chat.partnerTyping}
              online={onAiChat ? true : chat.partnerOnline}
              live={onAiChat ? false : chat.status === 'live'}
              connectionError={onAiChat ? null : chat.status === 'error'}
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
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-tm-bg px-8 text-center md:flex">
              <Heart className="h-10 w-10 text-tm-rose/40" />
              <p className="text-[15px] font-medium text-tm-text">Pick a chat</p>
              <p className="max-w-xs text-[13px] leading-relaxed text-tm-muted">
                Or add someone by username to start a new conversation.
              </p>
            </div>
          )}
        </div>
      </div>

      <AddUserSheet
        open={addOpen}
        settings={settings}
        profile={profile}
        onClose={() => setAddOpen(false)}
        onStart={handleStartWith}
      />

      <MenuSheet
        open={menuOpen}
        profile={profile}
        onClose={() => setMenuOpen(false)}
        onOpenSettings={() => {
          setMenuOpen(false)
          setSettingsOpen(true)
        }}
        onSignOut={handleSignOut}
        onSaveAvatar={session.saveAvatar}
      />

      {partner && !onAiChat && (
        <ScanModal
          open={scanOpen}
          scanning={scanning}
          report={report}
          messages={chat.messages}
          targetName={`@${partner.username}`}
          timeframe={timeframe}
          onTimeframe={(tf) => {
            setTimeframe(tf)
            runScan(tf)
          }}
          language={settings.reportLanguage}
          onLanguage={(lang) => {
            setSettings((s) => ({ ...s, reportLanguage: lang }))
            runScan(timeframe, lang)
          }}
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
      )}

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
        onWipe={handleWipe}
      />
    </div>
  )
}
