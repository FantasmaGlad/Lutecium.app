import { AnimatePresence, motion } from 'framer-motion'
import * as api from '../lib/api'
import { useDownloadManager, isTerminalStatus, type TrackedJob } from '../lib/DownloadManagerContext'
import { formatBytes, formatEtaApprox } from '../lib/format'
import './DownloadManagerDrawer.css'

const STATUS_LABEL: Record<TrackedJob['status'], string> = {
  queued: 'en file',
  downloading: 'téléchargement',
  processing: 'traitement',
  done: 'prêt',
  failed: 'échoué',
  cancelled: 'annulé',
  expired: 'expiré',
}

export function DownloadManagerDrawer() {
  const manager = useDownloadManager()

  if (manager.jobs.length === 0) return null

  const activeCount = manager.jobs.filter((j) => !isTerminalStatus(j.status)).length

  async function retryJob(job: TrackedJob) {
    manager.removeJob(job.id)
    const response = await api.createDownload({ url: job.url, mode: job.mode })
    manager.trackJob({ id: response.id, url: job.url, title: job.title, mode: job.mode, position: response.position })
  }

  return (
    <div className="dl-manager">
      <button
        type="button"
        className="dl-manager__bar"
        onClick={() => manager.setOpen(!manager.isOpen)}
        aria-expanded={manager.isOpen}
      >
        <span>Téléchargements</span>
        {activeCount > 0 && <span className="dl-manager__badge">{activeCount}</span>}
      </button>
      <AnimatePresence>
        {manager.isOpen && (
          <motion.ul
            className="dl-manager__list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AnimatePresence initial={false}>
              {manager.jobs.map((job) => (
                <motion.li
                  key={job.id}
                  className="dl-manager__row"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="dl-manager__row-info">
                    <span className="dl-manager__row-title">{job.title}</span>
                    <span className="dl-manager__row-status">
                      {STATUS_LABEL[job.status]}
                      {job.status === 'queued' && job.position != null && ` · n°${job.position}`}
                      {job.status === 'downloading' &&
                        job.totalBytes &&
                        job.downloadedBytes != null &&
                        ` · ${Math.round((job.downloadedBytes / job.totalBytes) * 100)}%`}
                      {job.status === 'queued' &&
                        job.estimatedWaitSeconds != null &&
                        ` · ${formatEtaApprox(job.estimatedWaitSeconds)}`}
                      {job.status === 'done' && job.sizeBytes != null && ` · ${formatBytes(job.sizeBytes)}`}
                      {job.status === 'failed' && job.errorMessage && ` · ${job.errorMessage}`}
                    </span>
                  </div>
                  <div className="dl-manager__row-actions">
                    {job.status === 'done' && job.fileUrl && (
                      <a href={job.fileUrl} download={job.filename} className="dl-manager__row-action">
                        enregistrer
                      </a>
                    )}
                    {(job.status === 'queued' || job.status === 'downloading' || job.status === 'processing') && (
                      <button
                        type="button"
                        className="dl-manager__row-action"
                        onClick={() => manager.cancelJob(job.id)}
                      >
                        annuler
                      </button>
                    )}
                    {job.status === 'failed' && (
                      <button type="button" className="dl-manager__row-action" onClick={() => retryJob(job)}>
                        réessayer
                      </button>
                    )}
                    {isTerminalStatus(job.status) && (
                      <button
                        type="button"
                        className="dl-manager__row-action"
                        onClick={() => manager.removeJob(job.id)}
                      >
                        retirer
                      </button>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
