export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // installabilité dégradée sans SW, le site reste utilisable normalement
      })
    })
  }
}

/** Share target Android (CDC UI §8) : `?url=` ou `?text=` contenant un lien. */
export function takeSharedUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const shared = params.get('url') || params.get('text')
  if (!shared) return null
  window.history.replaceState(null, '', window.location.pathname)
  try {
    const match = shared.match(/https?:\/\/\S+/)
    return match ? match[0] : null
  } catch {
    return null
  }
}
