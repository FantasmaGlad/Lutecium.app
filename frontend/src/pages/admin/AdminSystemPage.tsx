import { useEffect, useState } from 'react'
import * as adminApi from '../../lib/adminApi'
import { formatBytes, formatSpeed, localeTag } from '../../lib/format'
import { useLanguage } from '../../lib/i18n/LanguageContext'
import { ErrorBanner, Gauge, LineChart, type HistoryPoint } from './AdminWidgets'
import './AdminSystemPage.css'

const DISK_ALERT_THRESHOLD_PERCENT = 90
// M-01 vise une maj nightly (24h) ; marge de sécurité avant d'afficher une alerte de fraîcheur.
const YTDLP_STALE_THRESHOLD_HOURS = 36

export function AdminSystemPage() {
  const { t } = useLanguage()
  const HISTORY_RANGES = [
    { label: t.admin.system.range24h, hours: 24 },
    { label: t.admin.system.range7d, hours: 24 * 7 },
  ] as const
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
      .catch((err) => setError(err instanceof Error ? err.message : t.common.genericError))
    return adminApi.subscribeAdminStream<adminApi.SystemSnapshot>('system', (data) => {
      setSystem(data)
      setError(null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function runAction(action: string, confirmMessage: string) {
    if (!window.confirm(confirmMessage)) return
    setBusy(action)
    try {
      const res = await adminApi.runAction(action)
      setActionMessage(res.message)
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : t.common.genericError)
    } finally {
      setBusy(null)
    }
  }

  if (!system && error) return <ErrorBanner message={error} />
  if (!system) return <p className="admin-system__loading">{t.common.loading}</p>

  const ramPct = (system.ram_used_bytes / system.ram_total_bytes) * 100
  const diskPct = (system.disk_used_bytes / system.disk_total_bytes) * 100
  const diskAlert = diskPct >= DISK_ALERT_THRESHOLD_PERCENT

  const lastUpdateHoursAgo = system.yt_dlp_last_update_at
    ? (Date.now() - new Date(system.yt_dlp_last_update_at).getTime()) / 3_600_000
    : null
  const ytdlpStale = lastUpdateHoursAgo == null || lastUpdateHoursAgo > YTDLP_STALE_THRESHOLD_HOURS

  return (
    <div className="admin-system">
      <h1 className="admin-system__title">{t.admin.system.title}</h1>

      {error && <ErrorBanner message={error} />}

      {diskAlert && (
        <p className="admin-system__alert" role="alert">
          {t.admin.system.diskCritical(Math.round(diskPct))}
        </p>
      )}

      <div className="admin-system__gauges">
        <Gauge label="CPU" percent={system.cpu_percent} />
        <Gauge label="RAM" percent={ramPct} />
        <Gauge label={t.admin.system.disk} percent={diskPct} danger={diskAlert} />
      </div>

      <ul className="admin-system__facts">
        <li>
          <span>{t.admin.system.cpuFrequency}</span>
          <span>{system.cpu_frequency_mhz ? `${Math.round(system.cpu_frequency_mhz)} MHz` : '—'}</span>
        </li>
        <li>
          <span>{t.admin.system.cpuTemperature}</span>
          <span>{system.cpu_temperature_celsius != null ? `${system.cpu_temperature_celsius.toFixed(1)} °C` : '—'}</span>
        </li>
        <li>
          <span>{t.admin.system.power}</span>
          <span>
            {system.power_watts != null ? `${system.power_watts.toFixed(1)} W` : t.admin.system.powerUnavailable}
          </span>
        </li>
        <li>
          <span>{t.admin.system.network}</span>
          <span>
            {system.net_rx_bytes_per_sec != null || system.net_tx_bytes_per_sec != null
              ? `↓ ${formatSpeed(system.net_rx_bytes_per_sec)} · ↑ ${formatSpeed(system.net_tx_bytes_per_sec)}`
              : '—'}
          </span>
        </li>
        <li>
          <span>{t.admin.system.ram}</span>
          <span>
            {formatBytes(system.ram_used_bytes)} / {formatBytes(system.ram_total_bytes)}
          </span>
        </li>
        <li>
          <span>{t.admin.system.disk}</span>
          <span>
            {formatBytes(system.disk_used_bytes)} / {formatBytes(system.disk_total_bytes)}
          </span>
        </li>
        <li>
          <span>{t.admin.system.downloadsDir}</span>
          <span>{formatBytes(system.downloads_dir_usage_bytes)}</span>
        </li>
        <li>
          <span>{t.admin.system.uptime}</span>
          <span>{Math.round(system.uptime_seconds / 60)} {t.common.min}</span>
        </li>
        <li>
          <span>{t.admin.system.ytdlpVersion}</span>
          <span>{system.yt_dlp_version}</span>
        </li>
        <li className={ytdlpStale ? 'admin-system__fact--stale' : undefined}>
          <span>{t.admin.system.ytdlpLastUpdate}</span>
          <span>
            {system.yt_dlp_last_update_at
              ? new Date(system.yt_dlp_last_update_at).toLocaleString(localeTag())
              : t.admin.system.ytdlpNever}
            {ytdlpStale && ` · ${t.admin.system.ytdlpToCheck}`}
          </span>
        </li>
      </ul>

      <div className="admin-system__history">
        <div className="admin-system__history-header">
          <h2 className="admin-system__history-title">{t.admin.system.evolution}</h2>
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
          <LineChart label={t.admin.system.chartCpu} unit="%" points={toSeries((p) => p.cpu_percent)} />
          <LineChart label={t.admin.system.chartRam} unit="%" points={toSeries((p) => p.ram_percent)} />
          <LineChart label={t.admin.system.chartDisk} unit="%" points={toSeries((p) => p.disk_percent)} />
          <LineChart
            label={t.admin.system.chartTemperature}
            unit="°C"
            points={toSeries((p) => p.temperature_celsius)}
            color="error"
          />
          <LineChart
            label={t.admin.system.chartPower}
            unit="W"
            points={toSeries((p) => p.power_watts)}
            color="success"
          />
          <LineChart
            label={t.admin.system.chartNetDown}
            unit=""
            formatValue={formatSpeed}
            points={toSeries((p) => p.net_rx_bytes_per_sec)}
          />
          <LineChart
            label={t.admin.system.chartNetUp}
            unit=""
            formatValue={formatSpeed}
            points={toSeries((p) => p.net_tx_bytes_per_sec)}
          />
        </div>
      </div>

      <div className="admin-system__actions">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runAction('update-ytdlp', t.admin.system.updateYtdlpConfirm)}
        >
          {t.admin.system.updateYtdlp}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runAction('purge-downloads', t.admin.system.purgeFilesConfirm)}
        >
          {t.admin.system.purgeFiles}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runAction('clear-queue', t.admin.system.clearQueueConfirm)}
        >
          {t.admin.system.clearQueue}
        </button>
      </div>

      {actionMessage && <p className="admin-system__message">{actionMessage}</p>}
    </div>
  )
}
