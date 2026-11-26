import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOrderItem, perMonth, rateBasisInfo, type OrderRow } from '../../lib/orderPlanning'
import { useLocale } from '../../context/LocaleContext'
import { fmt0 } from '../../lib/format'
import { fmtDate } from '../../lib/dates'
import type { LogicalCompany } from '../../types/dashboard'

const n1 = (v: number | null | undefined) => (v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('en-US'))
const dt = (v: string | null | undefined) => (v ? fmtDate(v).replace(/^(\d{1,2}\/\d{1,2}\/)\d{2}(\d{2})$/, '$1$2') : '—')

/** Item card → the Order recommendation numbers for this item. Loads with the card; the engine calculates the whole company (about 10 s) so this section fills in last. Hidden for users without the Order recommendation page. */
export function ItemOrderReco({ company, sku, asUser }: { company: LogicalCompany; sku: string; asUser: string | null }) {
  const { t } = useLocale()
  const q = useQuery({
    queryKey: ['order-item', company, sku, asUser],
    queryFn: () => fetchOrderItem(company, sku, asUser),
    staleTime: 5 * 60 * 1000,
  })
  // null answer = this user has no Order recommendation access: show nothing at all
  if (q.data === null) return null

  const H = (id: string) => ({ label: t(`oc.h.${id}` as 'oc.h.sku'), title: t(`oc.t.${id}` as 'oc.h.sku') })
  const r: OrderRow | null | undefined = q.data?.row

  const cells: Array<{ id: string; value: ReactNode }> = r
    ? [
        { id: 'state', value: t(`oc.status.${r.status}` as 'oc.status.ok') },
        { id: 'stock', value: fmt0(r.stock) },
        { id: 'left', value: r.months_left == null ? '—' : n1(r.months_left) },
        { id: 'qty', value: <strong>{fmt0(r.order_qty)}</strong> },
        { id: 'orderBy', value: dt(r.order_by) },
        { id: 'runOut', value: dt(r.run_out) },
        { id: 'base', value: n1(perMonth(r.rate12)) },
        { id: 'basis', value: <span title={rateBasisInfo(r).title}>{rateBasisInfo(r).label}</span> },
        { id: 'baseOld', value: r.rate_old == null ? '—' : n1(perMonth(r.rate_old)) },
        { id: 'fc', value: n1(perMonth(r.forecast_rate)) },
        { id: 'trend', value: r.trend.toFixed(2) },
        { id: 'dem', value: fmt0(r.demand_cover) },
        { id: 'arr', value: fmt0(r.stock_at_arrival) },
        { id: 'b2', value: <span title={r.b2_docs ?? ''}>{fmt0(r.b2_qty)}</span> },
        { id: 'b6', value: <span title={r.b6_docs ?? ''}>{r.b6_qty ? `${fmt0(r.b6_qty)} · ${dt(r.b6_arrival)}` : '0'}</span> },
        { id: 'b8', value: r.b8_rate == null ? '—' : `${n1(perMonth(r.b8_rate))}${r.b8_flag ? ' ⚠' : ''}` },
        {
          id: 'lastIn',
          value: r.last_in_date ? (
            <span title={`${r.last_in_kind ?? ''} ${r.last_in_doc ?? ''}`.trim()}>
              {fmt0(r.last_in_qty ?? 0)} · {r.last_in_kind} · {dt(r.last_in_date)}
            </span>
          ) : (
            '—'
          ),
        },
        { id: 'last', value: dt(r.last_sold) },
        { id: 'sCur', value: fmt0(r.sales_cur) },
        { id: 'sLast', value: fmt0(r.sales_last) },
        { id: 's3', value: fmt0(r.sales_3m) },
        { id: 's12', value: fmt0(r.sales_12m) },
      ]
    : []

  return (
    <section className="hub-card hub-span-12">
      <div className="hub-card-hdr">
        <h3>{t('oc.item.title')}</h3>
        {r ? <span className="hub-card-aside">{r.supplier}</span> : null}
      </div>
      {q.isLoading ? (
        <p className="status-msg">{t('oc.item.loading')}</p>
      ) : q.error ? (
        <p className="status-msg error">{(q.error as Error).message}</p>
      ) : !r ? (
        <p className="status-msg">{t('oc.item.none')}</p>
      ) : (
        <>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  {cells.map(c => (
                    <th key={c.id} title={H(c.id).title} style={{ whiteSpace: 'normal', lineHeight: 1.15, verticalAlign: 'bottom' }}>
                      {H(c.id).label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {cells.map(c => (
                    <td key={c.id}>{c.value}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="sel-months-list" style={{ margin: '8px 0 0' }}>
            {t('oc.item.supplier')}: {t('oc.lead')} {r.lead_months ?? '—'} · {t('oc.cover')} {r.cover_months} · {t('oc.safety')} {r.safety_months}
            {r.hidden ? ' · hidden' : ''}
          </p>
        </>
      )}
    </section>
  )
}
