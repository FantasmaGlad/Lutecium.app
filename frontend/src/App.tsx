import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { MainFlow } from './components/flow/MainFlow'
import { DownloadManagerDrawer } from './components/DownloadManagerDrawer'
import { Toasts } from './components/Toasts'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ToastProvider } from './lib/ToastContext'
import { DownloadManagerProvider } from './lib/DownloadManagerContext'
import { notifyDownloadReady } from './lib/notifications'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { HistoryPage } from './pages/HistoryPage'
import { AccountPage } from './pages/AccountPage'
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

function AppRoutes() {
  return (
    <Routes>
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
    </Routes>
  )
}

function AppShell() {
  return (
    <DownloadManagerProvider onJobDone={(job) => notifyDownloadReady(job.title)}>
      <Header />
      <AppRoutes />
      <DownloadManagerDrawer />
      <Toasts />
    </DownloadManagerProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
