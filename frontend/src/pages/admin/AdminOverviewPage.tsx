import { useEffect, useState } from 'react'
import * as adminApi from '../../lib/adminApi'
import { formatBytes } from '../../lib/format'
import { useLanguage } from '../../lib/i18n/LanguageContext'
import { BarChart, ErrorBanner, StatTile } from './AdminWidgets'
import './AdminOverviewPage.css'

export function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<adminApi.MetricsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    adminApi
      .getMetrics()
      .then(setMetrics)
      .catch((err) => setError(err instanceof Error ? err.message : t.common.genericError))
    return adminApi.subscribeAdminStream<adminApi.MetricsSnapshot>('metrics', (data) => {
      setMetrics(data)
      setError(null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!metrics && error) return <ErrorBanner message={error} />
  if (!metrics) return <p className="admin-overview__loading">{t.common.loading}</p>

  return (
    <div className="admin-overview">
      <h1 className="admin-overview__title">{t.admin.overview.title}</h1>
      {error && <ErrorBanner message={error} />}

      <div className="admin-overview__tiles">
        <StatTile label={t.admin.overview.downloadsToday} value={String(metrics.downloads_today)} />
        <StatTile label={t.admin.overview.totalVolume} value={formatBytes(metrics.total_volume_bytes)} />
        <StatTile label={t.admin.overview.activeUsers} value={String(metrics.active_users_today)} />
        <StatTile label={t.admin.overview.queuedTasks} value={String(metrics.queue.length)} />
        <StatTile label={t.admin.overview.errorRate} value={`${Math.round(metrics.error_rate * 100)}%`} />
      </div>

      <section className="admin-overview__section">
        <h2>{t.admin.overview.downloads7d}</h2>
        <BarChart data={metrics.downloads_per_day} />
      </section>

      <section className="admin-overview__section">
        <h2>{t.admin.overview.topSites}</h2>
        <ul className="admin-overview__list">
          {metrics.top_sites.map((s) => (
            <li key={s.site}>
              {s.site} <span>{s.count}</span>
            </li>
          ))}
          {metrics.top_sites.length === 0 && <li className="admin-overview__empty">{t.admin.overview.noData}</li>}
        </ul>
      </section>

      <section className="admin-overview__section">
        <h2>{t.admin.overview.liveQueue}</h2>
        <ul className="admin-overview__list">
          {metrics.queue.map((job) => (
            <li key={job.id}>
              #{job.id} {job.site ?? t.admin.overview.unknownSite} <span>{job.status}</span>
            </li>
          ))}
          {metrics.queue.length === 0 && <li className="admin-overview__empty">{t.admin.overview.emptyQueue}</li>}
        </ul>
      </section>
    </div>
  )
}
