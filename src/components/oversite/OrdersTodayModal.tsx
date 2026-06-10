import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { fmt } from '../../lib/format'
import { canShowModule } from '../../lib/permissions'
import { getOrdersTodayRows } from '../../lib/oversiteMetrics'
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
  const { isSuperAdmin } = useAuth()

  const rows = useMemo(
    () => getOrdersTodayRows(companyRows, ordersTag, todayStr),
    [companyRows, ordersTag, todayStr],
  )

  const totals = useMemo(() => {
    let cash = 0
    let qty = 0
    for (const r of rows) {
      cash += r.cash || 0
      qty += r.qty || 0
    }
    return { cash, qty }
  }, [rows])

  const canOpenMtdPage = access && canShowModule(access, 'orders_mtd', isSuperAdmin)

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
          {!rows.length ? (
            <p className="ov-empty">{t('oversite.noOrdersToday')}</p>
          ) : (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>{t('oversite.orderClientId')}</th>
                    <th>{t('oversite.orderClientName')}</th>
                    <th>SKU</th>
                    <th>{t('oversite.orderItem')}</th>
                    <th>{t('oversite.qty')}</th>
                    <th>{t('oversite.cash')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.clientID}-${r.itemSKU}-${i}`}>
                      <td>{r.clientID || '—'}</td>
                      <td>{r.clientName || '—'}</td>
                      <td className="cm">{r.itemSKU || '—'}</td>
                      <td title={r.itemSKU || undefined}>{r.itemName || '—'}</td>
                      <td className="cm">{fmt(r.qty || 0)}</td>
                      <td>{fmt(r.cash || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>
                      <b>Total</b>
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
