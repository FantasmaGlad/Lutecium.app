const KEY = 'lutecium:pending-url'

export function setPendingUrl(url: string): void {
  sessionStorage.setItem(KEY, url)
}

export function takePendingUrl(): string | null {
  const url = sessionStorage.getItem(KEY)
  if (url) sessionStorage.removeItem(KEY)
  return url
}
