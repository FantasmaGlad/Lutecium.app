export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = 'Une erreur est survenue.'
    let code: string | undefined
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') {
        message = body.detail
      } else if (body.detail?.message) {
        message = body.detail.message
        code = body.detail.code
      }
    } catch {
      // corps non JSON : on garde le message générique
    }
    throw new ApiError(response.status, message, code)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

// --- Analyse (F-10, F-11) ---

export interface VideoFormat {
  format_id: string
  ext: string
  resolution: string | null
  fps: number | null
  filesize_bytes: number | null
  vcodec: string | null
}

export interface AudioFormat {
  format_id: string
  ext: string
  abr: number | null
  filesize_bytes: number | null
  acodec: string | null
}

export interface SubtitleTrack {
  lang: string
  ext: string
}

export interface AnalyzeResponse {
  title: string
  duration_seconds: number | null
  thumbnail_url: string | null
  site: string
  suggested_filename: string
  video_formats: VideoFormat[]
  audio_formats: AudioFormat[]
  subtitles: SubtitleTrack[]
}

export function analyze(url: string): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>('/analyze', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

// --- Téléchargements (F-11..F-13, F-21..F-24) ---

export type DownloadMode = 'video' | 'audio' | 'subtitles'

export interface CreateDownloadOptions {
  url: string
  mode: DownloadMode
  format_id?: string
  audio_format?: string
  subtitle_langs?: string[]
  filename?: string
}

export interface DownloadResponse {
  id: number
  status: string
  position: number
  estimated_wait_seconds: number | null
}

export function createDownload(options: CreateDownloadOptions): Promise<DownloadResponse> {
  return request<DownloadResponse>('/downloads', {
    method: 'POST',
    body: JSON.stringify(options),
  })
}

export function cancelDownload(id: number): Promise<DownloadResponse> {
  return request<DownloadResponse>(`/downloads/${id}/cancel`, { method: 'POST' })
}

// --- Auth (F-01..F-05) ---

export interface UserResponse {
  id: number
  pseudo: string
  role: string
  must_change_password: boolean
  usage_today_bytes: number
  daily_quota_bytes: number
}

export function register(pseudo: string, password: string): Promise<UserResponse> {
  return request<UserResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ pseudo, password }),
  })
}

export function login(pseudo: string, password: string): Promise<UserResponse> {
  return request<UserResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ pseudo, password }),
  })
}

export function logout(): Promise<{ ok: boolean }> {
  return request('/auth/logout', { method: 'POST' })
}

export function me(): Promise<UserResponse> {
  return request<UserResponse>('/auth/me')
}

export function changePassword(newPassword: string, currentPassword?: string): Promise<{ ok: boolean }> {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword, current_password: currentPassword }),
  })
}

// --- Historique (UI §6.3) ---

export interface HistoryItem {
  id: number
  url: string
  site: string | null
  filename: string | null
  size_bytes: number | null
  status: string
  error_message: string | null
  created_at: string
  options: Record<string, unknown>
}

export interface HistoryResponse {
  items: HistoryItem[]
  total: number
}

export function getHistory(page = 1, pageSize = 20): Promise<HistoryResponse> {
  return request<HistoryResponse>(`/me/downloads?page=${page}&page_size=${pageSize}`)
}
