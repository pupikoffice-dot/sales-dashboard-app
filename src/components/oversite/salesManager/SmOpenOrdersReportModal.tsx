import { useLocale } from '../../../context/LocaleContext'
import type { OrderTodayGroup } from '../../../lib/oversiteMetrics'
import { OversiteOrdersByDocTable } from '../OversiteOrdersByDocTable'

export interface SmOpenOrdersReportModalProps {
  title: string
  orders: OrderTodayGroup[]
  onClose: () => void
}

/** Top open orders by cash — click a row to cascade line items. */
export function SmOpenOrdersReportModal({ title, orders, onClose }: SmOpenOrdersReportModalProps) {
  const { t } = useLocale()

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
          <p className="sm-report-hint">{t('sm.openOrders.top10Hint')}</p>
          <OversiteOrdersByDocTable
            orders={orders}
            emptyLabel={t('oversite.noOrderItems')}
            showFooterTotal
          />
        </div>
      </div>
    </div>
  )
}
