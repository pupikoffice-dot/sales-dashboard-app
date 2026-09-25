import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import type { Delivery720Metrics, Top10Item } from '../../lib/oversiteMetrics'
import { OversiteKpiRow } from './OversiteKpiRow'
import { OversiteTop10Table } from './OversiteTop10Table'

export interface DeliveryNotesModalProps {
  title: string
  metrics: Delivery720Metrics
  items: Top10Item[]
  onClose: () => void
}

/** Report 720 MTD detail — opened from the Sales MTD card (classic + suite). */
export function DeliveryNotesModal({ title, metrics, items, onClose }: DeliveryNotesModalProps) {
  const { t } = useLocale()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Portal: the trigger lives inside suite cubes / arrange chrome, which can create
  // containing blocks that break `position: fixed` overlays.
  return createPortal(
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sm-items-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="debt-modal-hdr">
          <span>{title}</span>
          <button type="button" className="debt-modal-close" onClick={onClose} autoFocus>
            ✕
          </button>
        </div>
        <div className="sm-items-modal-body">
          <OversiteKpiRow
            kpis={[
              { label: t('oversite.clients'), value: String(metrics.clients) },
              { label: t('oversite.qty'), value: fmt(metrics.qty) },
              { label: t('oversite.cash'), value: fmt(metrics.cash), tone: 'grn' },
            ]}
          />
          <p className="sm-report-hint delivery-modal-subhdr">{t('oversite.top10DeliveryNotes')}</p>
          <OversiteTop10Table items={items} emptyLabel={t('oversite.noDeliveryNotes')} showSku />
        </div>
      </div>
    </div>,
    document.body,
  )
}
