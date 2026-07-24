export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  // `bytes` est un compte entier dans la plupart des appels, mais peut être un débit calculé
  // (ex. octets/s, cf. AdminSystemPage) — toujours arrondir plutôt que d'afficher les décimales
  // flottantes brutes.
  if (bytes < 1024) return `${Math.round(bytes)} o`
  const units = ['Ko', 'Mo', 'Go', 'To']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[i]}`
}

export function formatSpeed(bytesPerSecond: number | null | undefined): string {
  if (bytesPerSecond == null || Number.isNaN(bytesPerSecond)) return '—'
  return `${formatBytes(bytesPerSecond)}/s`
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '—'
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function formatEtaApprox(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return ''
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return '~1 min'
  return `~${Math.round(s / 60)} min`
}
