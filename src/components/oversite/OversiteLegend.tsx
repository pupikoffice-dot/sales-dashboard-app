import { useEffect, useState } from 'react'
import type { MessageKey } from '../../i18n/types'
import { useLocale } from '../../context/LocaleContext'

/**
 * "What am I seeing?" legend for Oversight (Legend Stage 3).
 * Matches SalesLegend / SidebarLegend: panel not mounted until open;
 * auto-opens once ever per browser, then remembers dismissal.
 */

const STORAGE_KEY = 'dash-oversite-legend-seen'

function hasSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}

interface LegendLine {
  term: MessageKey
  desc: MessageKey
}

const LINES: LegendLine[] = [
  { term: 'oversiteLegend.doc36Term', desc: 'oversiteLegend.doc36Desc' },
  { term: 'oversiteLegend.doc722Term', desc: 'oversiteLegend.doc722Desc' },
  { term: 'oversiteLegend.doc721Term', desc: 'oversiteLegend.doc721Desc' },
  { term: 'oversiteLegend.doc720Term', desc: 'oversiteLegend.doc720Desc' },
  { term: 'oversiteLegend.salesBarTerm', desc: 'oversiteLegend.salesBarDesc' },
  { term: 'oversiteLegend.projectedTerm', desc: 'oversiteLegend.projectedDesc' },
  { term: 'oversiteLegend.debtTerm', desc: 'oversiteLegend.debtDesc' },
  { term: 'oversiteLegend.receiptsTerm', desc: 'oversiteLegend.receiptsDesc' },
  { term: 'oversiteLegend.stockAlertsTerm', desc: 'oversiteLegend.stockAlertsDesc' },
  { term: 'oversiteLegend.coloursTerm', desc: 'oversiteLegend.coloursDesc' },
]

export function OversiteLegend() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!hasSeen()) setOpen(true)
  }, [])

  function close() {
    setOpen(false)
    markSeen()
  }

  return (
    <>
      <button
        type="button"
        className="legend-btn"
        aria-expanded={open}
        title={t('oversiteLegend.help')}
        onClick={() => (open ? close() : setOpen(true))}
      >
        ? {t('oversiteLegend.help')}
      </button>

      {open && (
        <div className="legend-panel" role="region" aria-label={t('oversiteLegend.help')}>
          <div className="legend-hdr">
            <span>💡 {t('oversiteLegend.title')}</span>
            <button type="button" className="legend-close" onClick={close}>
              ✕
            </button>
          </div>

          <dl className="legend-terms">
            {LINES.map(l => (
              <div key={l.term} className="legend-term-row">
                <dt>{t(l.term)}</dt>
                <dd>{t(l.desc)}</dd>
              </div>
            ))}
          </dl>

          <div className="ov-legend-swatches" aria-hidden="true">
            <span className="ov-legend-swatch">
              <i className="ov-bar-fill grn" /> {t('oversiteLegend.swatchSales')}
            </span>
            <span className="ov-legend-swatch">
              <i className="ov-bar-fill delivery" /> {t('oversiteLegend.swatchDelivery')}
            </span>
            <span className="ov-legend-swatch">
              <i className="ov-bar-fill forecast" /> {t('oversiteLegend.swatchProjected')}
            </span>
            <span className="ov-legend-swatch">
              <i className="ov-bar-fill agent-c0" /> {t('oversiteLegend.swatchAgents')}
            </span>
          </div>
        </div>
      )}
    </>
  )
}
