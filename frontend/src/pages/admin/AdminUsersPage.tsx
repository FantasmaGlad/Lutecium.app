import { useEffect, useState } from 'react'
import * as adminApi from '../../lib/adminApi'
import { formatBytes, localeTag } from '../../lib/format'
import { useLanguage } from '../../lib/i18n/LanguageContext'
import { ErrorBanner } from './AdminWidgets'
import './AdminUsersPage.css'

export function AdminUsersPage() {
  const [users, setUsers] = useState<adminApi.AdminUser[] | null>(null)
  const [guests, setGuests] = useState<adminApi.GuestSummary[] | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { t } = useLanguage()

  function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : t.common.genericError
  }

  function reload() {
    adminApi.listUsers().then(setUsers).catch((err) => setError(errorMessage(err)))
    adminApi.listGuests().then(setGuests).catch((err) => setError(errorMessage(err)))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [])

  async function toggleStatus(user: adminApi.AdminUser) {
    try {
      await adminApi.updateUser(user.id, { status: user.status === 'active' ? 'suspended' : 'active' })
      reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function editQuota(user: adminApi.AdminUser) {
    const input = window.prompt(
      t.admin.users.quotaPrompt(user.pseudo),
      user.daily_quota_gb != null ? String(user.daily_quota_gb) : '',
    )
    if (input === null) return
    try {
      if (input.trim() === '') {
        await adminApi.updateUser(user.id, { daily_quota_gb: null })
        reload()
        return
      }
      const value = Number(input)
      if (!Number.isFinite(value) || value <= 0) {
        window.alert(t.admin.users.quotaInvalid)
        return
      }
      await adminApi.updateUser(user.id, { daily_quota_gb: value })
      reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function resetPassword(user: adminApi.AdminUser) {
    if (!window.confirm(t.admin.users.resetPasswordConfirm(user.pseudo))) return
    try {
      const res = await adminApi.resetUserPassword(user.id)
      setTempPassword(res.temporary_password)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function removeUser(user: adminApi.AdminUser) {
    if (!window.confirm(t.admin.users.deleteConfirm(user.pseudo))) return
    try {
      await adminApi.deleteUser(user.id)
      reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (!users && error) return <ErrorBanner message={error} />
  if (!users) return <p className="admin-users__loading">{t.common.loading}</p>

  return (
    <div className="admin-users">
      <h1 className="admin-users__title">{t.admin.users.title}</h1>

      {error && <ErrorBanner message={error} />}

      {tempPassword && (
        <p className="admin-users__temp-password">
          {t.admin.users.tempPassword} <code>{tempPassword}</code>
          <button type="button" onClick={() => setTempPassword(null)}>
            {t.admin.users.close}
          </button>
        </p>
      )}

      <div className="admin-users__table-wrap">
        <table className="admin-users__table">
          <thead>
            <tr>
              <th>{t.admin.users.colPseudo}</th>
              <th>{t.admin.users.colJoined}</th>
              <th>{t.admin.users.colLastSeen}</th>
              <th>{t.admin.users.colUsage}</th>
              <th>{t.admin.users.colTotal}</th>
              <th>{t.admin.users.colStatus}</th>
              <th>{t.admin.users.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.pseudo} {u.role === 'admin' && <span className="admin-users__badge">{t.admin.users.badgeAdmin}</span>}
                </td>
                <td>{new Date(u.created_at).toLocaleDateString(localeTag())}</td>
                <td>{u.last_seen_at ? new Date(u.last_seen_at).toLocaleString(localeTag()) : '—'}</td>
                <td>
                  {formatBytes(u.usage_today_bytes)} / {formatBytes(u.effective_daily_quota_bytes)}
                </td>
                <td>{u.total_downloads}</td>
                <td>{u.status === 'active' ? t.admin.users.statusActive : t.admin.users.statusSuspended}</td>
                <td className="admin-users__actions">
                  <button type="button" onClick={() => toggleStatus(u)}>
                    {u.status === 'active' ? t.admin.users.suspend : t.admin.users.reactivate}
                  </button>
                  <button type="button" onClick={() => editQuota(u)}>
                    {t.admin.users.quota}
                  </button>
                  <button type="button" onClick={() => resetPassword(u)}>
                    {t.admin.users.resetPassword}
                  </button>
                  <button type="button" onClick={() => removeUser(u)}>
                    {t.admin.users.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="admin-users__subtitle">{t.admin.users.guestsTitle}</h2>
      <div className="admin-users__table-wrap">
        <table className="admin-users__table">
          <thead>
            <tr>
              <th>{t.admin.users.colIp}</th>
              <th>{t.admin.users.colCount}</th>
              <th>{t.admin.users.colDate}</th>
            </tr>
          </thead>
          <tbody>
            {guests?.map((g) => (
              <tr key={`${g.ip_hash}-${g.guest_cookie}`}>
                <td className="admin-users__hash">{g.ip_hash.slice(0, 12)}…</td>
                <td>{g.count}</td>
                <td>{new Date(g.created_at).toLocaleString(localeTag())}</td>
              </tr>
            ))}
            {guests?.length === 0 && (
              <tr>
                <td colSpan={3}>{t.admin.users.noGuests}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
