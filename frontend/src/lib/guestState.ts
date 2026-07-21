const KEY = 'lutecium:guest-used'

export function hasUsedGuestDownload(): boolean {
  return localStorage.getItem(KEY) === '1'
}

export function markGuestDownloadUsed(): void {
  localStorage.setItem(KEY, '1')
}
