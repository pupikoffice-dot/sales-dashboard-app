import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useDashboardAccess } from '../context/DashboardAccessContext'
import { useDashboardFilters } from '../context/DashboardFiltersContext'
import { useLocale } from '../context/LocaleContext'
import { useTheme } from '../context/ThemeContext'
import { useSkin } from '../context/SkinContext'
import { usePreview } from '../context/PreviewContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { canShowModule } from '../lib/permissions'
import { navLabel } from '../i18n'
import { PreviewBanner } from '../components/admin/PreviewBanner'
import { ViewAsSwitcher } from '../components/admin/ViewAsSwitcher'
import { IntercompanySwitcher } from '../components/IntercompanySwitcher'
import { SidebarFilters } from '../components/sidebar/SidebarFilters'
import { MODULE_REGISTRY, NAV_EXTRAS } from '../modules/registry'
import { sidebarNavHideId } from '../lib/sidebarHide'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatHeaderVersionBadge } from '../lib/appChannel'
import { useSalesAgentNavHide } from '../hooks/useSalesAgentNavHide'
import { useSignedInProfileRole } from '../hooks/useCanArrangeOversight'
import { useUserProfile } from '../hooks/useUserProfile'
import { useOversightLayout } from '../hooks/useOversightLayout'
import { useDataHealthNotices } from '../hooks/useDataHealth'
import { DataHealthBanner } from '../components/DataHealthBanner'
import { unacknowledgedRed } from '../lib/dataHealth/notices'

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
  const { role: signedInRole } = useSignedInProfileRole()
  const canManageUsers = isSuperAdmin || signedInRole === 'admin'
  const { isPreviewing, effectiveIsSuperAdmin } = usePreview()
  const { access, loading } = useDashboardAccess()
  const { isRendering, showOversiteDashboard } = useDashboardFilters()
  const { locale, setLocale, t, dir } = useLocale()
  const { theme, setTheme } = useTheme()
  const { skin, available: skins, setSkin } = useSkin()
  const isRtl = dir === 'rtl'
  const { allRows, debtRows, isLoading: dataLoading, dataHealth, isRefreshing, dataSavedAt } = useDashboardData()
  const queryClient = useQueryClient()
  const location = useLocation()
  const hideNavigation = useSalesAgentNavHide()
  const { name: userName } = useUserProfile()
  const oversightLayout = useOversightLayout()
  // Admins and super admins: how many sources are late right now (badge on the Data health menu item, banner below).
  const healthNotices = useDataHealthNotices()
  const healthRed = unacknowledgedRed(healthNotices.data?.items ?? []).length
  const showSuiteDisclaimer =
    location.pathname.startsWith('/oversite') &&
    !oversightLayout.isLoading &&
    oversightLayout.display.mode === 'suite' &&
    (oversightLayout.display.suiteId === 'sales_manager' ||
      oversightLayout.display.suiteId === 'sales_agent')
  // Stock, Stock by brand, Items and R&D choose their company inside the page, so the Filter panel stays out of the way.
  const ownFilters = ['/stock', '/stock-brand', '/stock-history', '/items', '/rnd'].some(p => location.pathname === p || location.pathname.startsWith(`${p}/`))
  const showFilters = !location.pathname.startsWith('/admin') && !hideNavigation && !ownFilters
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Desktop: the sidebar can shrink to a narrow rail of icons (remembered on this device).
  const [rail, setRail] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_RAIL_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggleRail = () =>
    setRail(prev => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_RAIL_KEY, next ? '1' : '0')
      } catch {
        /* storage blocked: the choice just is not remembered */
      }
      return next
    })
  const { data: liveActiveVersion = '1.0' } = useQuery({
    queryKey: ['app-active-version'],
    queryFn: fetchActiveAppVersion,
    staleTime: 5 * 60_000,
  })
  const versionBadge = formatHeaderVersionBadge(liveActiveVersion)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // The header wraps onto several rows on phones, so its real height is bigger than --header-h. The phone menu
  // drawer and its backdrop start below it, so the header never hides the first menu items.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.dashboard-header')
    if (!header) return
    const root = document.documentElement
    const publish = () => root.style.setProperty('--header-live-h', `${Math.round(header.getBoundingClientRect().height)}px`)
    publish()
    window.addEventListener('resize', publish)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null
    ro?.observe(header)
    return () => {
      window.removeEventListener('resize', publish)
      ro?.disconnect()
      root.style.removeProperty('--header-live-h')
    }
  }, [loading, access?.active])

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
  const hiddenNav = new Set(access.hiddenSidebar ?? [])
  const visibleMain = visible.filter(m => m.section === 'main' && !hiddenNav.has(sidebarNavHideId(m.id)))
  // Stock used to be a Filter-panel tab; its old hide key keeps hiding it.
  const visibleOps = visible.filter(
    m => m.section === 'operations' && !hiddenNav.has(sidebarNavHideId(m.id)) && !(m.id === 'stock' && hiddenNav.has('date.stock')),
  )
  const extraVisible = (section: 'operations' | 'rnd') =>
    NAV_EXTRAS.filter(
      x =>
        x.section === section &&
        !hiddenNav.has(sidebarNavHideId(x.id)) &&
        !(x.hideKey && hiddenNav.has(x.hideKey)) &&
        (x.superAdminOnly
          ? effectiveIsSuperAdmin
          : x.follows
            ? canShowModule(access, x.follows, effectiveIsSuperAdmin)
            : true),
    )
  const opsItems = [
    ...visibleOps.map(m => ({ id: m.id as string, path: m.path })),
    ...extraVisible('operations').map(x => ({ id: x.id, path: x.path })),
  ]
  const rndItems = extraVisible('rnd').map(x => ({ id: x.id, path: x.path }))
  const rowCount = allRows.length
  const debtCount = debtRows.length

  function refreshData() {
    queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
  }

  const sidebar = (
    <aside className={`dashboard-sidebar${sidebarOpen ? ' is-open' : ''}${rail ? ' is-rail' : ''}`}>
      <button
        type="button"
        className="rail-toggle"
        onClick={toggleRail}
        aria-pressed={rail}
        aria-label={rail ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
        title={rail ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
      >
        {(rail ? !isRtl : isRtl) ? '»' : '«'}
      </button>
      <div className="sidebar-label">{t('nav.navigation')}</div>
      <nav>
        {visibleMain.map(m => (
          <NavLink
            key={m.id}
            to={m.path}
            onClick={() => {
              setSidebarOpen(false)
              if (m.id === 'oversite') showOversiteDashboard()
            }}
            title={rail ? navLabel(locale, m.id) : undefined}
            className={({ isActive }) =>
              `nav-btn${m.id === 'oversite' ? ' oversite-nav' : ''}${isActive ? ' active' : ''}`
            }
          >
            <NavIcon id={m.id} />
            <span className="nav-txt">{navLabel(locale, m.id)}</span>
          </NavLink>
        ))}
        {rndItems.length > 0 && (
          <>
            <div className="sidebar-label" style={{ marginTop: 8 }}>
              {t('nav.rnd')}
            </div>
            {rndItems.map(m => (
              <NavLink
                key={m.id}
                to={m.path}
                onClick={() => setSidebarOpen(false)}
                title={rail ? navLabel(locale, m.id) : undefined}
                className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
              >
                <NavIcon id={m.id} />
                <span className="nav-txt">{navLabel(locale, m.id)}</span>
              </NavLink>
            ))}
          </>
        )}
        {opsItems.length > 0 && (
          <>
            <div className="sidebar-label" style={{ marginTop: 8 }}>
              {t('nav.operations')}
            </div>
            {opsItems.map(m => (
              <NavLink
                key={m.id}
                to={m.path}
                onClick={() => setSidebarOpen(false)}
                title={rail ? navLabel(locale, m.id) : undefined}
                className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
              >
                <NavIcon id={m.id} />
                <span className="nav-txt">{navLabel(locale, m.id)}</span>
              </NavLink>
            ))}
          </>
        )}
        {(isSuperAdmin || canManageUsers) && (
          <>
            <div className="sidebar-label" style={{ marginTop: 8 }}>
              {t('nav.admin')}
            </div>
            {canManageUsers && (
              <NavLink
                to="/admin/users"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
              >
                <NavIcon id="nav.adminUsers" />
                <span className="nav-txt">{t('nav.adminUsers')}</span>
              </NavLink>
            )}
            {isSuperAdmin && (
            <NavLink
              to="/admin/classes"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
            >
              <NavIcon id="nav.adminClasses" />
                <span className="nav-txt">{t('nav.adminClasses')}</span>
            </NavLink>
            )}
            {isSuperAdmin && (
            <NavLink
              to="/admin/modules"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
            >
              <NavIcon id="nav.adminModules" />
                <span className="nav-txt">{t('nav.adminModules')}</span>
            </NavLink>
            )}
            {isSuperAdmin && (
            <NavLink
              to="/admin/chains"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
            >
              <NavIcon id="nav.adminChains" />
                <span className="nav-txt">{t('nav.adminChains')}</span>
            </NavLink>
            )}
            {canManageUsers && (
            <NavLink
              to="/admin/data-health"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
            >
              <NavIcon id="nav.adminDataHealth" />
                <span className="nav-txt">{t('nav.adminDataHealth')}</span>
              {healthRed > 0 && (
                <span aria-label={`${healthRed} data sources out of date`}
                  style={{ marginInlineStart: 'auto', background: '#c62828', color: '#fff', borderRadius: 999, padding: '0 7px', fontSize: 12, fontWeight: 700, lineHeight: '18px' }}>
                  {healthRed}
                </span>
              )}
            </NavLink>
            )}
          </>
        )}
      </nav>
      {showFilters && (
        <div className="sidebar-filters-wrap">
          <SidebarFilters />
        </div>
      )}
    </aside>
  )

  const main = (
    <main className="dashboard-main">
      <DataHealthBanner canManage={canManageUsers && !isPreviewing} />
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
      <Suspense fallback={<p className="status-msg">{t('common.loading')}</p>}>
        <Outlet />
      </Suspense>
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
          <IntercompanySwitcher />
          <ViewAsSwitcher />
          {skins.length > 1 ? (
            <label className="skin-switch" title={t('common.skin')}>
              <span className="skin-switch-ico" aria-hidden="true">🎨</span>
              <select
                value={skin}
                aria-label={t('common.skin')}
                onChange={e => setSkin(e.target.value as typeof skin)}
              >
                {skins.map(id => (
                  <option key={id} value={id}>{t(`skin.${id}`)}</option>
                ))}
              </select>
            </label>
          ) : null}
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
                {isRefreshing ? (
                  <span
                    className="data-badge-updating"
                    title={t('header.updatingTitle', {
                      time: new Date(dataSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    })}
                  >
                    {' '}· {t('header.updating')}
                  </span>
                ) : null}
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

      {showSuiteDisclaimer ? (
        <div className="dashboard-suite-disclaimer" role="note">
          {t('sm.suite.numbersDisclaimer')}
        </div>
      ) : null}

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

const SIDEBAR_RAIL_KEY = 'sidebar.rail'

/** One small symbol per sidebar button, so the narrow rail still says what each button is. */
const NAV_ICONS: Record<string, string> = {
  oversite: '🏠',
  sales_performance: '📈',
  orders_mtd: '🧾',
  open_orders: '📬',
  returns: '↩',
  debt: '💳',
  stock_alerts: '🔔',
  export: '⬇',
  ops_deliveries: '🚚',
  stock: '📦',
  stock_brand: '🏷',
  stock_history: '🕘',
  items_index: '🗂',
  rnd_monthly: '🔬',
  'nav.adminUsers': '👤',
  'nav.adminClasses': '🔑',
  'nav.adminModules': '🧩',
  'nav.adminDataHealth': '🩺',
  'nav.adminChains': '🔗',
}

function NavIcon({ id }: { id: string }) {
  return (
    <span className="nav-ico" aria-hidden="true">
      {NAV_ICONS[id] ?? '•'}
    </span>
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
