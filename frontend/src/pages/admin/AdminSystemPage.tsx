import { useEffect, useState } from 'react'
import * as adminApi from '../../lib/adminApi'
import { formatBytes } from '../../lib/format'
import { ErrorBanner, Gauge } from './AdminWidgets'
import './AdminSystemPage.css'

const DISK_ALERT_THRESHOLD_PERCENT = 90
// M-01 vise une maj nightly (24h) ; marge de sécurité avant d'afficher une alerte de fraîcheur.
const YTDLP_STALE_THRESHOLD_HOURS = 36

export function AdminSystemPage() {
  const [system, setSystem] = useState<adminApi.SystemSnapshot | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi
      .getSystem()
      .then(setSystem)
      .catch((err) => setError(err instanceof Error ? err.message : 'Une erreur est survenue.'))
    return adminApi.subscribeAdminStream<adminApi.SystemSnapshot>('system', (data) => {
      setSystem(data)
      setError(null)
    })
  }, [])

  async function runAction(action: string, label: string) {
    if (!window.confirm(`${label} ?`)) return
    setBusy(action)
    try {
      const res = await adminApi.runAction(action)
      setActionMessage(res.message)
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setBusy(null)
    }
  }

  if (!system && error) return <ErrorBanner message={error} />
  if (!system) return <p className="admin-system__loading">Chargement…</p>

  const ramPct = (system.ram_used_bytes / system.ram_total_bytes) * 100
  const diskPct = (system.disk_used_bytes / system.disk_total_bytes) * 100
  const diskAlert = diskPct >= DISK_ALERT_THRESHOLD_PERCENT

  const lastUpdateHoursAgo = system.yt_dlp_last_update_at
    ? (Date.now() - new Date(system.yt_dlp_last_update_at).getTime()) / 3_600_000
    : null
  const ytdlpStale = lastUpdateHoursAgo == null || lastUpdateHoursAgo > YTDLP_STALE_THRESHOLD_HOURS

  return (
    <div className="admin-system">
      <h1 className="admin-system__title">Système</h1>

      {error && <ErrorBanner message={error} />}

      {diskAlert && (
        <p className="admin-system__alert" role="alert">
          Espace disque critique : {Math.round(diskPct)}% utilisé.
        </p>
      )}

      <div className="admin-system__gauges">
        <Gauge label="CPU" percent={system.cpu_percent} />
        <Gauge label="RAM" percent={ramPct} />
        <Gauge label="Disque" percent={diskPct} danger={diskAlert} />
      </div>

      <ul className="admin-system__facts">
        <li>
          <span>Fréquence CPU</span>
          <span>{system.cpu_frequency_mhz ? `${Math.round(system.cpu_frequency_mhz)} MHz` : '—'}</span>
        </li>
        <li>
          <span>Température CPU</span>
          <span>{system.cpu_temperature_celsius != null ? `${system.cpu_temperature_celsius.toFixed(1)} °C` : '—'}</span>
        </li>
        <li>
          <span>RAM</span>
          <span>
            {formatBytes(system.ram_used_bytes)} / {formatBytes(system.ram_total_bytes)}
          </span>
        </li>
        <li>
          <span>Disque</span>
          <span>
            {formatBytes(system.disk_used_bytes)} / {formatBytes(system.disk_total_bytes)}
          </span>
        </li>
        <li>
          <span>Dossier téléchargements</span>
          <span>{formatBytes(system.downloads_dir_usage_bytes)}</span>
        </li>
        <li>
          <span>Disponible depuis</span>
          <span>{Math.round(system.uptime_seconds / 60)} min</span>
        </li>
        <li>
          <span>Version yt-dlp</span>
          <span>{system.yt_dlp_version}</span>
        </li>
        <li className={ytdlpStale ? 'admin-system__fact--stale' : undefined}>
          <span>Dernière maj yt-dlp</span>
          <span>
            {system.yt_dlp_last_update_at
              ? new Date(system.yt_dlp_last_update_at).toLocaleString('fr-FR')
              : 'jamais (image de build uniquement)'}
            {ytdlpStale && ' · à vérifier'}
          </span>
        </li>
      </ul>

      <div className="admin-system__actions">
        <button type="button" disabled={busy !== null} onClick={() => runAction('update-ytdlp', 'Mettre à jour yt-dlp maintenant')}>
          Mettre à jour yt-dlp
        </button>
        <button type="button" disabled={busy !== null} onClick={() => runAction('purge-downloads', 'Purger les fichiers terminés/orphelins')}>
          Purger les fichiers
        </button>
        <button type="button" disabled={busy !== null} onClick={() => runAction('clear-queue', 'Vider la file (annule les tâches en attente et en cours)')}>
          Vider la file
        </button>
      </div>

      {actionMessage && <p className="admin-system__message">{actionMessage}</p>}
    </div>
  )
}
