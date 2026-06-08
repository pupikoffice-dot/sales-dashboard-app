import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useDashboardAccess } from './context/DashboardAccessContext'
import { pathForModule } from './modules/registry'
import { LoginPage } from './pages/LoginPage'
import { DashboardLayout, RequireModule } from './pages/DashboardLayout'
import { OversitePage } from './pages/OversitePage'
import { OpenOrdersPage } from './pages/OpenOrdersPage'
import { OrdersMtdPage } from './pages/OrdersMtdPage'
import { PlaceholderModulePage } from './pages/PlaceholderModulePage'
import { SalesPage } from './pages/SalesPage'
import { UsersPage } from './pages/admin/UsersPage'

function HomeRedirect() {
  const { access, loading } = useDashboardAccess()
  if (loading) return <p className="status-msg p-6">Loading…</p>
  const path = access ? pathForModule(access.defaultModule) : '/oversite'
  return <Navigate to={path} replace />
}

function ProtectedApp() {
  const { session, loading, isSuperAdmin } = useAuth()
  if (loading) return <p className="status-msg p-6">Loading…</p>
  if (!session) return <Navigate to="/login" replace />

  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<HomeRedirect />} />
        <Route path="oversite" element={<RequireModule moduleId="oversite"><OversitePage /></RequireModule>} />
        <Route path="sales" element={<RequireModule moduleId="sales_performance"><SalesPage /></RequireModule>} />
        <Route path="orders" element={<RequireModule moduleId="orders_mtd"><OrdersMtdPage /></RequireModule>} />
        <Route path="open-orders" element={<RequireModule moduleId="open_orders"><OpenOrdersPage /></RequireModule>} />
        <Route path="returns" element={<RequireModule moduleId="returns"><PlaceholderModulePage title="Returns" /></RequireModule>} />
        <Route path="debt" element={<RequireModule moduleId="debt"><PlaceholderModulePage title="Open Debt" /></RequireModule>} />
        <Route path="stock-alerts" element={<RequireModule moduleId="stock_alerts"><PlaceholderModulePage title="Stock Alerts" /></RequireModule>} />
        <Route path="stock" element={<RequireModule moduleId="stock"><PlaceholderModulePage title="Stock" /></RequireModule>} />
        <Route path="export" element={<RequireModule moduleId="export"><PlaceholderModulePage title="Export" /></RequireModule>} />
        {isSuperAdmin && <Route path="admin/users" element={<UsersPage />} />}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </BrowserRouter>
  )
}
