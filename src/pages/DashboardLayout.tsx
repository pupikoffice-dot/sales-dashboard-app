import type { ReactNode } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { canShowModule } from '../lib/permissions'
import { SidebarFilters } from '../components/sidebar/SidebarFilters'
import { MODULE_REGISTRY } from '../modules/registry'
import { useLocation } from 'react-router-dom'

export function DashboardLayout() {
  const { signOut, isSuperAdmin } = useAuth()
  const { access, loading } = useDashboardAccess()
  const { allRows, debtRows, isLoading: dataLoading } = useDashboardData()
  const queryClient = useQueryClient()
  const location = useLocation()
  const showFilters = !location.pathname.startsWith('/admin')

  if (loading) return <p className="status-msg p-6">Loading permissions…</p>
  if (!access?.active) return <p className="status-msg error p-6">No dashboard access configured.</p>

  const visible = MODULE_REGISTRY.filter(m => canShowModule(access, m.id))
  const rowCount = allRows.length
  const debtCount = debtRows.length

  function refreshData() {
    queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
  }

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Sales Dashboard</h1>
          <div className="sub">Pupik · Monkeytime · Grow</div>
        </div>
        <div className="hdr-right">
          <div className="data-badge">
            {dataLoading ? (
              'Loading data…'
            ) : (
              <>
                Loaded: <b>{rowCount.toLocaleString()}</b> rows
                {debtCount > 0 ? (
                  <>
                    {' '}
                    · <b>{debtCount}</b> debt clients
                  </>
                ) : (
                  ' · 0 debt rows'
                )}
              </>
            )}
          </div>
          <button type="button" className="refresh-btn" onClick={refreshData} title="Reload dashboard data">
            ↺ Refresh
          </button>
          <button type="button" className="sign-out-btn" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="sidebar-label">Navigation</div>
          <nav>
            {visible.map(m => (
              <NavLink
                key={m.id}
                to={m.path}
                className={({ isActive }) =>
                  `nav-btn${m.id === 'oversite' ? ' oversite-nav' : ''}${isActive ? ' active' : ''}`
                }
              >
                {m.id === 'oversite' ? '🏠 ' : ''}
                {m.label}
              </NavLink>
            ))}
            {isSuperAdmin && (
              <>
                <div className="sidebar-label" style={{ marginTop: 8 }}>
                  Admin
                </div>
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
                >
                  Admin — Users
                </NavLink>
              </>
            )}
          </nav>
          {showFilters && <SidebarFilters />}
        </aside>
        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </>
  )
}

export function RequireModule({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  const { access } = useDashboardAccess()
  if (!access || !canShowModule(access, moduleId as never)) {
    return <Navigate to="/oversite" replace />
  }
  return <>{children}</>
}
