import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { useDownloadManager } from '../lib/DownloadManagerContext'
import { useToast } from '../lib/ToastContext'
import { formatBytes, localeTag } from '../lib/format'
import { useLanguage } from '../lib/i18n/LanguageContext'
import './HistoryPage.css'

export function HistoryPage() {
  const [items, setItems] = useState<api.HistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const manager = useDownloadManager()
  const { showToast } = useToast()
  const { t } = useLanguage()
  const STATUS_LABEL: Record<string, string> = t.history.status

  useEffect(() => {
    api
      .getHistory()
      .then((res) => setItems(res.items))
      .catch(() => setError(t.history.loadError))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showToast(t.history.queuedToast, 'success')
    } catch (err) {
      showToast(err instanceof api.ApiError ? err.message : t.common.genericError, 'error')
    }
  }

  return (
    <div className="history-page">
      <h1 className="history-page__title">{t.history.title}</h1>
      {error && <p className="history-page__error">{error}</p>}
      {items && items.length === 0 && <p className="history-page__empty">{t.history.empty}</p>}
      {items && items.length > 0 && (
        <ul className="history-page__list">
          {items.map((item) => (
            <li key={item.id} className="history-page__row">
              <div className="history-page__row-info">
                <span className="history-page__row-title">{item.filename ?? item.url}</span>
                <span className="history-page__row-meta">
                  {item.site ?? t.history.unknownSite} · {formatBytes(item.size_bytes)} ·{' '}
                  {new Date(item.created_at).toLocaleString(localeTag())} · {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>
              <button type="button" className="history-page__retry" onClick={() => retelecharger(item)}>
                {t.history.retry}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
