import type { TrackedJob } from '../../lib/DownloadManagerContext'
import { formatBytes, formatEtaApprox, formatSpeed } from '../../lib/format'
import './ProgressCard.css'

interface ProgressCardProps {
  job: TrackedJob
  onCancel: () => void
}

export function ProgressCard({ job, onCancel }: ProgressCardProps) {
  const pct =
    job.totalBytes && job.downloadedBytes != null
      ? Math.min(100, Math.round((job.downloadedBytes / job.totalBytes) * 100))
      : null

  return (
    <div className="progress-card" aria-live="polite">
      <p className="progress-card__title">{job.title}</p>

      {job.status === 'queued' && (
        <p className="progress-card__line">
          position n°{job.position} dans la file
          {job.estimatedWaitSeconds != null && ` · ${formatEtaApprox(job.estimatedWaitSeconds)}`}
        </p>
      )}

      {job.status === 'downloading' && (
        <>
          <div className="progress-card__bar-track">
            <div
              className="progress-card__bar-fill"
              style={{ width: pct != null ? `${pct}%` : '30%' }}
              data-indeterminate={pct == null || undefined}
            />
          </div>
          <p className="progress-card__stats">
            {pct != null ? `${pct}%` : '…'} · {formatBytes(job.downloadedBytes)} / {formatBytes(job.totalBytes)} ·{' '}
            {formatSpeed(job.speed)}
            {job.eta != null && ` · ${formatEtaApprox(job.eta)}`}
          </p>
        </>
      )}

      {job.status === 'processing' && <p className="progress-card__line">{job.step || 'traitement…'}</p>}

      <button type="button" className="progress-card__cancel" onClick={onCancel}>
        Annuler
      </button>
    </div>
  )
}
