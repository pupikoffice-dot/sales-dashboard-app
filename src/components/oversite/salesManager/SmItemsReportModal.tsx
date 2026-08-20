import type { Top10Item } from '../../../lib/oversiteMetrics'
import { OversiteTop10Table } from '../OversiteTop10Table'

export interface SmItemsReportModalProps {
  title: string
  items: Top10Item[]
  emptyLabel: string
  showSku?: boolean
  onClose: () => void
}

/** Lightweight Top-10 report modal for suite Open Orders / Returns cubes. */
export function SmItemsReportModal({
  title,
  items,
  emptyLabel,
  showSku = true,
  onClose,
}: SmItemsReportModalProps) {
  return (
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sm-items-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="debt-modal-hdr">
          <span>{title}</span>
          <button type="button" className="debt-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sm-items-modal-body">
          <OversiteTop10Table items={items} emptyLabel={emptyLabel} showSku={showSku} />
        </div>
      </div>
    </div>
  )
}
