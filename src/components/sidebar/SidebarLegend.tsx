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
