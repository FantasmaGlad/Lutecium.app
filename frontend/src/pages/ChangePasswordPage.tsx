import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { ApiError, changePassword } from '../lib/api'
import './AuthPage.css'

interface ChangePasswordPageProps {
  forced?: boolean
}

export function ChangePasswordPage({ forced = false }: ChangePasswordPageProps) {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const mustChange = forced && user?.must_change_password

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(newPassword, mustChange ? undefined : currentPassword)
      await refresh()
      navigate('/compte')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <h1 className="auth-page__title">Changer de mot de passe</h1>
      {mustChange && (
        <p className="auth-page__switch">Un administrateur a réinitialisé ton mot de passe. Choisis-en un nouveau.</p>
      )}
      <form className="auth-page__form" onSubmit={onSubmit}>
        {!mustChange && (
          <label className="auth-page__field">
            <span>Mot de passe actuel</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
        )}
        <label className="auth-page__field">
          <span>Nouveau mot de passe</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
        </label>
        <label className="auth-page__field">
          <span>Confirmation</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
        </label>
        {error && <p className="auth-page__error">{error}</p>}
        <button type="submit" className="auth-page__submit" disabled={submitting}>
          Valider
        </button>
      </form>
    </div>
  )
}
