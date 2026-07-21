import { useEffect, useState } from 'react'
import * as adminApi from '../../lib/adminApi'
import { formatBytes } from '../../lib/format'
import { BarChart, StatTile } from './AdminWidgets'
import './AdminOverviewPage.css'

export function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<adminApi.MetricsSnapshot | null>(null)

  useEffect(() => {
    adminApi.getMetrics().then(setMetrics)
    return adminApi.subscribeAdminStream<adminApi.MetricsSnapshot>('metrics', setMetrics)
  }, [])

  if (!metrics) return <p className="admin-overview__loading">Chargement…</p>

  return (
    <div className="admin-overview">
      <h1 className="admin-overview__title">Vue d'ensemble</h1>

      <div className="admin-overview__tiles">
        <StatTile label="téléchargements aujourd'hui" value={String(metrics.downloads_today)} />
        <StatTile label="volume total servi" value={formatBytes(metrics.total_volume_bytes)} />
        <StatTile label="utilisateurs actifs (jour)" value={String(metrics.active_users_today)} />
        <StatTile label="tâches en file" value={String(metrics.queue.length)} />
        <StatTile label="taux d'erreur" value={`${Math.round(metrics.error_rate * 100)}%`} />
      </div>

      <section className="admin-overview__section">
        <h2>Téléchargements (7 jours)</h2>
        <BarChart data={metrics.downloads_per_day} />
      </section>

      <section className="admin-overview__section">
        <h2>Top sites</h2>
        <ul className="admin-overview__list">
          {metrics.top_sites.map((s) => (
            <li key={s.site}>
              {s.site} <span>{s.count}</span>
            </li>
          ))}
          {metrics.top_sites.length === 0 && <li className="admin-overview__empty">Aucune donnée.</li>}
        </ul>
      </section>

      <section className="admin-overview__section">
        <h2>File d'attente en direct</h2>
        <ul className="admin-overview__list">
          {metrics.queue.map((job) => (
            <li key={job.id}>
              #{job.id} {job.site ?? 'site inconnu'} <span>{job.status}</span>
            </li>
          ))}
          {metrics.queue.length === 0 && <li className="admin-overview__empty">File vide.</li>}
        </ul>
      </section>
    </div>
  )
}
