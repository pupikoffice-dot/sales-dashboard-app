import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePreview } from '../../context/PreviewContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useDashboardFilters, type DateMode } from '../../context/DashboardFiltersContext'
import { useLocale } from '../../context/LocaleContext'
import { useDashboardData } from '../../hooks/useDashboardData'
import { effectiveCompany } from '../../lib/salesFilterLists'
import { yearsInCompanySales } from '../../lib/salesDateFilter'
import { canShowModule } from '../../lib/permissions'
import {
  getIndexedCategoryOptions,
  getIndexedClientOptions,
  getIndexedItemOptions,
  getIndexedSupplierOptions,
} from '../../lib/salesFilterIndex'
import type { LogicalCompany } from '../../types/dashboard'
import { FilterCheckList } from './FilterCheckList'
import { SidebarLegend, type SectionId } from './SidebarLegend'

const COMPANY_BUTTONS: { id: LogicalCompany; label: string }[] = [
  { id: 'pupik', label: '🏢 Pupik' },
  { id: 'mt', label: '🐒 Monkeytime' },
  { id: 'grow', label: '🌱 Grow' },
  { id: 'gold', label: '🥇 Goldbug' },
]

// Stock and Items now live under Operations in the sidebar, not here.
const DATE_TAB_KEYS: { id: DateMode; key: 'filters.fromTo' | 'filters.months' | 'filters.openOrders' }[] = [
  { id: 'range', key: 'filters.fromTo' },
  { id: 'months', key: 'filters.months' },
  { id: 'openorders', key: 'filters.openOrders' },
]

export function SidebarFilters() {
  // Honours the super-admin "View as user" preview.
  const { effectiveIsSuperAdmin: isSuperAdmin } = usePreview()
  const { access } = useDashboardAccess()
  const f = useDashboardFilters()
  const { t, monthNames } = useLocale()
  const { filterIndex, isLoading, isFetching, rows, yearInfos, loadedYears, loadYear, loadingYears } = useDashboardData()
  const dataBusy = isLoading || isFetching
  const navigate = useNavigate()
  const location = useLocation()
  const [openLegendSection, setOpenLegendSection] = useState<SectionId | null>(null)
  const allowedCompanies = COMPANY_BUTTONS.filter(c => access?.companies.includes(c.id))

  const companyTag = useMemo(
    () => effectiveCompany(f.company, f.dateMode),
    [f.company, f.dateMode],
  )
  const monthYears = useMemo(() => {
    const loaded = yearsInCompanySales(rows, f.dateMode === 'openorders' ? f.company : companyTag)
    if (!f.company) return loaded
    // older years the database has for this company, not downloaded yet: listed so they can be picked (they load then)
    const all = new Set<number>(loaded)
    for (const i of yearInfos) if (i.company === f.company) all.add(i.year)
    return [...all].sort((a, b) => a - b)
  }, [rows, yearInfos, f.dateMode, f.company, companyTag])
  const isUnloaded = (yr: number) => loadedYears !== null && !loadedYears.includes(yr)

  // Years the current date choice needs: months picked, or the span of the date range.
  const neededYears = useMemo(() => {
    const years = new Set<number>()
    if (f.dateMode === 'months') {
      for (const key of f.selectedMonths) years.add(Number(key.split('-')[0]))
    } else if (f.dateMode === 'range') {
      const a = Number(f.dateFrom.slice(0, 4))
      const b = Number(f.dateTo.slice(0, 4))
      if (a > 1999) for (let y = a; y <= (b > 1999 ? b : a); y++) years.add(y)
    }
    return [...years].filter(y => Number.isInteger(y) && isUnloaded(y))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isUnloaded reads loadedYears
  }, [f.dateMode, f.selectedMonths, f.dateFrom, f.dateTo, loadedYears])
  useEffect(() => {
    for (const y of neededYears) void loadYear(y)
  }, [neededYears, loadYear])
  const earliest = `${monthYears[0]}-01-01`
  const latest = `${monthYears[monthYears.length - 1]}-12-31`

  useLayoutEffect(() => {
    if (!f.company && allowedCompanies.length === 1) {
      f.setCompany(allowedCompanies[0].id)
    }
  }, [f.company, allowedCompanies])

  const clientOptions = useMemo(
    () => getIndexedClientOptions(filterIndex, companyTag),
    [filterIndex, companyTag],
  )
  const categoryOptions = useMemo(
    () => (f.catType ? getIndexedCategoryOptions(filterIndex, companyTag, f.catType) : []),
    [filterIndex, companyTag, f.catType],
  )
  const itemOptions = useMemo(
    () =>
      f.catType
        ? getIndexedItemOptions(filterIndex, companyTag, f.catType, f.selectedCategories)
        : [],
    [filterIndex, companyTag, f.catType, f.selectedCategories],
  )

  const supplierOptions = useMemo(
    () => getIndexedSupplierOptions(filterIndex, companyTag),
    [filterIndex, companyTag],
  )

  const clientKey = clientOptions.map(o => o.id).join('\0')
  const categoryKey = categoryOptions.map(o => o.id).join('\0')
  const itemKey = itemOptions.map(o => o.id).join('\0')
  const supplierKey = supplierOptions.map(o => o.id).join('\0')

  useLayoutEffect(() => {
    if (f.view === 'clients' && clientOptions.length) {
      f.initClientIds(clientOptions.map(o => o.id))
    }
  }, [f.view, f.company, f.dateMode, clientKey, f.clientListEpoch])

  useLayoutEffect(() => {
    if (f.view === 'items' && f.catType && categoryOptions.length) {
      f.initCategoryIds(categoryOptions.map(o => o.id))
    }
  }, [f.view, f.catType, f.company, f.dateMode, categoryKey, f.categoryListEpoch])

  useLayoutEffect(() => {
    if (f.view === 'items' && f.catType && itemOptions.length) {
      f.initItemIds(itemOptions.map(o => o.id))
    }
  }, [f.view, f.catType, itemKey, f.itemListEpoch])

  useLayoutEffect(() => {
    if (f.view === 'suppliers' && supplierOptions.length) {
      f.initSupplierIds(supplierOptions.map(o => o.id))
    }
  }, [f.view, f.company, f.dateMode, supplierKey, f.supplierListEpoch])

  const hasCats = categoryOptions.length > 0

  async function handleApply() {
    if (!f.canApply || f.isRendering) return
    // Older years are downloaded only when asked for: make sure the chosen ones are in before rendering.
    if (neededYears.length) await Promise.all(neededYears.map(loadYear))

    window.setTimeout(() => {
      f.apply()

      if (f.dateMode === 'openorders') {
        if (canShowModule(access, 'open_orders', isSuperAdmin)) {
          if (!location.pathname.startsWith('/open-orders')) navigate('/open-orders')
        }
      } else if (f.dateMode === 'stock') {
        if (canShowModule(access, 'stock', isSuperAdmin)) {
          if (!location.pathname.startsWith('/stock')) navigate('/stock')
        }
      } else if (canShowModule(access, 'sales_performance', isSuperAdmin)) {
        if (!location.pathname.startsWith('/sales')) navigate('/sales')
      }
    }, 0)
  }

  return (
    <>
      <div className="sidebar-label-row">
        <div className="sidebar-label">{t('filters.global')}</div>
        <SidebarLegend openSection={openLegendSection} onOpenChange={setOpenLegendSection} view={f.view} />
      </div>

      <div className="panel">
        <div className="panel-title">① {t('filters.company')}</div>
        <div className="btn-grp">
          {allowedCompanies
            .filter(c => !access?.hiddenSidebar?.includes(`company.${c.id}`))
            .map(c => (
            <button
              key={c.id}
              type="button"
              className={`btn${f.company === c.id ? ' active' : ''}`}
              onClick={() => f.setCompany(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`panel${f.company ? '' : ' disabled'}`}>
        <div className="panel-title">② {t('filters.dateFilter')}</div>
        <div className="tab-row">
          {DATE_TAB_KEYS.filter(tab => !access?.hiddenSidebar?.includes(`date.${tab.id}`)).map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`tab-btn${f.dateMode === tab.id ? ' active' : ''}`}
              onClick={() => {
                f.setDateMode(tab.id)
                if (isSuperAdmin && tab.id === 'openorders') navigate('/open-orders')
              }}
              disabled={!f.company}
            >
              {tab.id === 'openorders' ? `📋 ${t(tab.key)}` : t(tab.key)}
            </button>
          ))}
          <button
            type="button"
            className="legend-btn legend-btn-sm"
            title={t('sidebarLegend.help')}
            aria-label={t('sidebarLegend.help')}
            onClick={() => setOpenLegendSection('dateFilterOpenOrders')}
          >
            ?
          </button>
        </div>

        {f.dateMode === 'range' && (
          <div className="date-range">
            <label>{t('filters.from')}</label>
            <input
              type="date"
              min={earliest}
              max={latest}
              value={f.dateFrom}
              onChange={e => f.setDateFrom(e.target.value)}
              disabled={!f.company}
            />
            <label>{t('filters.to')}</label>
            <input
              type="date"
              min={earliest}
              max={latest}
              value={f.dateTo}
              onChange={e => f.setDateTo(e.target.value)}
              disabled={!f.company}
            />
            {loadingYears.length ? (
              <p className="sel-months-list" role="status">
                {t('filters.loadingYears')} {loadingYears.join(', ')}…
              </p>
            ) : null}
          </div>
        )}

        {f.dateMode === 'months' && (
          <div className="months-picker active">
            <div className="yr-row">
              {monthYears.map(yr => (
                <button
                  key={yr}
                  type="button"
                  className={`yr-btn${isUnloaded(yr) ? ' yr-btn--later' : ''}`}
                  title={isUnloaded(yr) ? t('filters.yearLoadsOnPick') : undefined}
                  onClick={() => f.toggleYearMonths(yr)}
                  disabled={!f.company}
                >
                  {yr}
                </button>
              ))}
              <button
                type="button"
                className="yr-btn"
                onClick={() => f.clearMonths()}
                disabled={!f.company}
              >
                {t('common.clear')}
              </button>
            </div>
            {monthYears.map((yr, index) => (
              <div key={yr} style={index > 0 ? { marginTop: 6 } : undefined}>
                <div style={{ fontSize: '.67rem', color: 'var(--muted)', marginBottom: 4, letterSpacing: '.8px' }}>
                  {yr}
                </div>
                <div className="mo-grid">
                  {monthNames.map((mn, idx) => {
                    const key = `${yr}-${idx + 1}`
                    const sel = f.selectedMonths.has(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`mo-btn${sel ? ' sel' : ''}`}
                        onClick={() => f.toggleMonth(key)}
                        disabled={!f.company}
                      >
                        {mn}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {loadingYears.length ? (
              <p className="sel-months-list" role="status">
                {t('filters.loadingYears')} {loadingYears.join(', ')}…
              </p>
            ) : null}
            <div className="sel-months-list">
              {f.selectedMonths.size
                ? [...f.selectedMonths].sort().join(', ')
                : t('filters.selectMonths')}
            </div>
          </div>
        )}

        {(f.dateMode === 'openorders' || f.dateMode === 'stock') && (
          <p className="sel-months-list" style={{ marginTop: 8 }}>
            {f.dateMode === 'openorders' ? t('filters.openOrdersHint') : t('filters.stockHint')}
          </p>
        )}
      </div>

      <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
        <div className="panel-title">③ {t('filters.view')}</div>
        <div className="btn-grp">
          <button
            type="button"
            className={`btn${f.view === 'clients' ? ' active' : ''}`}
            onClick={() => f.setView('clients')}
            disabled={!f.viewPanelEnabled}
            hidden={access?.hiddenSidebar?.includes('view.clients')}
          >
            👥 {t('filters.clients')}
          </button>
          <button
            type="button"
            className={`btn${f.view === 'items' ? ' active' : ''}`}
            onClick={() => f.setView('items')}
            disabled={!f.viewPanelEnabled}
            hidden={access?.hiddenSidebar?.includes('view.items')}
          >
            📦 {t('filters.items')}
          </button>
          <button
            type="button"
            className={`btn${f.view === 'suppliers' ? ' active' : ''}`}
            onClick={() => f.setView('suppliers')}
            disabled={!f.viewPanelEnabled}
            hidden={access?.hiddenSidebar?.includes('view.suppliers')}
          >
            🏭 {t('filters.suppliers')}
          </button>
        </div>
      </div>

      {f.view === 'clients' && (
        <>
          <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
            <div className="panel-title">④ {t('filters.selectClients')}</div>
            {dataBusy || !filterIndex ? (
              <p className="sel-months-list">{t('filters.loadingClients')}</p>
            ) : (
              <FilterCheckList
                items={clientOptions}
                selected={f.selectedClientIds}
                onToggle={f.toggleClientId}
                onSelectVisible={f.selectClientIds}
                onSetSelected={f.setClientIds}
                onClear={f.clearClientIds}
                searchPlaceholder={t('filters.searchClients')}
              />
            )}
          </div>

          <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
            <div className="panel-title">⑤ {t('filters.showPerClient')}</div>
            <div className="btn-grp">
              <button
                type="button"
                className={`btn${f.clientMode === 'items' ? ' active' : ''}`}
                onClick={() => f.setClientMode('items')}
                hidden={access?.hiddenSidebar?.includes('clientMode.items')}
              >
                📦 {t('filters.itemsBreakdown')}
              </button>
              <button
                type="button"
                className={`btn${f.clientMode === 'cash' ? ' active' : ''}`}
                onClick={() => f.setClientMode('cash')}
                hidden={access?.hiddenSidebar?.includes('clientMode.cash')}
              >
                💰 {t('filters.cashSummary')}
              </button>
            </div>
          </div>
        </>
      )}

      {f.view === 'items' && (
        <>
          <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
            <div className="panel-title-row">
              <div className="panel-title">④ {t('filters.itemCategory')}</div>
              <button
                type="button"
                className="legend-btn legend-btn-sm"
                title={t('sidebarLegend.help')}
                aria-label={t('sidebarLegend.help')}
                onClick={() => setOpenLegendSection('itemCategory')}
              >
                ?
              </button>
            </div>
            <div className="btn-grp" style={{ marginBottom: 8 }}>
              <button
                type="button"
                className={`btn${f.catType === 'tablet' ? ' active' : ''}`}
                onClick={() => f.setCatType('tablet')}
                hidden={access?.hiddenSidebar?.includes('cat.tablet')}
              >
                🏷 {t('filters.tabletCategory')}
              </button>
              <button
                type="button"
                className={`btn${f.catType === 'category' ? ' active' : ''}`}
                onClick={() => f.setCatType('category')}
                hidden={access?.hiddenSidebar?.includes('cat.group')}
              >
                📂 {t('filters.groupCategory')}
              </button>
            </div>
            {f.catType && hasCats && (
              <FilterCheckList
                items={categoryOptions}
                selected={f.selectedCategories}
                onToggle={id => {
                  f.toggleCategoryId(id)
                }}
                onSelectVisible={ids => {
                  f.selectCategoryIds(ids)
                }}
                onSetSelected={f.setCategoryIds}
                onClear={f.clearCategoryIds}
                searchPlaceholder={t('filters.searchCategories')}
                match="prefix"
                maxHeight={140}
              />
            )}
            {f.catType && !hasCats && !dataBusy && filterIndex && (
              <p className="sel-months-list">{t('filters.noCategories')}</p>
            )}
          </div>

          {f.catType && (
            <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
              <div className="panel-title">⑤ {t('filters.selectItems')}</div>
              {dataBusy || !filterIndex ? (
                <p className="sel-months-list">{t('filters.loadingItems')}</p>
              ) : (
                <FilterCheckList
                  items={itemOptions}
                  selected={f.selectedItemSkus}
                  onToggle={f.toggleItemSku}
                  onSelectVisible={f.selectItemSkus}
                  onSetSelected={f.setItemSkus}
                  onClear={f.clearItemSkus}
                  searchPlaceholder={t('filters.searchItems')}
                  skuFilter
                  skuPlaceholder={t('filters.searchSku')}
                />
              )}
            </div>
          )}

          {f.catType && (
            <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
              <div className="panel-title">⑥ {t('filters.showPerItem')}</div>
              <div className="btn-grp">
                <button
                  type="button"
                  className={`btn${f.itemMode === 'clients' ? ' active' : ''}`}
                  onClick={() => f.setItemMode('clients')}
                hidden={access?.hiddenSidebar?.includes('itemMode.clients')}
                >
                  👥 {t('filters.byClients')}
                </button>
                <button
                  type="button"
                  className={`btn${f.itemMode === 'items' ? ' active' : ''}`}
                  onClick={() => f.setItemMode('items')}
                hidden={access?.hiddenSidebar?.includes('itemMode.items')}
                >
                  📦 {t('filters.itemsSummary')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {f.view === 'suppliers' && (
        <>
          <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
            <div className="panel-title">④ {t('filters.selectSuppliers')}</div>
            {dataBusy || !filterIndex ? (
              <p className="sel-months-list">{t('filters.loadingSuppliers')}</p>
            ) : supplierOptions.length ? (
              <FilterCheckList
                items={supplierOptions}
                selected={f.selectedSuppliers}
                onToggle={f.toggleSupplierId}
                onSelectVisible={f.selectSupplierIds}
                onSetSelected={f.setSupplierIds}
                onClear={f.clearSupplierIds}
                searchPlaceholder={t('filters.searchSuppliers')}
              />
            ) : (
              <p className="sel-months-list">{t('filters.noSuppliers')}</p>
            )}
          </div>

          <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
            <div className="panel-title">⑤ {t('filters.showPerSupplier')}</div>
            <div className="btn-grp">
              <button
                type="button"
                className={`btn${f.supplierMode === 'items' ? ' active' : ''}`}
                onClick={() => f.setSupplierMode('items')}
                hidden={access?.hiddenSidebar?.includes('supplierMode.items')}
              >
                📦 {t('filters.itemsBreakdown')}
              </button>
              <button
                type="button"
                className={`btn${f.supplierMode === 'cash' ? ' active' : ''}`}
                onClick={() => f.setSupplierMode('cash')}
                hidden={access?.hiddenSidebar?.includes('supplierMode.cash')}
              >
                💰 {t('filters.cashSummary')}
              </button>
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        className={`apply-btn${f.isRendering ? ' is-loading' : ''}`}
        disabled={!f.canApply || f.isRendering}
        onClick={handleApply}
      >
        {f.isRendering ? (
          <>
            <span className="apply-btn-spin" aria-hidden />
            {t('filters.rendering')}
          </>
        ) : (
          t('filters.applyRender')
        )}
      </button>
    </>
  )
}
