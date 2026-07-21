import './AdminWidgets.css'

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
