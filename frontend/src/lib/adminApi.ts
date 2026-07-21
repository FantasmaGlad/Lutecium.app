async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    let message = 'Une erreur est survenue.'
    try {
      const body = await response.json()
      message = typeof body.detail === 'string' ? body.detail : message
    } catch {
      // corps non JSON
    }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export interface AdminUser {
  id: number
  pseudo: string
  role: string
  status: string
  created_at: string
  last_seen_at: string | null
  daily_quota_gb: number | null
  effective_daily_quota_bytes: number
  usage_today_bytes: number
  total_downloads: number
}

export function listUsers(): Promise<AdminUser[]> {
  return request('/users')
}

export function updateUser(id: number, patch: { status?: string; daily_quota_gb?: number | null }): Promise<AdminUser> {
  return request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export function deleteUser(id: number): Promise<{ ok: boolean }> {
  return request(`/users/${id}`, { method: 'DELETE' })
}

export function resetUserPassword(id: number): Promise<{ temporary_password: string }> {
  return request(`/users/${id}/reset-password`, { method: 'POST' })
}

export interface GuestSummary {
  ip_hash: string
  guest_cookie: string
  count: number
  created_at: string
}

export function listGuests(): Promise<GuestSummary[]> {
  return request('/guests')
}

export interface MetricsSnapshot {
  downloads_per_day: { date: string; count: number }[]
  top_sites: { site: string; count: number }[]
  error_rate: number
  total_volume_bytes: number
  queue: { id: number; site: string | null; status: string }[]
  downloads_today: number
  active_users_today: number
}

export function getMetrics(): Promise<MetricsSnapshot> {
  return request('/metrics')
}

export interface SystemSnapshot {
  cpu_percent: number
  cpu_frequency_mhz: number | null
  cpu_temperature_celsius: number | null
  ram_used_bytes: number
  ram_total_bytes: number
  disk_used_bytes: number
  disk_total_bytes: number
  downloads_dir_usage_bytes: number
  uptime_seconds: number
  yt_dlp_version: string
  yt_dlp_last_update_at: string | null
}

export function getSystem(): Promise<SystemSnapshot> {
  return request('/system')
}

export interface JournalEntry {
  id: number
  user_id: number | null
  site: string | null
  url: string
  size_bytes: number | null
  status: string
  error_message: string | null
  created_at: string
}

export function getJournal(status?: string): Promise<JournalEntry[]> {
  return request(`/journal${status ? `?status=${status}` : ''}`)
}

export function runAction(action: string): Promise<{ ok: boolean; message: string }> {
  return request(`/actions/${action}`, { method: 'POST' })
}

export function subscribeAdminStream<T>(path: 'metrics' | 'system', onData: (data: T) => void): () => void {
  const source = new EventSource(`/api/admin/${path}/stream`)
  const handler = (e: MessageEvent) => onData(JSON.parse(e.data))
  source.addEventListener(path, handler)
  source.onerror = () => {
    // EventSource reconnecte seul ; rien à faire ici.
  }
  return () => {
    source.removeEventListener(path, handler)
    source.close()
  }
}
