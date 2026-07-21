import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import './AdminLayout.css'

export function AdminLayout() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />

  return (
    <div className="admin-layout">
      <nav className="admin-layout__sidebar" aria-label="Navigation admin">
        <NavLink to="/admin" end className="admin-layout__link">
          ▣ Vue
        </NavLink>
        <NavLink to="/admin/users" className="admin-layout__link">
          ▢ Users
        </NavLink>
        <NavLink to="/admin/system" className="admin-layout__link">
          ▢ Sys
        </NavLink>
        <NavLink to="/admin/logs" className="admin-layout__link">
          ▢ Logs
        </NavLink>
      </nav>
      <div className="admin-layout__content">
        <Outlet />
      </div>
    </div>
  )
}
