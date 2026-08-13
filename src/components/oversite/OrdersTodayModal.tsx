import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePreview } from '../../context/PreviewContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import { canShowModule } from '../../lib/permissions'
import { groupOrdersTodayByDoc } from '../../lib/oversiteMetrics'
import { pathForModule } from '../../modules/registry'
import type { LogicalCompany, SalesRow } from '../../types/dashboard'

interface OrdersTodayModalProps {
  company: LogicalCompany
  companyLabel: string
  ordersTag: string
  companyRows: SalesRow[]
  todayStr: string
  todayDisp: string
  onClose: () => void
}

export function OrdersTodayModal({
  company,
  companyLabel,
  ordersTag,
  companyRows,
  todayStr,
  todayDisp,
  onClose,
}: OrdersTodayModalProps) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const { access } = useDashboardAccess()
  // Honours the super-admin "View as user" preview.
  const { effectiveIsSuperAdmin: isSuperAdmin } = usePreview()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [totalSort, setTotalSort] = useState<'desc' | 'asc' | null>(null)

  const orders = useMemo(
    () => groupOrdersTodayByDoc(companyRows, ordersTag, todayStr),
    [companyRows, ordersTag, todayStr],
  )

  const sortedOrders = useMemo(() => {
    if (!totalSort) return orders
    return [...orders].sort((a, b) => {
      const cmp = a.cash - b.cash
      return totalSort === 'asc' ? cmp : -cmp
    })
  }, [orders, totalSort])

  const totals = useMemo(() => {
    let cash = 0
    let qty = 0
    for (const order of orders) {
      cash += order.cash
      qty += order.qty
    }
    return { cash, qty }
  }, [orders])

  const canOpenMtdPage = access && canShowModule(access, 'orders_mtd', isSuperAdmin)

  const toggleOrder = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleTotalSort = () => {
    setTotalSort(prev => {
      if (prev === null) return 'desc'
      if (prev === 'desc') return 'asc'
      return 'desc'
    })
  }

  return (
    <div className="debt-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="debt-modal">
        <div className="debt-modal-hdr">
          <span>
            📋 {t('oversite.ordersTodayReportTitle', { company: companyLabel, date: todayDisp })}
          </span>
          <button type="button" className="debt-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="debt-modal-body">
          {!orders.length ? (
            <p className="ov-empty">{t('oversite.noOrdersToday')}</p>
          ) : (
            <div className="tw">
              <table className="ov-orders-table">
                <thead>
                  <tr>
                    <th className="ov-order-expand-col" />
                    <th>{t('oversite.orderNumber')}</th>
                    <th>{t('oversite.debtAgent')}</th>
                    <th>{t('oversite.orderClientName')}</th>
                    <th
                      className="sortable"
                      onClick={toggleTotalSort}
                      title={t('oversite.sortByTotal')}
                    >
                      {t('oversite.orderTotal')}
                      <span className="si">
                        {totalSort === 'desc' ? ' ↓' : totalSort === 'asc' ? ' ↑' : ' ↕'}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map(order => {
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
                          <td>{fmt(order.cash)}</td>
                        </tr>
                        {isOpen && (
                          <tr className="ov-order-detail-row">
                            <td colSpan={5}>
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
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>
                      <b>{t('oversite.orderTotal')}</b>
                    </td>
                    <td>
                      <b>{fmt(totals.cash)}</b>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {canOpenMtdPage && (
            <button
              type="button"
              className="ov-debt-btn"
              style={{ marginTop: 12 }}
              onClick={() => {
                onClose()
                navigate(pathForModule('orders_mtd'))
              }}
            >
              📋 {t('oversite.openOrdersMtdPage')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
