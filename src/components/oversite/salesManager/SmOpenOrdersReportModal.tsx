import { Fragment, useMemo, useState } from 'react'
import { useLocale } from '../../../context/LocaleContext'
import { fmt } from '../../../lib/format'
import type { OrderTodayGroup } from '../../../lib/oversiteMetrics'

export interface SmOpenOrdersReportModalProps {
  title: string
  orders: OrderTodayGroup[]
  onClose: () => void
}

/** Top open orders by cash — click a row to cascade line items. */
export function SmOpenOrdersReportModal({ title, orders, onClose }: SmOpenOrdersReportModalProps) {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const totals = useMemo(() => {
    let cash = 0
    let qty = 0
    for (const order of orders) {
      cash += order.cash
      qty += order.qty
    }
    return { cash, qty }
  }, [orders])

  const toggleOrder = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
          {!orders.length ? (
            <p className="ov-empty">{t('oversite.noOrderItems')}</p>
          ) : (
            <div className="tw">
              <table className="ov-orders-table">
                <thead>
                  <tr>
                    <th className="ov-order-expand-col" />
                    <th>{t('oversite.orderNumber')}</th>
                    <th>{t('oversite.debtAgent')}</th>
                    <th>{t('oversite.orderClientName')}</th>
                    <th>{t('oversite.qty')}</th>
                    <th>{t('oversite.orderTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => {
                    const isOpen = expanded.has(order.key)
                    return (
                      <Fragment key={order.key}>
                        <tr
                          className={`ov-order-row${isOpen ? ' ov-order-row-open' : ''}`}
                          onClick={() => toggleOrder(order.key)}
                        >
                          <td className="ov-order-expand-col cm">{isOpen ? '▴' : '▾'}</td>
                          <td className="cm">{order.docNum}</td>
                          <td className="cm">{order.agent || '—'}</td>
                          <td>{order.clientName}</td>
                          <td className="cm">{fmt(order.qty)}</td>
                          <td>{fmt(order.cash)}</td>
                        </tr>
                        {isOpen ? (
                          <tr className="ov-order-detail-row">
                            <td colSpan={6}>
                              <div className="ov-order-detail">
                                <table>
                                  <thead>
                                    <tr>
                                      <th>SKU</th>
                                      <th>{t('oversite.orderItem')}</th>
                                      <th>{t('oversite.qty')}</th>
                                      <th>{t('oversite.cash')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.lines.map((line, i) => (
                                      <tr key={`${line.itemSKU}-${i}`}>
                                        <td className="cm">{line.itemSKU || '—'}</td>
                                        <td title={line.itemSKU || undefined}>{line.itemName || '—'}</td>
                                        <td className="cm">{fmt(line.qty || 0)}</td>
                                        <td>{fmt(line.cash || 0)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>
                      <b>{t('sm.openOrders.top10Total')}</b>
                    </td>
                    <td className="cm">
                      <b>{fmt(totals.qty)}</b>
                    </td>
                    <td>
                      <b>{fmt(totals.cash)}</b>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
