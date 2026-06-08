import { useLayoutEffect, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useDashboardFilters, type DateMode } from '../../context/DashboardFiltersContext'
import { useDashboardData } from '../../hooks/useDashboardData'
import { MONTH_NAMES } from '../../lib/format'
import {
  buildCategoryOptions,
  buildClientOptions,
  buildItemOptions,
  effectiveCompany,
} from '../../lib/salesFilterLists'
import type { LogicalCompany } from '../../types/dashboard'
import { FilterCheckList } from './FilterCheckList'

const COMPANY_BUTTONS: { id: LogicalCompany; label: string }[] = [
  { id: 'pupik', label: '🏢 Pupik' },
  { id: 'mt', label: '🐒 Monkeytime' },
  { id: 'grow', label: '🌱 Grow' },
]

const DATE_TABS: { id: DateMode; label: string }[] = [
  { id: 'range', label: 'From / To' },
  { id: 'months', label: 'Months' },
  { id: 'openorders', label: '📋 Open Orders' },
  { id: 'stock', label: '📦 Stock' },
]

const MONTH_YEARS = [2025, 2026]

export function SidebarFilters() {
  const { access } = useDashboardAccess()
  const f = useDashboardFilters()
  const { rows, isLoading } = useDashboardData()
  const navigate = useNavigate()
  const location = useLocation()
  const allowedCompanies = COMPANY_BUTTONS.filter(c => access?.companies.includes(c.id))

  const effCo = effectiveCompany(f.company, f.dateMode)
  const companyRows = useMemo(
    () => (effCo ? rows.filter(r => r.company === effCo) : []),
    [rows, effCo],
  )

  const clientOptions = useMemo(() => buildClientOptions(companyRows), [companyRows])
  const categoryOptions = useMemo(
    () => (f.catType ? buildCategoryOptions(companyRows, f.catType) : []),
    [companyRows, f.catType],
  )
  const itemOptions = useMemo(
    () =>
      f.catType ? buildItemOptions(companyRows, f.catType, f.selectedCategories) : [],
    [companyRows, f.catType, f.selectedCategories],
  )

  const clientKey = clientOptions.map(o => o.id).join('\0')
  const categoryKey = categoryOptions.map(o => o.id).join('\0')
  const itemKey = itemOptions.map(o => o.id).join('\0')

  useLayoutEffect(() => {
    if (f.view === 'clients' && clientOptions.length) {
      f.initClientIds(clientOptions.map(o => o.id))
    }
  }, [f.view, f.company, f.dateMode, clientKey])

  useLayoutEffect(() => {
    if (f.view === 'items' && f.catType && categoryOptions.length) {
      f.initCategoryIds(categoryOptions.map(o => o.id))
    }
  }, [f.view, f.catType, f.company, f.dateMode, categoryKey])

  useLayoutEffect(() => {
    if (f.view === 'items' && f.catType && itemOptions.length) {
      f.initItemIds(itemOptions.map(o => o.id))
    }
  }, [f.view, f.catType, itemKey, f.selectedCategories])

  const hasCats = categoryOptions.length > 0

  function handleApply() {
    if (!f.canApply) return

    flushSync(() => {
      if (f.view === 'clients' && clientOptions.length) {
        f.initClientIds(clientOptions.map(o => o.id))
      }
      if (f.view === 'items' && f.catType) {
        if (categoryOptions.length) {
          f.initCategoryIds(categoryOptions.map(o => o.id))
        }
        if (itemOptions.length) {
          f.initItemIds(itemOptions.map(o => o.id))
        }
      }
    })

    f.apply()

    if (!location.pathname.startsWith('/sales')) {
      navigate('/sales')
    }
  }

  return (
    <>
      <div className="sidebar-label">Global Filters</div>

      <div className="panel">
        <div className="panel-title">① Company</div>
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
        <div className="panel-title">② Date Filter</div>
        <div className="tab-row">
          {DATE_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`tab-btn${f.dateMode === t.id ? ' active' : ''}`}
              onClick={() => f.setDateMode(t.id)}
              disabled={!f.company}
            >
              {t.label}
            </button>
          ))}
        </div>

        {f.dateMode === 'range' && (
          <div className="date-range">
            <label>From</label>
            <input
              type="date"
              min="2025-01-01"
              max="2026-12-31"
              value={f.dateFrom}
              onChange={e => f.setDateFrom(e.target.value)}
              disabled={!f.company}
            />
            <label>To</label>
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
            {MONTH_YEARS.map(yr => (
              <div key={yr}>
                <div className="yr-row">
                  <span className="yr-btn" style={{ cursor: 'default', opacity: 0.9 }}>
                    {yr}
                  </span>
                </div>
                <div className="mo-grid">
                  {MONTH_NAMES.map((mn, idx) => {
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
                : 'Select one or more months'}
            </div>
          </div>
        )}

        {(f.dateMode === 'openorders' || f.dateMode === 'stock') && (
          <p className="sel-months-list" style={{ marginTop: 8 }}>
            {f.dateMode === 'openorders' ? 'Shows undelivered orders (721).' : 'Shows warehouse stock view.'}
          </p>
        )}
      </div>

      <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
        <div className="panel-title">③ View</div>
        <div className="btn-grp">
          <button
            type="button"
            className={`btn${f.view === 'clients' ? ' active' : ''}`}
            onClick={() => f.setView('clients')}
            disabled={!f.viewPanelEnabled}
          >
            👥 Clients
          </button>
          <button
            type="button"
            className={`btn${f.view === 'items' ? ' active' : ''}`}
            onClick={() => f.setView('items')}
            disabled={!f.viewPanelEnabled}
          >
            📦 Items
          </button>
        </div>
      </div>

      {f.view === 'clients' && (
        <>
          <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
            <div className="panel-title">④ Select Clients</div>
            {isLoading ? (
              <p className="sel-months-list">Loading clients…</p>
            ) : (
              <FilterCheckList
                items={clientOptions}
                selected={f.selectedClientIds}
                onToggle={f.toggleClientId}
                onSelectVisible={f.selectClientIds}
                onClear={f.clearClientIds}
                searchPlaceholder="Search clients…"
              />
            )}
          </div>

          <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
            <div className="panel-title">⑤ Show Per Client</div>
            <div className="btn-grp">
              <button
                type="button"
                className={`btn${f.clientMode === 'items' ? ' active' : ''}`}
                onClick={() => f.setClientMode('items')}
              >
                📦 Items breakdown
              </button>
              <button
                type="button"
                className={`btn${f.clientMode === 'cash' ? ' active' : ''}`}
                onClick={() => f.setClientMode('cash')}
              >
                💰 Cash summary
              </button>
            </div>
          </div>
        </>
      )}

      {f.view === 'items' && (
        <>
          <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
            <div className="panel-title">④ Item Category Filter</div>
            <div className="btn-grp" style={{ marginBottom: 8 }}>
              <button
                type="button"
                className={`btn${f.catType === 'tablet' ? ' active' : ''}`}
                onClick={() => f.setCatType('tablet')}
              >
                🏷 Tablet Category
              </button>
              <button
                type="button"
                className={`btn${f.catType === 'category' ? ' active' : ''}`}
                onClick={() => f.setCatType('category')}
              >
                📂 Group Category
              </button>
            </div>
            {f.catType && hasCats && (
              <>
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
                  searchPlaceholder="Search categories…"
                  maxHeight={140}
                />
              </>
            )}
            {f.catType && !hasCats && !isLoading && (
              <p className="sel-months-list">No categories found.</p>
            )}
          </div>

          {f.catType && (
            <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
              <div className="panel-title">⑤ Select Items</div>
              {isLoading ? (
                <p className="sel-months-list">Loading items…</p>
              ) : (
                <FilterCheckList
                  items={itemOptions}
                  selected={f.selectedItemSkus}
                  onToggle={f.toggleItemSku}
                  onSelectVisible={f.selectItemSkus}
                  onClear={f.clearItemSkus}
                  searchPlaceholder="Search items…"
                />
              )}
            </div>
          )}

          {f.catType && (
            <div className={`panel${f.viewPanelEnabled ? '' : ' disabled'}`}>
              <div className="panel-title">⑥ Show Per Item</div>
              <div className="btn-grp">
                <button
                  type="button"
                  className={`btn${f.itemMode === 'clients' ? ' active' : ''}`}
                  onClick={() => f.setItemMode('clients')}
                >
                  👥 By Clients
                </button>
                <button
                  type="button"
                  className={`btn${f.itemMode === 'items' ? ' active' : ''}`}
                  onClick={() => f.setItemMode('items')}
                >
                  📦 Items summary
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <button
        type="button"
        className="apply-btn"
        disabled={!f.canApply}
        onClick={handleApply}
      >
        Apply &amp; Render
      </button>
    </>
  )
}
