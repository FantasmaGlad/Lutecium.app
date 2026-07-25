import { useEffect, useMemo, useState } from 'react'
import * as adminApi from '../../lib/adminApi'
import { formatBytes, localeTag } from '../../lib/format'
import { useLanguage } from '../../lib/i18n/LanguageContext'
import { ErrorBanner } from './AdminWidgets'
import './AdminLogsPage.css'

const STATUSES = ['queued', 'downloading', 'processing', 'done', 'failed', 'cancelled', 'expired']

export function AdminLogsPage() {
  const [entries, setEntries] = useState<adminApi.JournalEntry[] | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    adminApi
      .getJournal(statusFilter || undefined)
      .then((data) => {
        setEntries(data)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : t.common.genericError))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.url.toLowerCase().includes(q) || (e.site ?? '').toLowerCase().includes(q))
  }, [entries, search])

  return (
    <div className="admin-logs">
      <h1 className="admin-logs__title">{t.admin.logs.title}</h1>

      <div className="admin-logs__filters">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t.admin.logs.allStatuses}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder={t.admin.logs.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <ErrorBanner message={error} />}
      {!entries && !error && <p className="admin-logs__loading">{t.common.loading}</p>}

      {entries && (
        <div className="admin-logs__table-wrap">
          <table className="admin-logs__table">
            <thead>
              <tr>
                <th>{t.admin.logs.colId}</th>
                <th>{t.admin.logs.colUser}</th>
                <th>{t.admin.logs.colSite}</th>
                <th>{t.admin.logs.colUrl}</th>
                <th>{t.admin.logs.colSize}</th>
                <th>{t.admin.logs.colStatus}</th>
                <th>{t.admin.logs.colDate}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className={e.status === 'failed' ? 'admin-logs__row--error' : undefined}>
                  <td>#{e.id}</td>
                  <td>{e.user_id ?? t.admin.logs.guest}</td>
                  <td>{e.site ?? '—'}</td>
                  <td className="admin-logs__url" title={e.url}>
                    {e.url}
                  </td>
                  <td>{formatBytes(e.size_bytes)}</td>
                  <td>{e.status}{e.error_message ? ` · ${e.error_message}` : ''}</td>
                  <td>{new Date(e.created_at).toLocaleString(localeTag())}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>{t.admin.logs.noEntries}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
