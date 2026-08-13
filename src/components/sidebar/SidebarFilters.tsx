import { useLayoutEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePreview } from '../../context/PreviewContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useDashboardFilters, type DateMode } from '../../context/DashboardFiltersContext'
import { useLocale } from '../../context/LocaleContext'
import { useDashboardData } from '../../hooks/useDashboardData'
import { effectiveCompany } from '../../lib/salesFilterLists'
import {
  getIndexedCategoryOptions,
  getIndexedClientOptions,
  getIndexedItemOptions,
  getIndexedSupplierOptions,
} from '../../lib/salesFilterIndex'
import type { LogicalCompany } from '../../types/dashboard'
import { FilterCheckList } from './FilterCheckList'

const COMPANY_BUTTONS: { id: LogicalCompany; label: string }[] = [
  { id: 'pupik', label: '🏢 Pupik' },
  { id: 'mt', label: '🐒 Monkeytime' },
  { id: 'grow', label: '🌱 Grow' },
  { id: 'gold', label: '🥇 Gold' },
]

const DATE_TAB_KEYS: { id: DateMode; key: 'filters.fromTo' | 'filters.months' | 'filters.openOrders' | 'filters.stock' }[] = [
  { id: 'range', key: 'filters.fromTo' },
  { id: 'months', key: 'filters.months' },
  { id: 'openorders', key: 'filters.openOrders' },
  { id: 'stock', key: 'filters.stock' },
]

const MONTH_YEARS = [2025, 2026]

export function SidebarFilters() {
  // Honours the super-admin "View as user" preview.
  const { effectiveIsSuperAdmin: isSuperAdmin } = usePreview()
  const { access } = useDashboardAccess()
  const f = useDashboardFilters()
  const { t, monthNames } = useLocale()
  const { filterIndex, isLoading, isFetching } = useDashboardData()
  const dataBusy = isLoading || isFetching
  const navigate = useNavigate()
  const location = useLocation()
  const allowedCompanies = COMPANY_BUTTONS.filter(c => access?.companies.includes(c.id))

  const companyTag = useMemo(
    () => effectiveCompany(f.company, f.dateMode),
    [f.company, f.dateMode],
  )

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

  function handleApply() {
    if (!f.canApply || f.isRendering) return

    window.setTimeout(() => {
      f.apply()

      if (!isSuperAdmin) {
        if (!location.pathname.startsWith('/oversite')) navigate('/oversite')
        return
      }

      if (f.dateMode === 'openorders') {
        if (!location.pathname.startsWith('/open-orders')) navigate('/open-orders')
      } else if (!location.pathname.startsWith('/sales')) {
        navigate('/sales')
      }
    }, 0)
  }

  return (
    <>
      <div className="sidebar-label">{t('filters.global')}</div>

      <div className="panel">
        <div className="panel-title">① {t('filters.company')}</div>
        <div className="btn-grp">
          {allowedCompanies.map(c => (
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
          {DATE_TAB_KEYS.map(tab => (
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
              {tab.id === 'openorders' ? `📋 ${t(tab.key)}` : tab.id === 'stock' ? `📦 ${t(tab.key)}` : t(tab.key)}
            </button>
          ))}
        </div>

        {f.dateMode === 'range' && (
          <div className="date-range">
            <label>{t('filters.from')}</label>
            <input
              type="date"
              min="2025-01-01"
              max="2026-12-31"
              value={f.dateFrom}
              onChange={e => f.setDateFrom(e.target.value)}
              disabled={!f.company}
            />
            <label>{t('filters.to')}</label>
            <input
              type="date"
              min="2025-01-01"
              max="2026-12-31"
              value={f.dateTo}
              onChange={e => f.setDateTo(e.target.value)}
              disabled={!f.company}
            />
          </div>
        )}

        {f.dateMode === 'months' && (
          <div className="months-picker active">
            <div className="yr-row">
              {MONTH_YEARS.map(yr => (
                <button
                  key={yr}
                  type="button"
                  className="yr-btn"
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
            {MONTH_YEARS.map(yr => (
              <div key={yr} style={yr === 2025 ? { marginTop: 6 } : undefined}>
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
          >
            👥 {t('filters.clients')}
          </button>
          <button
            type="button"
            className={`btn${f.view === 'items' ? ' active' : ''}`}
            onClick={() => f.setView('items')}
            disabled={!f.viewPanelEnabled}
          >
            📦 {t('filters.items')}
          </button>
          <button
            type="button"
            className={`btn${f.view === 'suppliers' ? ' active' : ''}`}
            onClick={() => f.setView('suppliers')}
            disabled={!f.viewPanelEnabled}
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
              >
                📦 {t('filters.itemsBreakdown')}
              </button>
              <button
                type="button"
                className={`btn${f.clientMode === 'cash' ? ' active' : ''}`}
                onClick={() => f.setClientMode('cash')}
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
            <div className="panel-title">④ {t('filters.itemCategory')}</div>
            <div className="btn-grp" style={{ marginBottom: 8 }}>
              <button
                type="button"
                className={`btn${f.catType === 'tablet' ? ' active' : ''}`}
                onClick={() => f.setCatType('tablet')}
              >
                🏷 {t('filters.tabletCategory')}
              </button>
              <button
                type="button"
                className={`btn${f.catType === 'category' ? ' active' : ''}`}
                onClick={() => f.setCatType('category')}
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
                onClear={f.clearCategoryIds}
                searchPlaceholder={t('filters.searchCategories')}
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
                  onClear={f.clearItemSkus}
                  searchPlaceholder={t('filters.searchItems')}
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
                >
                  👥 {t('filters.byClients')}
                </button>
                <button
                  type="button"
                  className={`btn${f.itemMode === 'items' ? ' active' : ''}`}
                  onClick={() => f.setItemMode('items')}
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
              >
                📦 {t('filters.itemsBreakdown')}
              </button>
              <button
                type="button"
                className={`btn${f.supplierMode === 'cash' ? ' active' : ''}`}
                onClick={() => f.setSupplierMode('cash')}
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
