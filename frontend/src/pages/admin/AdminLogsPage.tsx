import { useEffect, useMemo, useState } from 'react'
import * as adminApi from '../../lib/adminApi'
import { formatBytes } from '../../lib/format'
import './AdminLogsPage.css'

const STATUSES = ['queued', 'downloading', 'processing', 'done', 'failed', 'cancelled', 'expired']

export function AdminLogsPage() {
  const [entries, setEntries] = useState<adminApi.JournalEntry[] | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    adminApi.getJournal(statusFilter || undefined).then(setEntries)
  }, [statusFilter])

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.url.toLowerCase().includes(q) || (e.site ?? '').toLowerCase().includes(q))
  }, [entries, search])

  return (
    <div className="admin-logs">
      <h1 className="admin-logs__title">Journaux</h1>

      <div className="admin-logs__filters">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="rechercher (URL, site)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!entries && <p className="admin-logs__loading">Chargement…</p>}

      {entries && (
        <div className="admin-logs__table-wrap">
          <table className="admin-logs__table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Utilisateur</th>
                <th>Site</th>
                <th>URL</th>
                <th>Taille</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className={e.status === 'failed' ? 'admin-logs__row--error' : undefined}>
                  <td>#{e.id}</td>
                  <td>{e.user_id ?? 'invité'}</td>
                  <td>{e.site ?? '—'}</td>
                  <td className="admin-logs__url" title={e.url}>
                    {e.url}
                  </td>
                  <td>{formatBytes(e.size_bytes)}</td>
                  <td>{e.status}{e.error_message ? ` · ${e.error_message}` : ''}</td>
                  <td>{new Date(e.created_at).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>Aucune entrée.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
