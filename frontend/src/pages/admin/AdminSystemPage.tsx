import { useEffect, useState } from 'react'
import * as adminApi from '../../lib/adminApi'
import { formatBytes } from '../../lib/format'
import { Gauge } from './AdminWidgets'
import './AdminSystemPage.css'

const DISK_ALERT_THRESHOLD_PERCENT = 90

export function AdminSystemPage() {
  const [system, setSystem] = useState<adminApi.SystemSnapshot | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    adminApi.getSystem().then(setSystem)
    return adminApi.subscribeAdminStream<adminApi.SystemSnapshot>('system', setSystem)
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

  if (!system) return <p className="admin-system__loading">Chargement…</p>

  const ramPct = (system.ram_used_bytes / system.ram_total_bytes) * 100
  const diskPct = (system.disk_used_bytes / system.disk_total_bytes) * 100
  const diskAlert = diskPct >= DISK_ALERT_THRESHOLD_PERCENT

  return (
    <div className="admin-system">
      <h1 className="admin-system__title">Système</h1>

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
