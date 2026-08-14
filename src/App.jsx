import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { Heart } from 'lucide-react'
import { onHardwareBack } from './lib/back.js'
import { analyzeConversation, TIMEFRAMES } from './lib/analysis.js'
import { runLiveAnalysis, simplifyReport } from './lib/ai.js'
import { resolveLanguage } from './lib/languages.js'
import { buildPlainSummary } from './lib/report.js'
import { loadReports, loadSettings, saveReport, saveSettings, wipeEverything } from './lib/storage.js'
import { useChat } from './lib/use-chat.js'
import { ensureNotificationPermission, onNotificationTap } from './lib/notify.js'
import { registerPush, unregisterPush } from './lib/push.js'
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

  const conversationId = activeChat
  const inbox = useConversations({ settings, profile, activeConversationId: conversationId })
  const chat = useChat({ settings, profile, conversationId })

  const activeConversation = useMemo(
    () => inbox.conversations.find((c) => c.id === activeChat) || null,
    [inbox.conversations, activeChat],
  )
  const partner = activeConversation?.other || null

  // A push can be tapped before openChat exists further down, so the tap
  // goes through a ref rather than capturing it.
  const openChatRef = useRef(() => {})

  // Asked once, after the first successful login. Local notifications cover
  // the app being open or backgrounded; push covers it being closed.
  useEffect(() => {
    if (!profile) return
    ensureNotificationPermission()
    registerPush({ settings, profile, onOpenConversation: (id) => openChatRef.current(id) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

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

  const openChat = useCallback(
    (id) => {
      setActiveChat(id)
      setMobilePane('chat')
      setReport(null)
      setPlain(null)
      inbox.markConversationRead(id)
    },
    [inbox.markConversationRead],
  )

  openChatRef.current = openChat

  // Tapping a notification should land on that thread, not the inbox.
  useEffect(() => onNotificationTap(openChat), [openChat])

  const closeReport = () => {
    setScanOpen(false)
    setSimplified(false)
  }

  /* ------------------------------------------------------------------
     The device back gesture: peel off one layer at a time, outermost
     first, the way every other app on the phone behaves. Only when
     there is nothing left to close does the app exit.

     Kept in a ref so the listener is registered once — re-registering
     on every state change would drop presses in the gap.
     ------------------------------------------------------------------ */
  const backRef = useRef(() => false)
  backRef.current = () => {
    if (settingsOpen) return setSettingsOpen(false), true
    if (menuOpen) return setMenuOpen(false), true
    if (addOpen) return setAddOpen(false), true
    if (scanOpen) return closeReport(), true
    // On a phone the list and the chat are separate screens; on a wide
    // screen they are side by side and there is nothing to go back to.
    if (mobilePane === 'chat') return setMobilePane('list'), true
    return false
  }
  useEffect(() => onHardwareBack(() => backRef.current()), [])

  const handleSignOut = async () => {
    setMenuOpen(false)
    setSettingsOpen(false)
    closeReport()
    setActiveChat(null)
    setMobilePane('list')
    // Drop this phone's push token first, or whoever signs in next keeps
    // getting the previous account's messages.
    await unregisterPush({ settings, profile })
    await session.signOut()
  }

  const handleStartWith = async (person) => {
    const id = await inbox.startWith(person.id)
    setAddOpen(false)
    openChat(id)
  }

  /* ---------------------------------------------------------------- */

  const runScan = useCallback(
    async (tf = timeframe, langOverride) => {
      if (!partner) return
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
    [chat.messages, settings, timeframe, partner, profile, later],
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
      <div className="grid h-full place-items-center bg-tm-bg">
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
        settings={settings}
        onSettingsChange={setSettings}
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
    <div className="flex h-full flex-col overflow-hidden bg-tm-bg">
      <div className="flex min-h-0 flex-1">
        <Sidebar
          profile={profile}
          conversations={inbox.conversations}
          loading={inbox.loading}
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
              messages={chat.messages}
              viewingAs={profile.id}
              partner={partner}
              typing={chat.partnerTyping}
              online={chat.partnerOnline}
              live={chat.status === 'live'}
              connectionError={chat.status === 'error'}
              onTypingChange={chat.setTyping}
              onSend={chat.send}
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

      {partner && (
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
