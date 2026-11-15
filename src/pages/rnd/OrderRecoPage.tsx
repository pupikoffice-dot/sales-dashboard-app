import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ItemCardModal, ItemLink } from '../../components/rnd/ItemCardModal'
import { PlanTable, type PlanCol } from '../../components/rnd/PlanTable'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { usePreview } from '../../context/PreviewContext'
import { fmtDate } from '../../lib/dates'
import { fmt0 } from '../../lib/format'
import {
  fetchOrderReco,
  fetchOrderSettings,
  groupBySupplier,
  perMonth,
  saveOrderSetting,
  setItemHidden,
  setSupplierHidden,
  type OrderRow,
  type OrderStatus,
  type SupplierSetting,
} from '../../lib/orderPlanning'
import { downloadWorkbook } from '../../lib/spreadsheetExport'
import type { LogicalCompany } from '../../types/dashboard'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

const STATUS_COLOR: Record<OrderStatus, string> = {
  late: 'rgba(220, 53, 69, 0.14)',
  order: 'rgba(255, 193, 7, 0.16)',
  out: 'rgba(127, 127, 127, 0.14)',
  ok: 'transparent',
}
const STATUS_RANK: Record<OrderStatus, number> = { late: 0, order: 1, out: 2, ok: 3 }

const n1 = (v: number | null | undefined) => (v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toLocaleString('en-US'))
const dt = (v: string | null) => (v ? fmtDate(v) : '—')

/** Months left: red and bold under 3. */
function MonthsLeft({ v }: { v: number | null }) {
  if (v === null) return <>—</>
  return <span className={v < 3 ? 'pt-low' : undefined}>{n1(v)}</span>
}

interface SupplierRow {
  supplier: string
  internal: boolean
  hidden: boolean
  items: number
  late: number
  order: number
  out: number
  qty: number
  orderBy: string | null
  lead: number | null
  rows: OrderRow[]
}

function summarize(rows: OrderRow[]): SupplierRow[] {
  return groupBySupplier(rows).map(g => {
    const dates = g.rows.map(r => r.order_by).filter((d): d is string => !!d).sort()
    return {
      supplier: g.supplier,
      internal: g.internal,
      hidden: !!g.rows[0]?.sup_hidden,
      items: g.rows.length,
      late: g.rows.filter(r => r.status === 'late').length,
      order: g.rows.filter(r => r.status === 'order').length,
      out: g.rows.filter(r => r.status === 'out').length,
      qty: g.rows.reduce((a, r) => a + r.order_qty, 0),
      orderBy: dates[0] ?? null,
      lead: g.rows[0]?.lead_months ?? null,
      rows: g.rows,
    }
  })
}

/** R&D → Order recommendation: per supplier, what to order now or soon. Lead time, cover and safety come from the supplier settings tab. */
export function OrderRecoPage() {
  const { t } = useLocale()
  const { access } = useDashboardAccess()
  const { isPreviewing, previewUser } = usePreview()
  const qc = useQueryClient()
  const asUser = isPreviewing ? (previewUser?.id ?? null) : null
  const companies = useMemo(() => COMPANY_ORDER.filter(c => access?.companies.includes(c)), [access?.companies])
  const [picked, setPicked] = useState<LogicalCompany | null>(null)
  const company = (picked && companies.includes(picked) ? picked : companies[0]) as LogicalCompany | undefined
  const [tab, setTab] = useState<'reco' | 'settings'>('reco')
  const [openAll, setOpenAll] = useState({ n: 0, open: true })
  const [editing, setEditing] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [card, setCard] = useState<string | null>(null)

  const reco = useQuery({
    queryKey: ['order-reco', company, showHidden, asUser],
    queryFn: () => fetchOrderReco(company as string, showHidden, asUser),
    enabled: !!company,
    staleTime: 5 * 60 * 1000,
  })

  const suppliers = useMemo(() => summarize(reco.data ?? []), [reco.data])
  const hiddenTotal = useMemo(() => (reco.data ?? []).filter(r => r.hidden).length, [reco.data])

  const statusLabel = (s: OrderStatus) => t(`oc.status.${s}` as 'oc.status.ok')
  const H = (id: string) => ({ label: t(`oc.h.${id}` as 'oc.sku'), title: t(`oc.t.${id}` as 'oc.sku') })

  async function refreshAll() {
    await qc.invalidateQueries({ queryKey: ['order-reco', company] })
    await qc.invalidateQueries({ queryKey: ['import-cover', company] })
    await qc.invalidateQueries({ queryKey: ['order-settings', company] })
  }
  async function toggleItem(r: OrderRow) {
    if (!company) return
    setBusy(r.sku)
    setError(null)
    try {
      if (!(await setItemHidden(company, r.sku, !r.hidden))) setError(t('oc.saveFailed'))
      await refreshAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }
  async function toggleSupplier(s: SupplierRow) {
    if (!company) return
    setBusy(s.supplier)
    setError(null)
    try {
      if (!(await setSupplierHidden(company, s.supplier, !s.hidden))) setError(t('oc.saveFailed'))
      await refreshAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const itemCols: Array<PlanCol<OrderRow>> = useMemo(
    () => [
      { key: 'sku', ...H('sku'), get: r => r.sku, text: true, show: r => <ItemLink sku={r.sku} onOpen={setCard} /> },
      { key: 'name', ...H('name'), get: r => r.item_name, text: true, cls: 'pt-name', show: r => <span title={r.item_name}>{r.item_name}</span> },
      { key: 'status', ...H('state'), get: r => STATUS_RANK[r.status], show: r => statusLabel(r.status) },
      { key: 'stock', ...H('stock'), get: r => r.stock, show: r => fmt0(r.stock) },
      { key: 'left', ...H('left'), get: r => (r.months_left === null ? null : Math.round(r.months_left * 10) / 10), show: r => <MonthsLeft v={r.months_left} /> },
      { key: 'sCur', ...H('sCur'), get: r => r.sales_cur, show: r => fmt0(r.sales_cur) },
      { key: 'sLast', ...H('sLast'), get: r => r.sales_last, show: r => fmt0(r.sales_last) },
      { key: 's3', ...H('s3'), get: r => r.sales_3m, show: r => fmt0(r.sales_3m) },
      { key: 's12', ...H('s12'), get: r => r.sales_12m, show: r => fmt0(r.sales_12m) },
      { key: 'perMonth', ...H('fc'), get: r => Math.round(perMonth(r.forecast_rate) * 10) / 10, show: r => n1(perMonth(r.forecast_rate)) },
      { key: 'trend', ...H('trend'), get: r => Math.round(r.trend * 100) / 100, show: r => r.trend.toFixed(2) },
      { key: 'demand', ...H('dem'), get: r => Math.round(r.demand_cover), show: r => fmt0(r.demand_cover) },
      { key: 'arrival', ...H('arr'), get: r => Math.round(r.stock_at_arrival), show: r => fmt0(r.stock_at_arrival) },
      { key: 'b2', ...H('b2'), get: r => r.b2_qty, show: r => <span title={r.b2_docs ?? ''}>{fmt0(r.b2_qty)}</span> },
      {
        key: 'b6',
        ...H('b6'),
        get: r => r.b6_qty,
        show: r => <span title={r.b6_docs ?? ''}>{r.b6_qty ? `${fmt0(r.b6_qty)} · ${dt(r.b6_arrival)}` : '0'}</span>,
      },
      { key: 'b8', ...H('b8'), get: r => (r.b8_rate === null ? null : Math.round(perMonth(r.b8_rate) * 10) / 10), show: r => (r.b8_rate === null ? '—' : `${n1(perMonth(r.b8_rate))}${r.b8_flag ? ' ⚠' : ''}`) },
      { key: 'qty', ...H('qty'), get: r => r.order_qty, show: r => <strong>{fmt0(r.order_qty)}</strong> },
      { key: 'runOut', ...H('runOut'), get: r => r.run_out, show: r => dt(r.run_out), text: true },
      { key: 'orderBy', ...H('orderBy'), get: r => r.order_by, show: r => dt(r.order_by), text: true },
      { key: 'last', ...H('last'), get: r => r.last_sold, show: r => dt(r.last_sold), text: true },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  const supCols: Array<PlanCol<SupplierRow>> = useMemo(
    () => [
      {
        key: 'supplier',
        ...H('supplier'),
        get: r => r.supplier,
        text: true,
        show: r => (
          <>
            {r.supplier} {r.internal ? <small>({t('oc.internalTag')})</small> : null}
            {r.hidden ? <small> · {t('oc.hiddenTag')}</small> : null}
            {r.lead === null ? <small style={{ opacity: 0.7 }}> · {t('oc.noLead')}</small> : null}
          </>
        ),
      },
      { key: 'items', ...H('sItems'), get: r => r.items },
      { key: 'late', ...H('sLate'), get: r => r.late },
      { key: 'order', ...H('sOrder'), get: r => r.order },
      { key: 'out', ...H('sOut'), get: r => r.out },
      { key: 'qty', ...H('sQty'), get: r => r.qty, show: r => fmt0(r.qty) },
      { key: 'orderBy', ...H('sBy'), get: r => r.orderBy, show: r => dt(r.orderBy), text: true },
      { key: 'lead', ...H('sLead'), get: r => r.lead, show: r => (r.lead === null ? t('oc.leadNotSet') : String(r.lead)) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  const itemHead = () => [
    t('oc.supplier'), t('oc.h.sku' as 'oc.sku'), t('oc.name'), t('oc.status'), t('oc.stock'), t('oc.t.left' as 'oc.sku').split(':')[0],
    t('oc.t.sCur' as 'oc.sku').split(':')[0], t('oc.t.sLast' as 'oc.sku').split(':')[0], t('oc.t.s3' as 'oc.sku').split(':')[0], t('oc.t.s12' as 'oc.sku').split(':')[0],
    t('oc.perMonth'), t('oc.trend'), t('oc.demandCover'), t('oc.atArrival'), t('oc.b2'), t('oc.onTheWay'), t('oc.b8'), t('oc.orderQty'),
    t('oc.runOut'), t('oc.orderBy'), t('oc.lastSold'),
  ]
  const itemLine = (r: OrderRow) => [
    r.supplier, r.sku, r.item_name, statusLabel(r.status), String(Math.round(r.stock)), r.months_left === null ? '' : n1(r.months_left),
    String(Math.round(r.sales_cur)), String(Math.round(r.sales_last)), String(Math.round(r.sales_3m)), String(Math.round(r.sales_12m)),
    n1(perMonth(r.forecast_rate)), r.trend.toFixed(2), String(Math.round(r.demand_cover)), String(Math.round(r.stock_at_arrival)),
    String(Math.round(r.b2_qty)) + (r.b2_docs ? ` (${r.b2_docs})` : ''), String(Math.round(r.b6_qty)) + (r.b6_docs ? ` (${r.b6_docs})` : ''),
    r.b8_rate === null ? '' : n1(perMonth(r.b8_rate)) + (r.b8_flag ? ' !' : ''), String(r.order_qty),
    r.run_out ?? '', r.order_by ?? '', r.last_sold ?? '',
  ]
  const stamp = () => new Date().toISOString().slice(0, 10)

  function exportExcel() {
    const rows: string[][] = [itemHead()]
    for (const s of suppliers) {
      for (const r of [...s.rows].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (a.order_by ?? '9').localeCompare(b.order_by ?? '9'))) rows.push(itemLine(r))
    }
    const sup: string[][] = [[t('oc.supplier'), t('oc.itemsToOrder'), t('oc.status.late'), t('oc.status.order'), t('oc.status.out'), t('oc.totalQty'), t('oc.firstOrderBy'), t('oc.lead')]]
    for (const s of suppliers) sup.push([s.supplier, String(s.items), String(s.late), String(s.order), String(s.out), String(Math.round(s.qty)), s.orderBy ?? '', s.lead === null ? '' : String(s.lead)])
    downloadWorkbook([{ name: 'Order recommendation', rows }, { name: 'Suppliers', rows: sup }], `order_recommendation_${company}_${stamp()}.xlsx`)
  }
  function exportSupplier(name: string, visible: OrderRow[]) {
    downloadWorkbook([{ name: name.slice(0, 28) || 'Supplier', rows: [itemHead(), ...visible.map(itemLine)] }], `order_${name.replace(/[^\w-]+/g, '_')}_${company}_${stamp()}.xlsx`)
  }

  if (!company) return <p className="status-msg">{t('oc.noData')}</p>

  const tabBtn = (id: 'reco' | 'settings', label: string) => (
    <button type="button" className={`btn${tab === id ? ' active' : ''}`} onClick={() => setTab(id)} aria-pressed={tab === id}>
      {label}
    </button>
  )

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{t('oc.title')}</h2>
      <div className="pt-bar">
        <label>
          {t('oc.company')}{' '}
          <select value={company} onChange={e => setPicked(e.target.value as LogicalCompany)}>
            {companies.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="btn-grp">
          {tabBtn('reco', t('oc.tab.reco'))}
          {tabBtn('settings', t('oc.tab.settings'))}
        </div>
      </div>
      {tab === 'reco' ? (
        <div className="pt-bar">
          <button type="button" className="btn" onClick={() => setOpenAll(o => ({ n: o.n + 1, open: true }))}>
            {t('oc.expandAll')}
          </button>
          <button type="button" className="btn" onClick={() => setOpenAll(o => ({ n: o.n + 1, open: false }))}>
            {t('oc.collapseAll')}
          </button>
          <button type="button" className={`btn${editing ? ' active' : ''}`} onClick={() => setEditing(v => !v)} aria-pressed={editing}>
            {t('oc.edit')}
          </button>
          <button type="button" className={`btn${showHidden ? ' active' : ''}`} onClick={() => setShowHidden(v => !v)} aria-pressed={showHidden}>
            {t('oc.showHidden')}
            {showHidden && hiddenTotal ? ` (${hiddenTotal})` : ''}
          </button>
          <button type="button" className="btn" onClick={exportExcel} disabled={!suppliers.length}>
            {t('oc.export')}
          </button>
        </div>
      ) : null}

      {tab === 'reco' ? (
        <>
          <p style={{ opacity: 0.8, maxWidth: 900 }}>{t('oc.intro')}</p>
          {reco.isLoading ? <p className="status-msg">{t('oc.loading')}</p> : null}
          {reco.error ? <p className="status-msg error">{(reco.error as Error).message}</p> : null}
          {error ? <p className="status-msg error">{error}</p> : null}
          {reco.data === null ? <p className="status-msg">{t('oc.noData')}</p> : null}
          {reco.data && !suppliers.length ? <p className="status-msg">{t('oc.nothing')}</p> : null}
          {suppliers.length ? (
            <PlanTable
              rows={suppliers}
              cols={supCols}
              rowKey={s => s.supplier}
              initialSort={{ key: 'late', dir: 'desc' }}
              filterPlaceholder={t('oc.filter')}
              openAll={openAll}
              rowStyle={s => (s.hidden ? { opacity: 0.5 } : undefined)}
              lead={
                editing
                  ? {
                      header: t('oc.hideCol'),
                      title: t('oc.hideSupplier'),
                      cell: s => (
                        <input
                          type="checkbox"
                          checked={s.hidden}
                          disabled={busy === s.supplier}
                          title={t('oc.hideSupplier')}
                          aria-label={`${t('oc.hideCol')} ${s.supplier}`}
                          onChange={() => void toggleSupplier(s)}
                        />
                      ),
                    }
                  : undefined
              }
              expand={s => (
                <PlanTable
                  rows={s.rows}
                  cols={itemCols}
                  rowKey={r => r.sku}
                  initialSort={{ key: 'orderBy', dir: 'asc' }}
                  filterPlaceholder={t('oc.filter')}
                  exportLabel={t('oc.exportShort')}
                  onExport={visible => exportSupplier(s.supplier, visible)}
                  rowStyle={r => ({ background: STATUS_COLOR[r.status], ...(r.hidden ? { opacity: 0.5 } : null) })}
                  lead={
                    editing
                      ? {
                          header: t('oc.hideCol'),
                          title: t('oc.hideItem'),
                          cell: r => (
                            <input
                              type="checkbox"
                              checked={r.hidden}
                              disabled={busy === r.sku || r.sup_hidden}
                              title={t('oc.hideItem')}
                              aria-label={`${t('oc.hideCol')} ${r.sku}`}
                              onChange={() => void toggleItem(r)}
                            />
                          ),
                        }
                      : undefined
                  }
                />
              )}
            />
          ) : null}
          <p style={{ opacity: 0.7, fontSize: '0.85em' }}>{t('oc.understated')}</p>
        </>
      ) : (
        <SettingsTab company={company} asUser={asUser} onSaved={() => reco.refetch()} />
      )}
      {card ? <ItemCardModal company={company} sku={card} closeLabel={t('oc.close')} onClose={() => setCard(null)} /> : null}
    </div>
  )
}

function num(v: string): number | null {
  const x = v.trim()
  if (!x) return null
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

/** Supplier settings: lead time, cover, safety and payment terms. One row per supplier; Save per row. */
function SettingsTab({ company, asUser, onSaved }: { company: string; asUser: string | null; onSaved: () => void }) {
  const { t } = useLocale()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['order-settings', company, asUser],
    queryFn: () => fetchOrderSettings(company, asUser),
    staleTime: 60 * 1000,
  })
  const [draft, setDraft] = useState<Record<string, SupplierSetting>>({})
  const [msg, setMsg] = useState<Record<string, string>>({})
  const rows = q.data ?? []
  const val = (s: SupplierSetting) => draft[s.supplier_name] ?? s
  const edit = (s: SupplierSetting, patch: Partial<SupplierSetting>) => setDraft(d => ({ ...d, [s.supplier_name]: { ...val(s), ...patch } }))

  async function save(s: SupplierSetting) {
    const v = val(s)
    try {
      const ok = await saveOrderSetting(company, v)
      setMsg(m => ({ ...m, [s.supplier_name]: ok ? t('oc.saved') : t('oc.saveFailed') }))
      if (ok) {
        setDraft(d => {
          const next = { ...d }
          delete next[s.supplier_name]
          return next
        })
        await qc.invalidateQueries({ queryKey: ['order-settings', company] })
        await qc.invalidateQueries({ queryKey: ['order-reco', company] })
        onSaved()
      }
    } catch {
      setMsg(m => ({ ...m, [s.supplier_name]: t('oc.saveFailed') }))
    }
  }

  const inp = { width: 70, boxSizing: 'border-box' as const }
  return (
    <>
      <p style={{ opacity: 0.8, maxWidth: 900 }}>{t('oc.settingsHelp')}</p>
      {q.isLoading ? <p className="status-msg">{t('oc.loading')}</p> : null}
      {q.error ? <p className="status-msg error">{(q.error as Error).message}</p> : null}
      <div className="tw" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'start' }}>{t('oc.supplier')}</th>
              <th>{t('oc.items')}</th>
              <th>{t('oc.lead')}</th>
              <th>{t('oc.cover')}</th>
              <th>{t('oc.safety')}</th>
              <th>{t('oc.internal')}</th>
              <th>{t('oc.payTerms')}</th>
              <th>{t('oc.payDays')}</th>
              <th>{t('oc.payNotes')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(s => {
              const v = val(s)
              const dirty = !!draft[s.supplier_name]
              return (
                <tr key={s.supplier_name}>
                  <td style={{ textAlign: 'start' }}>{s.supplier_name}</td>
                  <td>{s.items}</td>
                  <td><input type="number" min={0} max={24} step={0.25} style={inp} value={v.lead_months ?? ''} onChange={e => edit(s, { lead_months: num(e.target.value) })} /></td>
                  <td><input type="number" min={0.5} max={24} step={0.5} style={inp} value={v.cover_months} onChange={e => edit(s, { cover_months: num(e.target.value) ?? 4 })} /></td>
                  <td><input type="number" min={0} max={12} step={0.25} style={inp} value={v.safety_months} onChange={e => edit(s, { safety_months: num(e.target.value) ?? 0.5 })} /></td>
                  <td><input type="checkbox" checked={v.internal} onChange={e => edit(s, { internal: e.target.checked })} /></td>
                  <td><input type="text" style={{ width: 120 }} value={v.payment_terms ?? ''} onChange={e => edit(s, { payment_terms: e.target.value })} /></td>
                  <td><input type="number" min={0} step={1} style={inp} value={v.payment_days ?? ''} onChange={e => edit(s, { payment_days: num(e.target.value) })} /></td>
                  <td><input type="text" style={{ width: 160 }} value={v.payment_notes ?? ''} onChange={e => edit(s, { payment_notes: e.target.value })} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn" disabled={!dirty} onClick={() => void save(s)}>{t('oc.save')}</button>{' '}
                    <small>{msg[s.supplier_name] ?? ''}</small>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
