import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useLocale } from '../context/LocaleContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { canShowModule } from '../lib/permissions'
import { navLabel } from '../i18n'
import { SidebarFilters } from '../components/sidebar/SidebarFilters'
import { MODULE_REGISTRY } from '../modules/registry'
import { useLocation } from 'react-router-dom'

export function DashboardLayout() {
  const { signOut, isSuperAdmin } = useAuth()
  const { access, loading } = useDashboardAccess()
  const { isRendering } = useDashboardFilters()
  const { locale, setLocale, t, dir } = useLocale()
  const isRtl = dir === 'rtl'
  const { allRows, debtRows, isLoading: dataLoading, dataHealth } = useDashboardData()
  const queryClient = useQueryClient()
  const location = useLocation()
  const showFilters = !location.pathname.startsWith('/admin')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.classList.toggle('mobile-sidebar-open', sidebarOpen)
    return () => document.body.classList.remove('mobile-sidebar-open')
  }, [sidebarOpen])

  if (loading) return <p className="status-msg p-6">{t('common.loadingPermissions')}</p>
  if (!access?.active) return <p className="status-msg error p-6">{t('common.noAccess')}</p>

  const visible = MODULE_REGISTRY.filter(m => canShowModule(access, m.id, isSuperAdmin))
  const rowCount = allRows.length
  const debtCount = debtRows.length

  function refreshData() {
    queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
  }

  const sidebar = (
    <aside className={`dashboard-sidebar${sidebarOpen ? ' is-open' : ''}`}>
      <div className="sidebar-label">{t('nav.navigation')}</div>
      <nav>
        {visible.map(m => (
          <NavLink
            key={m.id}
            to={m.path}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `nav-btn${m.id === 'oversite' ? ' oversite-nav' : ''}${isActive ? ' active' : ''}`
            }
          >
            {m.id === 'oversite' ? '🏠 ' : ''}
            {navLabel(locale, m.id)}
          </NavLink>
        ))}
        {isSuperAdmin && (
          <>
            <div className="sidebar-label" style={{ marginTop: 8 }}>
              {t('nav.admin')}
            </div>
            <NavLink
              to="/admin/users"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
            >
              {t('nav.adminUsers')}
            </NavLink>
          </>
        )}
      </nav>
      {showFilters && <SidebarFilters />}
    </aside>
  )

  const main = (
    <main className="dashboard-main">
      {!dataHealth.ok && dataHealth.messageKey && (
        <div className="status-msg error" style={{ margin: '0 0 12px' }}>
          {t(dataHealth.messageKey)}
        </div>
      )}
      {isRendering && (
        <div className="render-overlay" aria-live="polite">
          <div className="spin-wrap">
            <div className="spin" />
          </div>
          <p>{t('common.renderingReport')}</p>
        </div>
      )}
      <Outlet />
    </main>
  )

  return (
    <>
      <header className={`dashboard-header${isRtl ? ' is-rtl' : ''}`}>
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label={sidebarOpen ? t('common.closeMenu') : t('common.openMenu')}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen(open => !open)}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <div className="hdr-brand">
          <h1>{t('header.title')}</h1>
        </div>
        <div className="hdr-right">
          <div className="lang-switch" role="group" aria-label={t('common.language')}>
            <button
              type="button"
              className={`lang-btn${locale === 'en' ? ' active' : ''}`}
              onClick={() => setLocale('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-btn${locale === 'he' ? ' active' : ''}`}
              onClick={() => setLocale('he')}
            >
              עב
            </button>
          </div>
          <div className="data-badge">
            {dataLoading ? (
              t('common.loadingData')
            ) : (
              <>
                {t('header.loadedRows', { rows: rowCount.toLocaleString() })}
                {debtCount > 0 ? (
                  <> {t('header.debtClients', { count: debtCount })}</>
                ) : (
                  <> {t('header.noDebtRows')}</>
                )}
              </>
            )}
          </div>
          <button type="button" className="refresh-btn" onClick={refreshData} title={t('common.reloadData')}>
            ↺ {t('common.refresh')}
          </button>
          <button type="button" className="sign-out-btn" onClick={() => signOut()}>
            {t('common.signOut')}
          </button>
        </div>
      </header>

      <div className={`dashboard-shell${isRtl ? ' is-rtl' : ''}`}>
        {sidebarOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label={t('common.closeMenu')}
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {isRtl ? (
          <>
            {main}
            {sidebar}
          </>
        ) : (
          <>
            {sidebar}
            {main}
          </>
        )}
      </div>
    </>
  )
}

export function RequireModule({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  const { isSuperAdmin } = useAuth()
  const { access } = useDashboardAccess()
  if (!access || !canShowModule(access, moduleId as never, isSuperAdmin)) {
    return <Navigate to="/oversite" replace />
  }
  return <>{children}</>
}
