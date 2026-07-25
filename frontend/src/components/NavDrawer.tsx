import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
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

  if (!open) return null

  return (
    <div className="nav-drawer">
      <button type="button" className="nav-drawer__scrim" aria-label="Fermer le menu" onClick={onClose} />
      <nav className="nav-drawer__panel" ref={panelRef} aria-label="Navigation">
        <Link to="/" onClick={onClose}>
          Accueil
        </Link>
        <Link to="/historique" onClick={onClose}>
          Mon historique
        </Link>
        <Link to="/compte" onClick={onClose}>
          Mon compte
        </Link>
        {user?.role === 'admin' && (
          <Link to="/admin" onClick={onClose}>
            Admin
          </Link>
        )}
        <Link to="/a-propos" onClick={onClose}>
          À propos
        </Link>
      </nav>
    </div>
  )
}
