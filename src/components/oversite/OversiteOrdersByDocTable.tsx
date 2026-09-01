import { Fragment, useMemo, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import type { OrderTodayGroup } from '../../lib/oversiteMetrics'

/** Top open orders by document cash — click a row to cascade line items. */
export function OversiteOrdersByDocTable({
  orders,
  emptyLabel,
  showFooterTotal = false,
  footerTotalLabel,
}: {
  orders: OrderTodayGroup[]
  emptyLabel: string
  /** When true, footer shows sum of listed orders (top-N total). */
  showFooterTotal?: boolean
  footerTotalLabel?: string
}) {
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

  if (!orders.length) {
    return <p className="ov-empty">{emptyLabel}</p>
  }

  return (
    <div className="tw">
      <table className="ov-orders-table">
        <thead>
          <tr>
            <th className="ov-order-expand-col" />
            <th>#</th>
            <th>{t('oversite.orderNumber')}</th>
            <th>{t('oversite.debtAgent')}</th>
            <th>{t('oversite.orderClientName')}</th>
            <th>{t('oversite.qty')}</th>
            <th>{t('oversite.orderTotal')}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, i) => {
            const isOpen = expanded.has(order.key)
            return (
              <Fragment key={order.key}>
                <tr
                  className={`ov-order-row${isOpen ? ' ov-order-row-open' : ''}`}
                  onClick={() => toggleOrder(order.key)}
                >
                  <td className="ov-order-expand-col cm">{isOpen ? '▴' : '▾'}</td>
                  <td className="cm">{i + 1}</td>
                  <td className="cm">{order.docNum}</td>
                  <td className="cm">{order.agent || '—'}</td>
                  <td>{order.clientName}</td>
                  <td className="cm">{fmt(order.qty)}</td>
                  <td>{fmt(order.cash)}</td>
                </tr>
                {isOpen ? (
                  <tr className="ov-order-detail-row">
                    <td colSpan={7}>
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
                            {order.lines.map((line, li) => (
                              <tr key={`${line.itemSKU}-${li}`}>
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
        {showFooterTotal ? (
          <tfoot>
            <tr>
              <td colSpan={5}>
                <b>{footerTotalLabel ?? t('sm.openOrders.top10Total')}</b>
              </td>
              <td className="cm">
                <b>{fmt(totals.qty)}</b>
              </td>
              <td>
                <b>{fmt(totals.cash)}</b>
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
}
