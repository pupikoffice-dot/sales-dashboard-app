import type { Top10Item } from '../../../lib/oversiteMetrics'
import { useLocale } from '../../../context/LocaleContext'
import { OversiteTop10Table } from '../OversiteTop10Table'

export type SmItemsReportVariant = 'agent' | 'manager'

export interface SmItemsReportModalProps {
  title: string
  items: Top10Item[]
  emptyLabel: string
  showSku?: boolean
  variant?: SmItemsReportVariant
  onClose: () => void
}

/** SKU report modal for suite Returns cube. */
export function SmItemsReportModal({
  title,
  items,
  emptyLabel,
  showSku = true,
  variant = 'manager',
  onClose,
}: SmItemsReportModalProps) {
  const { t } = useLocale()

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
          {variant === 'agent' ? (
            <p className="sm-report-hint">{t('sm.returns.agentHint')}</p>
          ) : null}
          <OversiteTop10Table items={items} emptyLabel={emptyLabel} showSku={showSku} />
        </div>
      </div>
    </div>
  )
}
