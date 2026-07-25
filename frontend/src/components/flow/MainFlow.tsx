import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as api from '../../lib/api'
import { ApiError } from '../../lib/api'
import { useAuth } from '../../lib/AuthContext'
import { useDownloadManager, isTerminalStatus } from '../../lib/DownloadManagerContext'
import { useToast } from '../../lib/ToastContext'
import { requestNotificationPermissionOnce } from '../../lib/notifications'
import { hasUsedGuestDownload, markGuestDownloadUsed } from '../../lib/guestState'
import { setPendingUrl, takePendingUrl } from '../../lib/pendingUrl'
import { takeSharedUrl } from '../../lib/pwa'
import { useLanguage } from '../../lib/i18n/LanguageContext'
import { UrlCard } from '../UrlCard'
import { PreviewCard, type DownloadChoice } from './PreviewCard'
import { ProgressCard } from './ProgressCard'
import { DoneCard } from './DoneCard'
import { ErrorCard } from './ErrorCard'
import { GuestInvite } from './GuestInvite'
import './MainFlow.css'

type Phase = 'idle' | 'analyzing' | 'preview' | 'tracking' | 'guest-blocked'

export function MainFlow() {
  const { user } = useAuth()
  const manager = useDownloadManager()
  const { showToast } = useToast()
  const { t } = useLanguage()

  const [phase, setPhase] = useState<Phase>('idle')
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analyzeResult, setAnalyzeResult] = useState<api.AnalyzeResponse | null>(null)
  const [currentUrl, setCurrentUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [jobId, setJobId] = useState<number | null>(null)
  const [initialUrl, setInitialUrl] = useState<string | undefined>(undefined)
  const [justFinishedGuest, setJustFinishedGuest] = useState(false)

  useEffect(() => {
    const shared = takeSharedUrl()
    const pending = takePendingUrl()
    const url = shared ?? pending
    if (url) setInitialUrl(url)
  }, [])

  const job = jobId != null ? manager.jobs.find((j) => j.id === jobId) : undefined

  function resetToIdle() {
    setPhase('idle')
    setAnalyzeResult(null)
    setAnalyzeError(null)
    setJobId(null)
    setJustFinishedGuest(false)
  }

  async function handleSubmitUrl(url: string) {
    setCurrentUrl(url)
    if (!user && hasUsedGuestDownload()) {
      setPendingUrl(url)
      setPhase('guest-blocked')
      return
    }
    setPhase('analyzing')
    setAnalyzeError(null)
    try {
      const result = await api.analyze(url)
      setAnalyzeResult(result)
      setPhase('preview')
    } catch (err) {
      setAnalyzeError(err instanceof ApiError ? err.message : t.home.unrecognizedLink)
      setPhase('idle')
    }
  }

  async function handleDownload(choice: DownloadChoice) {
    setSubmitting(true)
    try {
      const response = await api.createDownload({
        url: currentUrl,
        mode: choice.mode,
        format_id: choice.formatId,
        audio_format: choice.audioFormat,
        subtitle_langs: choice.subtitleLangs,
        filename: choice.filename,
      })
      requestNotificationPermissionOnce()
      manager.trackJob({
        id: response.id,
        url: currentUrl,
        title: analyzeResult?.title ?? currentUrl,
        mode: choice.mode,
        position: response.position,
      })
      setJobId(response.id)
      setPhase('tracking')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'guest_limit_reached') {
        markGuestDownloadUsed()
        setPendingUrl(currentUrl)
        setPhase('guest-blocked')
      } else {
        showToast(err instanceof ApiError ? err.message : t.common.genericError, 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (job?.status === 'done' && !user) {
      markGuestDownloadUsed()
      setJustFinishedGuest(true)
    }
  }, [job?.status, user])

  useEffect(() => {
    if (job && isTerminalStatus(job.status) && (job.status === 'cancelled' || job.status === 'expired')) {
      resetToIdle()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status])

  let stepKey: string = phase
  let content: ReactNode

  if (phase === 'guest-blocked') {
    content = <GuestInvite />
  } else if (phase === 'tracking' && job) {
    stepKey = `tracking-${job.status}`
    if (job.status === 'queued' || job.status === 'downloading' || job.status === 'processing') {
      content = (
        <div className="main-flow__tracking">
          <ProgressCard job={job} onCancel={() => manager.cancelJob(job.id)} />
          <button type="button" className="main-flow__new-link" onClick={resetToIdle}>
            {t.home.newLink}
          </button>
        </div>
      )
    } else if (job.status === 'done') {
      content = (
        <DoneCard job={job} onRestart={resetToIdle} guestInvite={justFinishedGuest ? <GuestInvite /> : undefined} />
      )
    } else if (job.status === 'failed') {
      content = (
        <ErrorCard
          message={job.errorMessage ?? t.common.genericError}
          onRetry={() => analyzeResult && setPhase('preview')}
          onChangeUrl={resetToIdle}
        />
      )
    }
  } else if (phase === 'preview' && analyzeResult) {
    content = <PreviewCard result={analyzeResult} onDownload={handleDownload} submitting={submitting} />
  } else {
    content = (
      <UrlCard
        analyzing={phase === 'analyzing'}
        error={analyzeError}
        onSubmitUrl={handleSubmitUrl}
        initialUrl={initialUrl}
      />
    )
  }

  return (
    // Morphing du bloc central entre les états A→F (CDC UI §9, "le moment signature") :
    // un fondu+glissement discret suffit à faire percevoir la transition comme fluide
    // sans distraire — chaque carte garde par ailleurs ses propres micro-animations
    // internes (ex. la célébration de DoneCard).
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  )
}
