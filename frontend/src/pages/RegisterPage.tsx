import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { ApiError } from '../lib/api'
import { useLanguage } from '../lib/i18n/LanguageContext'
import './AuthPage.css'

export function RegisterPage() {
  const { register } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError(t.auth.passwordMismatch)
      return
    }
    setSubmitting(true)
    try {
      await register(pseudo, password)
      navigate('/') // reprise de l'URL en attente (§6.2) gérée par MainFlow au montage
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <h1 className="auth-page__title">{t.auth.register.title}</h1>
      <form className="auth-page__form" onSubmit={onSubmit}>
        <label className="auth-page__field">
          <span>{t.auth.pseudo}</span>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            minLength={3}
            maxLength={32}
            required
            autoComplete="username"
          />
        </label>
        <label className="auth-page__field">
          <span>{t.auth.password}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
        </label>
        <label className="auth-page__field">
          <span>{t.auth.register.confirmPassword}</span>
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
          {t.auth.register.submit}
        </button>
      </form>
      <p className="auth-page__switch">
        {t.auth.register.hasAccount} <Link to="/login">{t.auth.register.login}</Link>
      </p>
    </div>
  )
}
