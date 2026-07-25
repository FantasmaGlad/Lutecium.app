import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { useLanguage } from '../../lib/i18n/LanguageContext'
import './AdminLayout.css'

export function AdminLayout() {
  const { user, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) return null
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />

  return (
    <div className="admin-layout">
      <nav className="admin-layout__sidebar" aria-label={t.admin.nav.ariaLabel}>
        <NavLink to="/admin" end className="admin-layout__link">
          {t.admin.nav.overview}
        </NavLink>
        <NavLink to="/admin/users" className="admin-layout__link">
          {t.admin.nav.users}
        </NavLink>
        <NavLink to="/admin/system" className="admin-layout__link">
          {t.admin.nav.system}
        </NavLink>
        <NavLink to="/admin/logs" className="admin-layout__link">
          {t.admin.nav.logs}
        </NavLink>
      </nav>
      <div className="admin-layout__content">
        <Outlet />
      </div>
    </div>
  )
}
