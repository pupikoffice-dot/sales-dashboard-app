import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage }    from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage }    from './pages/UsersPage'
import { ClientsPage }  from './pages/ClientsPage'
import { SyncPage }     from './pages/SyncPage'
import { SettingsPage } from './pages/SettingsPage'
import { UsagePage }    from './pages/UsagePage'
import { SecurityPage } from './pages/SecurityPage'
import { ChatPage }     from './pages/ChatPage'
import { DevicesPage }  from './pages/DevicesPage'
import { QueriesPage }  from './pages/QueriesPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={
            <ProtectedRoute minRole="manager">
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardPage />} />
            <Route path="users"    element={<UsersPage />} />
            <Route path="clients"  element={<ClientsPage />} />
            <Route path="sync"     element={<ProtectedRoute minRole="admin"><SyncPage /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute minRole="super_admin"><SettingsPage /></ProtectedRoute>} />
            <Route path="usage"    element={<ProtectedRoute minRole="admin"><UsagePage /></ProtectedRoute>} />
            <Route path="security" element={<ProtectedRoute minRole="admin"><SecurityPage /></ProtectedRoute>} />
            <Route path="chat"     element={<ChatPage />} />
            <Route path="devices"  element={<DevicesPage />} />
            <Route path="queries"  element={<QueriesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
