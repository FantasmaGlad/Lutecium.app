import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { ApiError, changePassword } from '../lib/api'
import { useLanguage } from '../lib/i18n/LanguageContext'
import './AuthPage.css'

interface ChangePasswordPageProps {
  forced?: boolean
}

export function ChangePasswordPage({ forced = false }: ChangePasswordPageProps) {
  const { user, refresh } = useAuth()
  const { t } = useLanguage()
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
      setError(t.auth.passwordMismatch)
      return
    }
    setSubmitting(true)
    try {
      await changePassword(newPassword, mustChange ? undefined : currentPassword)
      await refresh()
      navigate('/compte')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <h1 className="auth-page__title">{t.auth.changePassword.title}</h1>
      {mustChange && <p className="auth-page__switch">{t.auth.changePassword.forcedNotice}</p>}
      <form className="auth-page__form" onSubmit={onSubmit}>
        {!mustChange && (
          <label className="auth-page__field">
            <span>{t.auth.changePassword.currentPassword}</span>
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
          <span>{t.auth.changePassword.newPassword}</span>
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
          <span>{t.auth.changePassword.confirmPassword}</span>
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
          {t.auth.changePassword.submit}
        </button>
      </form>
    </div>
  )
}
