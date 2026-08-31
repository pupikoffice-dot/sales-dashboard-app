import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useLocale } from '../context/LocaleContext'
import { useTheme } from '../context/ThemeContext'
import { usePreview } from '../context/PreviewContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { canShowModule } from '../lib/permissions'
import { navLabel } from '../i18n'
import { PreviewBanner } from '../components/admin/PreviewBanner'
import { ViewAsSwitcher } from '../components/admin/ViewAsSwitcher'
import { SidebarFilters } from '../components/sidebar/SidebarFilters'
import { MODULE_REGISTRY } from '../modules/registry'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatHeaderVersionBadge } from '../lib/appChannel'
import { useSalesAgentNavHide } from '../hooks/useSalesAgentNavHide'
import { useUserProfile } from '../hooks/useUserProfile'

async function fetchActiveAppVersion(): Promise<string> {
  const { data, error } = await supabase
    .from('app_runtime_config')
    .select('active_version')
    .eq('id', true)
    .maybeSingle()
  if (error) throw error
  return (data?.active_version as string | undefined)?.trim() || '1.0'
}

export function DashboardLayout() {
  // `isSuperAdmin` here is the REAL flag: it keeps the Admin section reachable
  // while previewing, so the admin can walk between the settings editor and the
  // preview without exiting. Everything else gates on the effective flag.
  const { signOut, isSuperAdmin } = useAuth()
  const { isPreviewing, effectiveIsSuperAdmin } = usePreview()
  const { access, loading } = useDashboardAccess()
  const { isRendering, showOversiteDashboard } = useDashboardFilters()
  const { locale, setLocale, t, dir } = useLocale()
  const { theme, setTheme } = useTheme()
  const isRtl = dir === 'rtl'
  const { allRows, debtRows, isLoading: dataLoading, dataHealth } = useDashboardData()
  const queryClient = useQueryClient()
  const location = useLocation()
  const hideNavigation = useSalesAgentNavHide()
  const { name: userName } = useUserProfile()
  const showFilters = !location.pathname.startsWith('/admin') && !hideNavigation
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: liveActiveVersion = '1.0' } = useQuery({
    queryKey: ['app-active-version'],
    queryFn: fetchActiveAppVersion,
    staleTime: 5 * 60_000,
  })
  const versionBadge = formatHeaderVersionBadge(liveActiveVersion)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.classList.toggle('sales-agent-no-nav', hideNavigation)
    return () => document.body.classList.remove('sales-agent-no-nav')
  }, [hideNavigation])

  useEffect(() => {
    document.body.classList.toggle('mobile-sidebar-open', sidebarOpen)
    return () => document.body.classList.remove('mobile-sidebar-open')
  }, [sidebarOpen])

  // Both early returns keep the banner mounted: previewing an inactive user (or
  // one with no access row) hits the "no access" screen, and without this the
  // admin would be stranded with no way to exit the preview.
  if (loading) {
    return (
      <>
        <PreviewBanner />
        <p className="status-msg p-6">{t('common.loadingPermissions')}</p>
      </>
    )
  }
  if (!access?.active) {
    return (
      <>
        <PreviewBanner />
        <p className="status-msg error p-6">
          {isPreviewing ? t('preview.targetNoAccess') : t('common.noAccess')}
        </p>
      </>
    )
  }

  const visible = MODULE_REGISTRY.filter(m => canShowModule(access, m.id, effectiveIsSuperAdmin))
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
            onClick={() => {
              setSidebarOpen(false)
              if (m.id === 'oversite') showOversiteDashboard()
            }}
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
            <NavLink
              to="/admin/classes"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
            >
              {t('nav.adminClasses')}
            </NavLink>
            <NavLink
              to="/admin/modules"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
            >
              {t('nav.adminModules')}
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
      <PreviewBanner />
      <header className={`dashboard-header${isRtl ? ' is-rtl' : ''}`}>
        {!hideNavigation && (
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label={sidebarOpen ? t('common.closeMenu') : t('common.openMenu')}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(open => !open)}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
        )}
        <div className="hdr-brand">
          <h1>
            {t('header.title')}
            <span className="hdr-version" title={t('header.versionLabel', { version: versionBadge })}>
              {versionBadge}
            </span>
          </h1>
        </div>
        <div className="hdr-right">
          {userName ? (
            <span className="hdr-user-name" title={t('header.signedInAs', { name: userName })}>
              {userName}
            </span>
          ) : null}
          <ViewAsSwitcher />
          <div className="theme-switch" role="group" aria-label={t('common.theme')}>
            <button
              type="button"
              className={`theme-btn${theme === 'light' ? ' active' : ''}`}
              aria-label={t('common.lightTheme')}
              aria-pressed={theme === 'light'}
              onClick={() => setTheme('light')}
            >
              ☀
            </button>
            <button
              type="button"
              className={`theme-btn${theme === 'dark' ? ' active' : ''}`}
              aria-label={t('common.darkTheme')}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme('dark')}
            >
              ☾
            </button>
          </div>
          {/* Hidden while previewing: the preview shows the TARGET's language,
              so a language control here would be ambiguous (and preview is
              strictly read-only — setLocale refuses to write anyway). */}
          {!isPreviewing && (
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
          )}
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

      <div
        className={`dashboard-shell${isRtl ? ' is-rtl' : ''}${hideNavigation ? ' dashboard-shell--no-nav' : ''}`}
      >
        {!hideNavigation && sidebarOpen && (
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
            {!hideNavigation && sidebar}
          </>
        ) : (
          <>
            {!hideNavigation && sidebar}
            {main}
          </>
        )}
      </div>
    </>
  )
}

export function RequireModule({ moduleId, children }: { moduleId: string; children: ReactNode }) {
  const { effectiveIsSuperAdmin } = usePreview()
  const { access } = useDashboardAccess()
  if (!access || !canShowModule(access, moduleId as never, effectiveIsSuperAdmin)) {
    return <Navigate to="/oversite" replace />
  }
  return <>{children}</>
}
