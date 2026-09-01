import { useLocale } from '../../../context/LocaleContext'
import type { OrderTodayGroup } from '../../../lib/oversiteMetrics'
import { OversiteOrdersByDocTable } from '../OversiteOrdersByDocTable'

export type SmOpenOrdersReportVariant = 'agent' | 'manager'

export interface SmOpenOrdersReportModalProps {
  title: string
  orders: OrderTodayGroup[]
  variant?: SmOpenOrdersReportVariant
  onClose: () => void
}

/** Open orders by cash — click a row to cascade line items. */
export function SmOpenOrdersReportModal({
  title,
  orders,
  variant = 'manager',
  onClose,
}: SmOpenOrdersReportModalProps) {
  const { t } = useLocale()
  const isAgent = variant === 'agent'

  return (
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="debt-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="debt-modal-hdr">
          <span>{title}</span>
          <button type="button" className="debt-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="debt-modal-body">
          <p className="sm-report-hint">
            {t(isAgent ? 'sm.openOrders.agentHint' : 'sm.openOrders.top10Hint')}
          </p>
          <OversiteOrdersByDocTable
            orders={orders}
            emptyLabel={t('oversite.noOrderItems')}
            showFooterTotal
            footerTotalLabel={t(isAgent ? 'sm.openOrders.agentTotal' : 'sm.openOrders.top10Total')}
          />
        </div>
      </div>
    </div>
  )
}
