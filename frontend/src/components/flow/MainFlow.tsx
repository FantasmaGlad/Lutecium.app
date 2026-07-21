import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { ApiError } from '../../lib/api'
import { useAuth } from '../../lib/AuthContext'
import { useDownloadManager, isTerminalStatus } from '../../lib/DownloadManagerContext'
import { useToast } from '../../lib/ToastContext'
import { requestNotificationPermissionOnce } from '../../lib/notifications'
import { hasUsedGuestDownload, markGuestDownloadUsed } from '../../lib/guestState'
import { setPendingUrl, takePendingUrl } from '../../lib/pendingUrl'
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

  const [phase, setPhase] = useState<Phase>('idle')
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analyzeResult, setAnalyzeResult] = useState<api.AnalyzeResponse | null>(null)
  const [currentUrl, setCurrentUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [jobId, setJobId] = useState<number | null>(null)
  const [initialUrl, setInitialUrl] = useState<string | undefined>(undefined)
  const [justFinishedGuest, setJustFinishedGuest] = useState(false)

  useEffect(() => {
    const pending = takePendingUrl()
    if (pending) setInitialUrl(pending)
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
      setAnalyzeError(err instanceof ApiError ? err.message : "Ce lien n'est pas reconnu.")
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
        showToast(err instanceof ApiError ? err.message : 'Une erreur est survenue.', 'error')
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

  if (phase === 'guest-blocked') {
    return <GuestInvite />
  }

  if (phase === 'tracking' && job) {
    if (job.status === 'queued' || job.status === 'downloading' || job.status === 'processing') {
      return (
        <div className="main-flow__tracking">
          <ProgressCard job={job} onCancel={() => manager.cancelJob(job.id)} />
          <button type="button" className="main-flow__new-link" onClick={resetToIdle}>
            + coller un nouveau lien
          </button>
        </div>
      )
    }
    if (job.status === 'done') {
      return <DoneCard job={job} onRestart={resetToIdle} guestInvite={justFinishedGuest ? <GuestInvite /> : undefined} />
    }
    if (job.status === 'failed') {
      return (
        <ErrorCard
          message={job.errorMessage ?? 'Une erreur est survenue.'}
          onRetry={() => analyzeResult && setPhase('preview')}
          onChangeUrl={resetToIdle}
        />
      )
    }
  }

  if (phase === 'preview' && analyzeResult) {
    return <PreviewCard result={analyzeResult} onDownload={handleDownload} submitting={submitting} />
  }

  return (
    <UrlCard
      analyzing={phase === 'analyzing'}
      error={analyzeError}
      onSubmitUrl={handleSubmitUrl}
      initialUrl={initialUrl}
    />
  )
}
