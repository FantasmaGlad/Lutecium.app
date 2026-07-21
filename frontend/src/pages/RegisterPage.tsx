import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { ApiError } from '../lib/api'
import './AuthPage.css'

export function RegisterPage() {
  const { register } = useAuth()
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
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setSubmitting(true)
    try {
      await register(pseudo, password)
      navigate('/') // reprise de l'URL en attente (§6.2) gérée par MainFlow au montage
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <h1 className="auth-page__title">Créer un compte</h1>
      <form className="auth-page__form" onSubmit={onSubmit}>
        <label className="auth-page__field">
          <span>Pseudo</span>
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
          <span>Mot de passe</span>
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
          Créer un compte
        </button>
      </form>
      <p className="auth-page__switch">
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </div>
  )
}
