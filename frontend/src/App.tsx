import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { MainFlow } from './components/flow/MainFlow'
import { DownloadManagerDrawer } from './components/DownloadManagerDrawer'
import { Toasts } from './components/Toasts'
import { Mascot } from './components/Mascot'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { LanguageProvider } from './lib/i18n/LanguageContext'
import { ToastProvider } from './lib/ToastContext'
import { DownloadManagerProvider } from './lib/DownloadManagerContext'
import { notifyDownloadReady } from './lib/notifications'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { HistoryPage } from './pages/HistoryPage'
import { AccountPage } from './pages/AccountPage'
import { AboutPage } from './pages/AboutPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminSystemPage } from './pages/admin/AdminSystemPage'
import { AdminLogsPage } from './pages/admin/AdminLogsPage'
import './App.css'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function ForcedPasswordGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user?.must_change_password) return <Navigate to="/changer-mot-de-passe" replace />
  return <>{children}</>
}

function PublicLayout() {
  return (
    <DownloadManagerProvider onJobDone={(job) => notifyDownloadReady(job.title)}>
      <Header />
      <Outlet />
      <DownloadManagerDrawer />
      <Toasts />
      <Mascot />
    </DownloadManagerProvider>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route
          path="/"
          element={
            <ForcedPasswordGate>
              <main className="main">
                <MainFlow />
              </main>
            </ForcedPasswordGate>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/changer-mot-de-passe" element={<ChangePasswordPage forced />} />
        <Route
          path="/historique"
          element={
            <RequireAuth>
              <HistoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/compte"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route path="/a-propos" element={<AboutPage />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverviewPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="system" element={<AdminSystemPage />} />
        <Route path="logs" element={<AdminLogsPage />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </MotionConfig>
  )
}

export default App
