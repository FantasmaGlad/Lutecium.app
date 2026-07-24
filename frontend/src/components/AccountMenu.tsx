import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { formatBytes } from '../lib/format'
import './AccountMenu.css'

export function AccountMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) {
    return (
      <Link to="/login" className="header__account">
        Se connecter
      </Link>
    )
  }

  const quotaOver = user.usage_today_bytes > user.daily_quota_bytes
  const quotaRawPct = (user.usage_today_bytes / user.daily_quota_bytes) * 100
  // Cohérent avec /compte (CDC §6.4) : la jauge peut dépasser 100% pour le quota-cadeau.
  const quotaPct = quotaOver ? Math.min(quotaRawPct, 130) : Math.min(quotaRawPct, 100)

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="header__account"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="account-menu-panel"
      >
        {user.pseudo}
      </button>
      {open && (
        <div className="account-menu__panel" id="account-menu-panel">
          <div className="account-menu__quota">
            <div className="account-menu__quota-track">
              <div
                className="account-menu__quota-fill"
                style={{ width: `${quotaPct}%` }}
                data-over={quotaOver || undefined}
              />
            </div>
            <span className="account-menu__quota-label">
              {formatBytes(user.usage_today_bytes)} / {formatBytes(user.daily_quota_bytes)}
            </span>
          </div>
          <Link to="/historique" onClick={() => setOpen(false)}>
            Mon historique
          </Link>
          <Link to="/compte" onClick={() => setOpen(false)}>
            Mon compte
          </Link>
          <button
            type="button"
            onClick={async () => {
              setOpen(false)
              await logout()
              navigate('/')
            }}
          >
            Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}
