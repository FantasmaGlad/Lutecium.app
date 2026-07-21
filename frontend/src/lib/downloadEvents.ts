export type DownloadEvent =
  | { event: 'queued'; data: { position: number; estimated_wait_seconds: number | null } }
  | { event: 'downloading'; data: Record<string, never> }
  | {
      event: 'progress'
      data: { downloaded_bytes: number | null; total_bytes: number | null; speed: number | null; eta: number | null }
    }
  | { event: 'processing'; data: { step: string } }
  | { event: 'done'; data: { filename: string; size_bytes: number; file_url: string } }
  | { event: 'failed'; data: { message: string } }
  | { event: 'cancelled'; data: Record<string, never> }
  | { event: 'expired'; data: Record<string, never> }

const TERMINAL_EVENTS = new Set(['done', 'failed', 'cancelled', 'expired'])

/**
 * EventSource natif (F-21) : le navigateur reconnecte seul sur coupure ; un client qui se
 * reconnecte reçoit d'abord l'état courant (comportement du serveur, cf. PLAN §3).
 */
export function subscribeDownloadEvents(jobId: number, onEvent: (event: DownloadEvent) => void): () => void {
  const source = new EventSource(`/api/downloads/${jobId}/events`)
  const handlers: Array<[string, (e: MessageEvent) => void]> = []

  for (const name of ['queued', 'downloading', 'progress', 'processing', 'done', 'failed', 'cancelled', 'expired']) {
    const handler = (e: MessageEvent) => {
      const data = e.data ? JSON.parse(e.data) : {}
      onEvent({ event: name, data } as DownloadEvent)
      if (TERMINAL_EVENTS.has(name)) source.close()
    }
    source.addEventListener(name, handler)
    handlers.push([name, handler])
  }

  return () => {
    for (const [name, handler] of handlers) source.removeEventListener(name, handler)
    source.close()
  }
}
