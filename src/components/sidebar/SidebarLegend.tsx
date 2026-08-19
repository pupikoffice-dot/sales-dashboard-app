import { useEffect, useRef } from 'react'
import type { MessageKey } from '../../i18n/types'
import { useLocale } from '../../context/LocaleContext'

/**
 * "What does this control do?" legend for the sidebar filter chain.
 * See docs/superpowers/specs/2026-08-19-sidebar-legend-design.md for the design.
 *
 *  - The panel is NOT mounted until opened (matches SalesLegend — costs nothing
 *    when unused).
 *  - Auto-opens once ever per browser (not per-variant like SalesLegend, since
 *    this content is comprehensive across all views from the start — see spec).
 *  - Two inline "?" triggers elsewhere in SidebarFilters.tsx can jump the panel
 *    open already scrolled to a specific section; that's what SectionId and
 *    openLegendSection (owned by SidebarFilters) are for.
 */

const STORAGE_KEY = 'dash-sidebar-legend-seen'

export function hasSeenSidebarLegend(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true // storage blocked: treat as already seen, never auto-open (matches SalesLegend)
  }
}

export function markSidebarLegendSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch { /* ignore */ }
}

/** Every jumpable/described section in the legend. Order here is display order. */
export type SectionId =
  | 'company'
  | 'dateFilterRange'
  | 'dateFilterMonths'
  | 'dateFilterOpenOrders'
  | 'dateFilterStock'
  | 'view'
  | 'itemCategory'
  | 'select'
  | 'showModeBreakdown'
  | 'showModeItems'

interface LegendLine {
  id: SectionId
  term: MessageKey
  desc: MessageKey
  /** Interpolation values for {noun}-style keys (select's variant only). */
  values?: Record<string, string>
}

/**
 * Static content, ordered for display. `select`'s {noun} depends on which
 * view is currently active (Clients/Items/Suppliers) — passed in from
 * SidebarFilters via `currentViewNoun` rather than hard-coded, so a user who
 * jumps here from, say, the Items panel sees "Select Items", not "Select
 * Clients". Falls back to "filters.clients" only when no view is selected
 * yet (nothing else to show at the top of a fresh session).
 */
function buildLines(currentViewNoun: string): LegendLine[] {
  return [
    { id: 'company', term: 'sidebarLegend.companyTerm', desc: 'sidebarLegend.companyDesc' },
    { id: 'dateFilterRange', term: 'sidebarLegend.dateFilterRangeTerm', desc: 'sidebarLegend.dateFilterRangeDesc' },
    { id: 'dateFilterMonths', term: 'sidebarLegend.dateFilterMonthsTerm', desc: 'sidebarLegend.dateFilterMonthsDesc' },
    { id: 'dateFilterOpenOrders', term: 'sidebarLegend.dateFilterOpenOrdersTerm', desc: 'sidebarLegend.dateFilterOpenOrdersDesc' },
    { id: 'dateFilterStock', term: 'sidebarLegend.dateFilterStockTerm', desc: 'sidebarLegend.dateFilterStockDesc' },
    { id: 'view', term: 'sidebarLegend.viewTerm', desc: 'sidebarLegend.viewDesc' },
    { id: 'itemCategory', term: 'sidebarLegend.itemCategoryTerm', desc: 'sidebarLegend.itemCategoryDesc' },
    { id: 'select', term: 'sidebarLegend.selectTerm', desc: 'sidebarLegend.selectDesc', values: { noun: currentViewNoun } },
    { id: 'showModeBreakdown', term: 'sidebarLegend.showModeBreakdownTerm', desc: 'sidebarLegend.showModeBreakdownDesc' },
    { id: 'showModeItems', term: 'sidebarLegend.showModeItemsTerm', desc: 'sidebarLegend.showModeItemsDesc' },
  ]
}

export function SidebarLegend({
  openSection,
  onOpenChange,
  view,
}: {
  /** `null` = closed. A SectionId = open and scrolled to that section. */
  openSection: SectionId | null
  onOpenChange: (next: SectionId | null) => void
  /** Current sidebar view, so the `select` section's {noun} matches it. */
  view: 'clients' | 'items' | 'suppliers' | null
}) {
  const { t } = useLocale()
  const panelRef = useRef<HTMLDivElement>(null)
  const currentViewNoun =
    view === 'items' ? t('filters.items') : view === 'suppliers' ? t('filters.suppliers') : t('filters.clients')

  // Auto-open once ever, on mount, if never seen and not already controlled open.
  useEffect(() => {
    if (openSection === null && !hasSeenSidebarLegend()) {
      onOpenChange('company')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to the target section once the panel is in the DOM.
  useEffect(() => {
    if (!openSection || !panelRef.current) return
    const el = panelRef.current.querySelector(`[data-section="${openSection}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [openSection])

  function close() {
    onOpenChange(null)
    markSidebarLegendSeen()
  }

  const lines = buildLines(currentViewNoun)

  return (
    <>
      <button
        type="button"
        className="legend-btn"
        aria-expanded={openSection !== null}
        title={t('sidebarLegend.help')}
        onClick={() => (openSection !== null ? close() : onOpenChange('company'))}
      >
        ? {t('sidebarLegend.help')}
      </button>

      {openSection !== null && (
        <div
          ref={panelRef}
          className="legend-panel"
          role="region"
          aria-label={t('sidebarLegend.help')}
        >
          <div className="legend-hdr">
            <span>💡 {t('sidebarLegend.title')}</span>
            <button type="button" className="legend-close" onClick={close}>
              ✕
            </button>
          </div>

          <dl className="legend-terms">
            {lines.map(l => (
              <div key={l.id} data-section={l.id} className="legend-term-row">
                <dt>{t(l.term, l.values)}</dt>
                <dd>{t(l.desc, l.values)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  )
}
