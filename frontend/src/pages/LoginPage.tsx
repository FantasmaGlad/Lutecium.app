import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { ApiError } from '../lib/api'
import { useLanguage } from '../lib/i18n/LanguageContext'
import './AuthPage.css'

export function LoginPage() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await login(pseudo, password)
      navigate(user.must_change_password ? '/changer-mot-de-passe' : '/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <h1 className="auth-page__title">{t.auth.login.title}</h1>
      <form className="auth-page__form" onSubmit={onSubmit}>
        <label className="auth-page__field">
          <span>{t.auth.pseudo}</span>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
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
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="auth-page__error">{error}</p>}
        <button type="submit" className="auth-page__submit" disabled={submitting}>
          {t.auth.login.submit}
        </button>
      </form>
      <p className="auth-page__switch">
        {t.auth.login.noAccount} <Link to="/register">{t.auth.login.createAccount}</Link>
      </p>
    </div>
  )
}
