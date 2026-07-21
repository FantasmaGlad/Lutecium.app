import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import * as api from './api'
import { subscribeDownloadEvents } from './downloadEvents'
import { useToast } from './ToastContext'

export type JobStatus = 'queued' | 'downloading' | 'processing' | 'done' | 'failed' | 'cancelled' | 'expired'

export interface TrackedJob {
  id: number
  url: string
  title: string
  mode: api.DownloadMode
  status: JobStatus
  position?: number
  estimatedWaitSeconds?: number | null
  downloadedBytes?: number | null
  totalBytes?: number | null
  speed?: number | null
  eta?: number | null
  step?: string
  filename?: string
  sizeBytes?: number
  fileUrl?: string
  errorMessage?: string
  createdAt: number
  doneAt?: number
}

interface DownloadManagerValue {
  jobs: TrackedJob[]
  trackJob: (job: { id: number; url: string; title: string; mode: api.DownloadMode; position: number }) => void
  cancelJob: (id: number) => Promise<void>
  removeJob: (id: number) => void
  isOpen: boolean
  setOpen: (open: boolean) => void
}

const DownloadManagerContext = createContext<DownloadManagerValue | null>(null)

const TERMINAL: JobStatus[] = ['done', 'failed', 'cancelled', 'expired']

export function DownloadManagerProvider({
  children,
  onJobDone,
}: {
  children: ReactNode
  onJobDone?: (job: TrackedJob) => void
}) {
  const [jobsById, setJobsById] = useState<Record<number, TrackedJob>>({})
  const [order, setOrder] = useState<number[]>([])
  const [isOpen, setOpen] = useState(false)
  const unsubscribers = useRef<Record<number, () => void>>({})
  const { showToast } = useToast()

  const patchJob = useCallback((id: number, patch: Partial<TrackedJob>) => {
    setJobsById((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev))
  }, [])

  const trackJob = useCallback(
    (job: { id: number; url: string; title: string; mode: api.DownloadMode; position: number }) => {
      setJobsById((prev) => ({
        ...prev,
        [job.id]: {
          id: job.id,
          url: job.url,
          title: job.title,
          mode: job.mode,
          status: job.position > 0 ? 'queued' : 'downloading',
          position: job.position,
          createdAt: Date.now(),
        },
      }))
      setOrder((prev) => [job.id, ...prev.filter((id) => id !== job.id)])

      unsubscribers.current[job.id]?.()
      unsubscribers.current[job.id] = subscribeDownloadEvents(job.id, (event) => {
        switch (event.event) {
          case 'queued':
            patchJob(job.id, {
              status: 'queued',
              position: event.data.position,
              estimatedWaitSeconds: event.data.estimated_wait_seconds,
            })
            break
          case 'downloading':
            patchJob(job.id, { status: 'downloading' })
            break
          case 'progress':
            patchJob(job.id, {
              status: 'downloading',
              downloadedBytes: event.data.downloaded_bytes,
              totalBytes: event.data.total_bytes,
              speed: event.data.speed,
              eta: event.data.eta,
            })
            break
          case 'processing':
            patchJob(job.id, { status: 'processing', step: event.data.step })
            break
          case 'done': {
            const doneAt = Date.now()
            patchJob(job.id, {
              status: 'done',
              filename: event.data.filename,
              sizeBytes: event.data.size_bytes,
              fileUrl: event.data.file_url,
              doneAt,
            })
            onJobDone?.({
              id: job.id,
              url: job.url,
              title: job.title,
              mode: job.mode,
              status: 'done',
              filename: event.data.filename,
              sizeBytes: event.data.size_bytes,
              fileUrl: event.data.file_url,
              createdAt: doneAt,
              doneAt,
            })
            break
          }
          case 'failed':
            patchJob(job.id, { status: 'failed', errorMessage: event.data.message })
            break
          case 'cancelled':
            patchJob(job.id, { status: 'cancelled' })
            break
          case 'expired':
            patchJob(job.id, { status: 'expired' })
            break
        }
      })
    },
    [patchJob, onJobDone],
  )

  const cancelJob = useCallback(
    async (id: number) => {
      try {
        await api.cancelDownload(id)
      } catch (err) {
        showToast(err instanceof api.ApiError ? err.message : "Impossible d'annuler ce téléchargement.", 'error')
      }
    },
    [showToast],
  )

  const removeJob = useCallback((id: number) => {
    unsubscribers.current[id]?.()
    delete unsubscribers.current[id]
    setOrder((prev) => prev.filter((jobId) => jobId !== id))
    setJobsById((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const jobs = order.map((id) => jobsById[id]).filter((j): j is TrackedJob => Boolean(j))

  return (
    <DownloadManagerContext.Provider value={{ jobs, trackJob, cancelJob, removeJob, isOpen, setOpen }}>
      {children}
    </DownloadManagerContext.Provider>
  )
}

export function useDownloadManager(): DownloadManagerValue {
  const ctx = useContext(DownloadManagerContext)
  if (!ctx) throw new Error('useDownloadManager doit être utilisé dans <DownloadManagerProvider>')
  return ctx
}

export function isTerminalStatus(status: JobStatus): boolean {
  return TERMINAL.includes(status)
}
