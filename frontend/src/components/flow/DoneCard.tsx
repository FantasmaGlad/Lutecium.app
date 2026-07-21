import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { TrackedJob } from '../../lib/DownloadManagerContext'
import { formatBytes } from '../../lib/format'
import './DoneCard.css'

const FILE_TTL_SECONDS = 5 * 60

interface DoneCardProps {
  job: TrackedJob
  onRestart: () => void
  guestInvite?: ReactNode
}

export function DoneCard({ job, onRestart, guestInvite }: DoneCardProps) {
  const [remaining, setRemaining] = useState(FILE_TTL_SECONDS)

  useEffect(() => {
    if (!job.doneAt) return
    const tick = () => {
      const elapsed = Math.floor((Date.now() - job.doneAt!) / 1000)
      setRemaining(Math.max(0, FILE_TTL_SECONDS - elapsed))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [job.doneAt])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const expired = remaining <= 0

  return (
    <motion.div
      className="done-card"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="done-card__check" aria-hidden="true">
        ✓
      </div>
      {/* Annoncé une seule fois aux lecteurs d'écran ; le compte à rebours ci-dessous ne l'est pas
          (aria-live sur une valeur qui change chaque seconde serait bruyant, cf. UI §11). */}
      <p className="done-card__sr-status" role="status">
        {expired ? 'Ce fichier n’est plus disponible.' : 'Ton fichier est prêt.'}
      </p>
      {expired ? (
        <p className="done-card__expired" aria-hidden="true">
          Ce fichier n'est plus disponible.
        </p>
      ) : (
        <>
          <a className="done-card__save" href={job.fileUrl} download={job.filename}>
            Enregistrer le fichier
          </a>
          <p className="done-card__meta">
            {job.filename} · {formatBytes(job.sizeBytes)}
          </p>
          <p className="done-card__countdown">
            disponible encore {minutes}:{String(seconds).padStart(2, '0')}
          </p>
        </>
      )}
      {guestInvite}
      <button type="button" className="done-card__restart" onClick={onRestart}>
        télécharger autre chose
      </button>
    </motion.div>
  )
}
