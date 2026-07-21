import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { useDownloadManager } from '../lib/DownloadManagerContext'
import { useToast } from '../lib/ToastContext'
import { formatBytes } from '../lib/format'
import './HistoryPage.css'

const STATUS_LABEL: Record<string, string> = {
  queued: 'en file',
  downloading: 'téléchargement',
  processing: 'traitement',
  done: 'terminé',
  failed: 'échoué',
  cancelled: 'annulé',
  expired: 'expiré',
}

export function HistoryPage() {
  const [items, setItems] = useState<api.HistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const manager = useDownloadManager()
  const { showToast } = useToast()

  useEffect(() => {
    api
      .getHistory()
      .then((res) => setItems(res.items))
      .catch(() => setError("Impossible de charger l'historique."))
  }, [])

  async function retelecharger(item: api.HistoryItem) {
    try {
      const mode = (item.options.mode as api.DownloadMode) ?? 'video'
      const response = await api.createDownload({ url: item.url, mode })
      manager.trackJob({
        id: response.id,
        url: item.url,
        title: item.filename ?? item.url,
        mode,
        position: response.position,
      })
      manager.setOpen(true)
      showToast('Ajouté à la file de téléchargement.', 'success')
    } catch (err) {
      showToast(err instanceof api.ApiError ? err.message : 'Une erreur est survenue.', 'error')
    }
  }

  return (
    <div className="history-page">
      <h1 className="history-page__title">Mon historique</h1>
      {error && <p className="history-page__error">{error}</p>}
      {items && items.length === 0 && <p className="history-page__empty">Aucun téléchargement pour l'instant.</p>}
      {items && items.length > 0 && (
        <ul className="history-page__list">
          {items.map((item) => (
            <li key={item.id} className="history-page__row">
              <div className="history-page__row-info">
                <span className="history-page__row-title">{item.filename ?? item.url}</span>
                <span className="history-page__row-meta">
                  {item.site ?? 'site inconnu'} · {formatBytes(item.size_bytes)} ·{' '}
                  {new Date(item.created_at).toLocaleString('fr-FR')} · {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>
              <button type="button" className="history-page__retry" onClick={() => retelecharger(item)}>
                retélécharger
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
