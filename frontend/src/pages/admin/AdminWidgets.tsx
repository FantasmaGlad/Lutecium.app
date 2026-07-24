import { useEffect, useRef } from 'react'
import './AdminWidgets.css'

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="admin-error" role="alert">
      {message}
    </p>
  )
}

export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-tile">
      <span className="admin-tile__value">{value}</span>
      <span className="admin-tile__label">{label}</span>
    </div>
  )
}

export function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="admin-barchart">
      {data.map((d) => (
        <div key={d.date} className="admin-barchart__col">
          <div className="admin-barchart__bar" style={{ height: `${(d.count / max) * 100}%` }} />
          <span className="admin-barchart__label">{d.date.slice(5)}</span>
          <span className="admin-barchart__count">{d.count}</span>
        </div>
      ))}
    </div>
  )
}

export interface HistoryPoint {
  t: number // epoch ms
  v: number | null
}

/** Graphique d'évolution en `<canvas>` (demande explicite) : CPU/RAM/température/consommation/
 * réseau du dashboard admin dans le temps (A-12, UI §7.3). Couleurs résolues depuis les tokens
 * CSS au moment du tracé (canvas ne suit pas le cascade CSS) — redessiné au changement de thème. */
export function LineChart({
  label,
  unit,
  points,
  color = 'accent',
  formatValue,
}: {
  label: string
  unit: string
  points: HistoryPoint[]
  color?: 'accent' | 'success' | 'error'
  formatValue?: (v: number) => string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fmt = formatValue ?? ((v: number) => v.toFixed(1))
  const withUnit = (v: number) => (unit ? `${fmt(v)} ${unit}` : fmt(v))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function draw() {
      if (!canvas) return
      const fmtLocal = formatValue ?? ((v: number) => v.toFixed(1))
      const withUnitLocal = (v: number) => (unit ? `${fmtLocal(v)} ${unit}` : fmtLocal(v))
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const w = rect.width
      const h = rect.height
      ctx.clearRect(0, 0, w, h)

      const valid = points.filter((p): p is { t: number; v: number } => p.v != null)
      if (valid.length === 0) return

      const style = getComputedStyle(document.documentElement)
      const colorVar = color === 'success' ? '--color-success' : color === 'error' ? '--color-error' : '--color-accent'
      const lineColor = style.getPropertyValue(colorVar).trim() || '#ffffff'
      const gridColor = style.getPropertyValue('--color-surface-alt').trim() || '#4a4a4a'
      const textColor = style.getPropertyValue('--color-text-secondary').trim() || '#a1a1a1'

      const minV = Math.min(...valid.map((p) => p.v))
      const maxV = Math.max(...valid.map((p) => p.v))
      const spanV = maxV - minV || 1
      const minT = points[0].t
      const maxT = points[points.length - 1].t
      const spanT = maxT - minT || 1

      const padTop = 14
      const padBottom = 4
      const padX = 2
      const plotW = w - padX * 2
      const plotH = h - padTop - padBottom
      const xFor = (t: number) => padX + ((t - minT) / spanT) * plotW
      const yFor = (v: number) => padTop + plotH - ((v - minV) / spanV) * plotH

      ctx.strokeStyle = gridColor
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      for (let i = 0; i <= 2; i++) {
        const y = padTop + (plotH / 2) * i
        ctx.beginPath()
        ctx.moveTo(padX, y)
        ctx.lineTo(w - padX, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      let drawing = false
      ctx.beginPath()
      for (const p of points) {
        if (p.v == null) {
          drawing = false
          continue
        }
        const x = xFor(p.t)
        const y = yFor(p.v)
        if (!drawing) {
          ctx.moveTo(x, y)
          drawing = true
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      ctx.fillStyle = textColor
      ctx.font = "10px 'JetBrains Mono', ui-monospace, monospace"
      ctx.textBaseline = 'top'
      ctx.fillText(withUnitLocal(maxV), padX, 0)
      ctx.textBaseline = 'bottom'
      ctx.fillText(withUnitLocal(minV), padX, h)
    }

    draw()
    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(canvas)
    const themeObserver = new MutationObserver(draw)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      resizeObserver.disconnect()
      themeObserver.disconnect()
    }
  }, [points, color, unit, formatValue])

  const values = points.map((p) => p.v).filter((v): v is number => v != null)
  const hasData = values.length > 0

  return (
    <div className="history-chart">
      <div className="history-chart__header">
        <span className="history-chart__label">{label}</span>
        {hasData && <span className="history-chart__latest">{withUnit(values[values.length - 1])}</span>}
      </div>
      {hasData ? (
        <canvas ref={canvasRef} className="history-chart__canvas" />
      ) : (
        <p className="history-chart__empty">Pas encore de données (premier échantillon dans quelques minutes).</p>
      )}
    </div>
  )
}

export function Gauge({ label, percent, danger }: { label: string; percent: number; danger?: boolean }) {
  const clamped = Math.min(100, Math.max(0, percent))
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="admin-gauge">
      <svg viewBox="0 0 100 100" width="88" height="88">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-surface-alt)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={danger ? 'var(--color-error)' : 'var(--color-accent)'}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" fontSize="18" fill="var(--color-text)" fontFamily="var(--font-mono)">
          {Math.round(clamped)}%
        </text>
      </svg>
      <span className="admin-gauge__label">{label}</span>
    </div>
  )
}
