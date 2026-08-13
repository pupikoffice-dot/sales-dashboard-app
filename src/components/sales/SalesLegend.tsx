import { useEffect, useState } from 'react'
import type { DashboardFiltersState } from '../../context/DashboardFiltersContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { usePreview } from '../../context/PreviewContext'
import type { MessageKey } from '../../i18n/types'
import { canShowClientProfit } from '../../lib/permissions'
import { DualMonthCell } from './DualMonthCell'

/**
 * "What am I looking at?" legend for the sales reports.
 *
 * Design constraints (users are mostly on phones):
 *  - The panel is NOT mounted until opened, so it costs nothing on large reports.
 *  - Column micro-labels live in <thead> (see DualMonthGroupedTable /
 *    clientItemsBreakdownHtml) and carry the at-a-glance meaning; this panel is
 *    the deeper explanation.
 *  - Opens itself the first time a user meets a given report shape, then stays
 *    closed once dismissed (remembered per browser).
 *
 * The anatomy diagram renders a REAL <DualMonthCell>, so the example can never
 * drift from what the table actually draws.
 */

const STORAGE_PREFIX = 'dash-legend-seen:'

/** Identifies a report shape — drives both the copy and the "seen" memory. */
function legendVariant(f: DashboardFiltersState): string {
  if (f.dateMode === 'stock') return 'stock'
  const period = f.dateMode === 'months' ? 'months' : 'range'
  if (f.view === 'clients') return `clients-${f.clientMode ?? 'items'}-${period}`
  if (f.view === 'items') return `items-${f.itemMode ?? 'items'}-${period}`
  if (f.view === 'suppliers') return `suppliers-${f.supplierMode ?? 'items'}-${period}`
  return `other-${period}`
}

function hasSeen(variant: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + variant) === '1'
  } catch {
    return true // storage blocked: never auto-open rather than nag every render
  }
}

function markSeen(variant: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + variant, '1')
  } catch { /* ignore */ }
}

/** One explanation line: a term and what it means. */
interface LegendLine {
  term: MessageKey
  desc: MessageKey
}

function linesFor(f: DashboardFiltersState, showPrice: boolean): LegendLine[] {
  const lines: LegendLine[] = []

  if (f.dateMode === 'months') {
    lines.push({ term: 'legend.totalCashTerm', desc: 'legend.totalCashDesc' })
  }
  lines.push({ term: 'legend.stockTerm', desc: 'legend.stockDesc' })
  if (showPrice) lines.push({ term: 'legend.priceTerm', desc: 'legend.priceDesc' })
  lines.push({ term: 'legend.filterTerm', desc: 'legend.filterDesc' })
  lines.push({ term: 'legend.sortTerm', desc: 'legend.sortDesc' })
  return lines
}

export function SalesLegend({ filters }: { filters: DashboardFiltersState }) {
  const { t } = useLocale()
  const { access } = useDashboardAccess()
  const { effectiveIsSuperAdmin } = usePreview()
  // Only describe the Price column when this user can actually see it — and
  // honour the "View as" preview, so a previewed user gets their own legend.
  const showPrice = canShowClientProfit(access, effectiveIsSuperAdmin)
  const variant = legendVariant(filters)
  const [open, setOpen] = useState(false)

  // Auto-open once per report shape, then remember the dismissal.
  useEffect(() => {
    if (!hasSeen(variant)) setOpen(true)
  }, [variant])

  function close() {
    setOpen(false)
    markSeen(variant)
  }

  const isMonths = filters.dateMode === 'months'

  return (
    <>
      <button
        type="button"
        className="legend-btn"
        aria-expanded={open}
        title={t('legend.help')}
        onClick={() => (open ? close() : setOpen(true))}
      >
        ? {t('legend.help')}
      </button>

      {open && (
        <div className="legend-panel" role="region" aria-label={t('legend.help')}>
          <div className="legend-hdr">
            <span>💡 {t('legend.title')}</span>
            <button type="button" className="legend-close" onClick={close}>
              ✕
            </button>
          </div>

          {isMonths && (
            <div className="legend-anatomy">
              {/* A real cell, so the example always matches the table. */}
              <table className="legend-sample">
                <tbody>
                  <tr>
                    <DualMonthCell curCash={79} curQty={2} prevCash={0} prevQty={0} />
                  </tr>
                </tbody>
              </table>
              <ol className="legend-callouts">
                <li>
                  <b>79</b> — {t('legend.curCash')}
                </li>
                <li>
                  <b>(2)</b> — {t('legend.curQty')}
                </li>
                <li>
                  <b>0</b> — {t('legend.prevCash')}
                </li>
                <li>
                  <b>(0)</b> — {t('legend.prevQty')}
                </li>
              </ol>
              <p className="legend-note">{t('legend.orangeNote')}</p>
            </div>
          )}

          <dl className="legend-terms">
            {linesFor(filters, showPrice).map(l => (
              <div key={l.term} className="legend-term-row">
                <dt>{t(l.term)}</dt>
                <dd>{t(l.desc)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  )
}
