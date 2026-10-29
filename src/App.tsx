import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useDashboardAccess } from './context/DashboardAccessContext'
import { useLocale } from './context/LocaleContext'
import { useSignedInProfileRole } from './hooks/useCanArrangeOversight'
import { pathForModule } from './modules/registry'
import { LoginPage } from './pages/LoginPage'
import { DashboardLayout, RequireModule } from './pages/DashboardLayout'
import { OversitePage } from './pages/OversitePage'
import { PlaceholderModulePage } from './pages/PlaceholderModulePage'

// Oversight (the start page) stays in the main bundle; other pages load when opened.
const OpenOrdersPage = lazy(() => import('./pages/OpenOrdersPage').then(m => ({ default: m.OpenOrdersPage })))
const OrdersMtdPage = lazy(() => import('./pages/OrdersMtdPage').then(m => ({ default: m.OrdersMtdPage })))
const SalesPage = lazy(() => import('./pages/SalesPage').then(m => ({ default: m.SalesPage })))
const StockPage = lazy(() => import('./pages/StockPage').then(m => ({ default: m.StockPage })))
const StockBrandPage = lazy(() => import('./pages/StockBrandPage').then(m => ({ default: m.StockBrandPage })))
const YearlyDataPage = lazy(() => import('./pages/rnd/YearlyDataPage').then(m => ({ default: m.YearlyDataPage })))
const ClientCardPage = lazy(() => import('./pages/rnd/ClientCardPage').then(m => ({ default: m.ClientCardPage })))
const ItemCardPage = lazy(() => import('./pages/rnd/ItemCardPage').then(m => ({ default: m.ItemCardPage })))
const StockHistoryPage = lazy(() => import('./pages/StockHistoryPage').then(m => ({ default: m.StockHistoryPage })))
const MonthlyDataPage = lazy(() => import('./pages/rnd/MonthlyDataPage').then(m => ({ default: m.MonthlyDataPage })))
const ItemsIndexPage = lazy(() => import('./pages/ItemsIndexPage').then(m => ({ default: m.ItemsIndexPage })))
const DeliveriesPage = lazy(() => import('./pages/operations/DeliveriesPage').then(m => ({ default: m.DeliveriesPage })))
const UsersPage = lazy(() => import('./pages/admin/UsersPage').then(m => ({ default: m.UsersPage })))
const ClassesPage = lazy(() => import('./pages/admin/ClassesPage').then(m => ({ default: m.ClassesPage })))
const ModulesPage = lazy(() => import('./pages/admin/ModulesPage').then(m => ({ default: m.ModulesPage })))
const ChainsPage = lazy(() => import('./pages/admin/ChainsPage').then(m => ({ default: m.ChainsPage })))
const DataHealthPage = lazy(() => import('./pages/admin/DataHealthPage').then(m => ({ default: m.DataHealthPage })))

function HomeRedirect() {
  const { access, loading } = useDashboardAccess()
  const { t } = useLocale()
  if (loading) return <p className="status-msg p-6">{t('common.loading')}</p>
  const path = access ? pathForModule(access.defaultModule) : '/oversite'
  return <Navigate to={path} replace />
}

function ProtectedApp() {
  const { session, loading, isSuperAdmin } = useAuth()
  const { role } = useSignedInProfileRole()
  const canManageUsers = isSuperAdmin || role === 'admin'
  const { t } = useLocale()
  const location = useLocation()
  if (loading) return <p className="status-msg p-6">{t('common.loading')}</p>
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

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
        <Route path="stock" element={<RequireModule moduleId="stock"><StockPage /></RequireModule>} />
        <Route path="items" element={<ItemsIndexPage />} />
        <Route path="stock-brand" element={<RequireModule moduleId="stock"><StockBrandPage /></RequireModule>} />
        <Route path="stock-history" element={<RequireModule moduleId="stock"><StockHistoryPage /></RequireModule>} />
        <Route path="rnd/monthly" element={<RequireModule moduleId="rnd"><MonthlyDataPage /></RequireModule>} />
        <Route path="rnd/yearly" element={<RequireModule moduleId="rnd"><YearlyDataPage /></RequireModule>} />
        <Route path="rnd/client" element={<RequireModule moduleId="purchase_insights"><ClientCardPage /></RequireModule>} />
        <Route path="rnd/item" element={<RequireModule moduleId="purchase_insights"><ItemCardPage /></RequireModule>} />
        <Route path="export" element={<RequireModule moduleId="export"><PlaceholderModulePage title="Export" /></RequireModule>} />
        <Route path="operations/deliveries" element={<RequireModule moduleId="ops_deliveries"><DeliveriesPage /></RequireModule>} />
        {canManageUsers && <Route path="admin/users" element={<UsersPage />} />}
        {isSuperAdmin && <Route path="admin/classes" element={<ClassesPage />} />}
        {isSuperAdmin && <Route path="admin/modules" element={<ModulesPage />} />}
        {isSuperAdmin && <Route path="admin/chains" element={<ChainsPage />} />}
        {canManageUsers && <Route path="admin/data-health" element={<DataHealthPage />} />}
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
