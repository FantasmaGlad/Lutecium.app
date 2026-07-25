import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useLanguage } from '../lib/i18n/LanguageContext'
import './NavDrawer.css'

interface NavDrawerProps {
  open: boolean
  onClose: () => void
}

export function NavDrawer({ open, onClose }: NavDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    panelRef.current?.querySelector('a')?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const { user } = useAuth()
  const { t } = useLanguage()

  if (!open) return null

  return (
    <div className="nav-drawer">
      <button type="button" className="nav-drawer__scrim" aria-label={t.nav.closeMenu} onClick={onClose} />
      <nav className="nav-drawer__panel" ref={panelRef} aria-label={t.nav.ariaLabel}>
        <Link to="/" onClick={onClose}>
          {t.nav.home}
        </Link>
        <Link to="/historique" onClick={onClose}>
          {t.nav.history}
        </Link>
        <Link to="/compte" onClick={onClose}>
          {t.nav.account}
        </Link>
        {user?.role === 'admin' && (
          <Link to="/admin" onClick={onClose}>
            {t.nav.admin}
          </Link>
        )}
        <Link to="/a-propos" onClick={onClose}>
          {t.nav.about}
        </Link>
      </nav>
    </div>
  )
}
