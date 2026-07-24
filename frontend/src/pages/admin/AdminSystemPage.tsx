import { useEffect, useState } from 'react'
import * as adminApi from '../../lib/adminApi'
import { formatBytes, formatSpeed } from '../../lib/format'
import { ErrorBanner, Gauge, LineChart, type HistoryPoint } from './AdminWidgets'
import './AdminSystemPage.css'

const DISK_ALERT_THRESHOLD_PERCENT = 90
// M-01 vise une maj nightly (24h) ; marge de sécurité avant d'afficher une alerte de fraîcheur.
const YTDLP_STALE_THRESHOLD_HOURS = 36
const HISTORY_RANGES = [
  { label: '24 h', hours: 24 },
  { label: '7 j', hours: 24 * 7 },
] as const

export function AdminSystemPage() {
  const [system, setSystem] = useState<adminApi.SystemSnapshot | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historyHours, setHistoryHours] = useState<number>(HISTORY_RANGES[0].hours)
  const [history, setHistory] = useState<adminApi.SystemMetricPoint[]>([])

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

  useEffect(() => {
    let cancelled = false
    function load() {
      adminApi
        .getSystemHistory(historyHours)
        .then((points) => {
          if (!cancelled) setHistory(points)
        })
        .catch(() => {
          // Non bloquant : les graphiques restent vides plutôt que de casser la page (les
          // jauges/faits en direct au-dessus restent la source d'information principale).
        })
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [historyHours])

  const toSeries = (pick: (p: adminApi.SystemMetricPoint) => number | null): HistoryPoint[] =>
    history.map((p) => ({ t: new Date(p.recorded_at).getTime(), v: pick(p) }))

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
          <span>Consommation</span>
          <span>
            {system.power_watts != null
              ? `${system.power_watts.toFixed(1)} W`
              : 'indisponible (accès root requis, non accordé au conteneur)'}
          </span>
        </li>
        <li>
          <span>Réseau (service)</span>
          <span>
            {system.net_rx_bytes_per_sec != null || system.net_tx_bytes_per_sec != null
              ? `↓ ${formatSpeed(system.net_rx_bytes_per_sec)} · ↑ ${formatSpeed(system.net_tx_bytes_per_sec)}`
              : '—'}
          </span>
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

      <div className="admin-system__history">
        <div className="admin-system__history-header">
          <h2 className="admin-system__history-title">Évolution</h2>
          <div className="admin-system__history-range">
            {HISTORY_RANGES.map((range) => (
              <button
                key={range.hours}
                type="button"
                className={range.hours === historyHours ? 'is-active' : undefined}
                onClick={() => setHistoryHours(range.hours)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="admin-system__history-grid">
          <LineChart label="CPU" unit="%" points={toSeries((p) => p.cpu_percent)} />
          <LineChart label="RAM" unit="%" points={toSeries((p) => p.ram_percent)} />
          <LineChart label="Disque" unit="%" points={toSeries((p) => p.disk_percent)} />
          <LineChart label="Température" unit="°C" points={toSeries((p) => p.temperature_celsius)} color="error" />
          <LineChart label="Consommation" unit="W" points={toSeries((p) => p.power_watts)} color="success" />
          <LineChart
            label="Réseau ↓ (service)"
            unit=""
            formatValue={formatSpeed}
            points={toSeries((p) => p.net_rx_bytes_per_sec)}
          />
          <LineChart
            label="Réseau ↑ (service)"
            unit=""
            formatValue={formatSpeed}
            points={toSeries((p) => p.net_tx_bytes_per_sec)}
          />
        </div>
      </div>

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
