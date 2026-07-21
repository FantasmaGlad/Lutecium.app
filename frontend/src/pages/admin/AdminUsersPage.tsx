import { useEffect, useState } from 'react'
import * as adminApi from '../../lib/adminApi'
import { formatBytes } from '../../lib/format'
import './AdminUsersPage.css'

export function AdminUsersPage() {
  const [users, setUsers] = useState<adminApi.AdminUser[] | null>(null)
  const [guests, setGuests] = useState<adminApi.GuestSummary[] | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  function reload() {
    adminApi.listUsers().then(setUsers)
    adminApi.listGuests().then(setGuests)
  }

  useEffect(reload, [])

  async function toggleStatus(user: adminApi.AdminUser) {
    await adminApi.updateUser(user.id, { status: user.status === 'active' ? 'suspended' : 'active' })
    reload()
  }

  async function editQuota(user: adminApi.AdminUser) {
    const input = window.prompt(
      `Quota journalier de ${user.pseudo} en Go (vide = défaut du service) :`,
      user.daily_quota_gb != null ? String(user.daily_quota_gb) : '',
    )
    if (input === null) return
    if (input.trim() === '') {
      await adminApi.updateUser(user.id, { daily_quota_gb: null })
      reload()
      return
    }
    const value = Number(input)
    if (!Number.isFinite(value) || value <= 0) {
      window.alert('Quota invalide : indique un nombre de Go positif, ou laisse vide pour le défaut.')
      return
    }
    await adminApi.updateUser(user.id, { daily_quota_gb: value })
    reload()
  }

  async function resetPassword(user: adminApi.AdminUser) {
    if (!window.confirm(`Réinitialiser le mot de passe de ${user.pseudo} ?`)) return
    const res = await adminApi.resetUserPassword(user.id)
    setTempPassword(res.temporary_password)
  }

  async function removeUser(user: adminApi.AdminUser) {
    if (!window.confirm(`Supprimer définitivement le compte ${user.pseudo} ?`)) return
    await adminApi.deleteUser(user.id)
    reload()
  }

  if (!users) return <p className="admin-users__loading">Chargement…</p>

  return (
    <div className="admin-users">
      <h1 className="admin-users__title">Utilisateurs</h1>

      {tempPassword && (
        <p className="admin-users__temp-password">
          Mot de passe temporaire : <code>{tempPassword}</code>
          <button type="button" onClick={() => setTempPassword(null)}>
            fermer
          </button>
        </p>
      )}

      <div className="admin-users__table-wrap">
        <table className="admin-users__table">
          <thead>
            <tr>
              <th>Pseudo</th>
              <th>Inscrit</th>
              <th>Dernier accès</th>
              <th>Conso / quota</th>
              <th>Total</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.pseudo} {u.role === 'admin' && <span className="admin-users__badge">admin</span>}
                </td>
                <td>{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                <td>{u.last_seen_at ? new Date(u.last_seen_at).toLocaleString('fr-FR') : '—'}</td>
                <td>
                  {formatBytes(u.usage_today_bytes)} / {formatBytes(u.effective_daily_quota_bytes)}
                </td>
                <td>{u.total_downloads}</td>
                <td>{u.status === 'active' ? 'actif' : 'suspendu'}</td>
                <td className="admin-users__actions">
                  <button type="button" onClick={() => toggleStatus(u)}>
                    {u.status === 'active' ? 'suspendre' : 'réactiver'}
                  </button>
                  <button type="button" onClick={() => editQuota(u)}>
                    quota
                  </button>
                  <button type="button" onClick={() => resetPassword(u)}>
                    reset mdp
                  </button>
                  <button type="button" onClick={() => removeUser(u)}>
                    supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="admin-users__subtitle">Téléchargements invités</h2>
      <div className="admin-users__table-wrap">
        <table className="admin-users__table">
          <thead>
            <tr>
              <th>IP (anonymisée)</th>
              <th>Compteur</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {guests?.map((g) => (
              <tr key={`${g.ip_hash}-${g.guest_cookie}`}>
                <td className="admin-users__hash">{g.ip_hash.slice(0, 12)}…</td>
                <td>{g.count}</td>
                <td>{new Date(g.created_at).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
            {guests?.length === 0 && (
              <tr>
                <td colSpan={3}>Aucun invité.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
