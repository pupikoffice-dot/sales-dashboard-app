import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ItemCardModal, ItemLink } from '../../components/rnd/ItemCardModal'
import { PlanTable, type PlanCol } from '../../components/rnd/PlanTable'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { usePreview } from '../../context/PreviewContext'
import { fmtDate } from '../../lib/dates'
import { fmt0 } from '../../lib/format'
import { fetchImportCover, groupBySupplier, perMonth, setItemHidden, setSupplierHidden, type ImportRow } from '../../lib/orderPlanning'
import { downloadWorkbook } from '../../lib/spreadsheetExport'
import type { LogicalCompany } from '../../types/dashboard'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

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
  hiddenSupplier: boolean
  items: number
  inStock: number
  notInStock: number
  hidden: number
  /** soonest an item runs out, in months */
  minMonths: number | null
  rows: ImportRow[]
}

function summarize(rows: ImportRow[]): SupplierRow[] {
  return groupBySupplier(rows).map(g => {
    const left = g.rows.filter(r => !r.hidden && r.stock > 0 && r.months_left !== null).map(r => r.months_left as number)
    return {
      supplier: g.supplier,
      internal: g.internal,
      hiddenSupplier: !!g.rows[0]?.sup_hidden,
      items: g.rows.length,
      inStock: g.rows.filter(r => r.stock > 0).length,
      notInStock: g.rows.filter(r => r.stock <= 0).length,
      hidden: g.rows.filter(r => r.hidden).length,
      minMonths: left.length ? Math.min(...left) : null,
      rows: g.rows,
    }
  })
}

/** R&D → Import stock cover: per supplier, every item that sold in the last 12 months with stock and months of cover left. */
export function ImportCoverPage() {
  const { t } = useLocale()
  const { access } = useDashboardAccess()
  const { isPreviewing, previewUser } = usePreview()
  const qc = useQueryClient()
  const asUser = isPreviewing ? (previewUser?.id ?? null) : null
  const companies = useMemo(() => COMPANY_ORDER.filter(c => access?.companies.includes(c)), [access?.companies])
  const [picked, setPicked] = useState<LogicalCompany | null>(null)
  const company = (picked && companies.includes(picked) ? picked : companies[0]) as LogicalCompany | undefined
  const [editing, setEditing] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [openAll, setOpenAll] = useState({ n: 0, open: false })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [card, setCard] = useState<string | null>(null)

  const key = ['import-cover', company, showHidden, asUser]
  const cover = useQuery({
    queryKey: key,
    queryFn: () => fetchImportCover(company as string, showHidden, asUser),
    enabled: !!company,
    staleTime: 5 * 60 * 1000,
  })
  const suppliers = useMemo(() => summarize(cover.data ?? []), [cover.data])
  const hiddenTotal = useMemo(() => (cover.data ?? []).filter(r => r.hidden).length, [cover.data])
  const H = (id: string) => ({ label: t(`oc.h.${id}` as 'oc.sku'), title: t(`oc.t.${id}` as 'oc.sku') })

  async function refreshAll() {
    await qc.invalidateQueries({ queryKey: ['import-cover', company] })
    await qc.invalidateQueries({ queryKey: ['order-reco', company] })
    await qc.invalidateQueries({ queryKey: ['order-settings', company] })
  }
  async function toggleHidden(r: ImportRow) {
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
      if (!(await setSupplierHidden(company, s.supplier, !s.hiddenSupplier))) setError(t('oc.saveFailed'))
      await refreshAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const itemCols: Array<PlanCol<ImportRow>> = useMemo(
    () => [
      { key: 'sku', ...H('sku'), get: r => r.sku, text: true, show: r => (<><ItemLink sku={r.sku} onOpen={setCard} />{r.hidden ? <small style={{ opacity: 0.7 }}> · {t('oc.hiddenTag')}</small> : null}</>) },
      { key: 'name', ...H('name'), get: r => r.item_name, text: true, cls: 'pt-name', show: r => <span title={r.item_name}>{r.item_name}</span> },
      { key: 'stock', ...H('stock'), get: r => r.stock, show: r => fmt0(r.stock) },
      { key: 'perMonth', ...H('perMonth'), get: r => Math.round(perMonth(r.rate12) * 10) / 10, show: r => n1(perMonth(r.rate12)) },
      { key: 'left', ...H('left'), get: r => (r.stock > 0 ? r.months_left : 0), show: r => (r.stock > 0 ? <MonthsLeft v={r.months_left} /> : <span className="pt-low">0</span>) },
      { key: 'b2', ...H('b2'), get: r => r.b2_qty, show: r => <span title={r.b2_docs ?? ''}>{fmt0(r.b2_qty)}</span> },
      { key: 'b6', ...H('b6'), get: r => r.b6_qty, show: r => <span title={r.b6_docs ?? ''}>{r.b6_qty ? `${fmt0(r.b6_qty)} · ${dt(r.b6_arrival)}` : '0'}</span> },
      { key: 'b8', ...H('b8'), get: r => (r.b8_rate === null ? null : Math.round(perMonth(r.b8_rate) * 10) / 10), show: r => (r.b8_rate === null ? '—' : `${n1(perMonth(r.b8_rate))}${r.b8_flag ? ' ⚠' : ''}`) },
      { key: 'soldMonths', ...H('soldMonths'), get: r => r.sold_months12 },
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
        show: r => (<>{r.supplier} {r.internal ? <small>({t('oc.internalTag')})</small> : null}{r.hiddenSupplier ? <small> · {t('oc.hiddenTag')}</small> : null}</>),
      },
      { key: 'items', ...H('sItems'), get: r => r.items },
      { key: 'inStock', ...H('iInStock'), get: r => r.inStock },
      { key: 'notInStock', ...H('iNoStock'), get: r => r.notInStock },
      { key: 'minMonths', ...H('iLeft'), get: r => r.minMonths, show: r => <MonthsLeft v={r.minMonths} /> },
      { key: 'hidden', ...H('iHidden'), get: r => r.hidden },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  const head = () => [t('oc.supplier'), t('oc.sku'), t('oc.name'), t('oc.stock'), t('oc.perMonth'), t('oc.monthsLeft'), t('oc.b2'), t('oc.onTheWay'), t('oc.b8'), t('oc.soldMonths'), t('oc.lastSold')]
  const line = (r: ImportRow) => [
    r.supplier, r.sku, r.item_name, String(Math.round(r.stock)), n1(perMonth(r.rate12)), r.stock > 0 ? n1(r.months_left) : '0',
    String(Math.round(r.b2_qty)) + (r.b2_docs ? ` (${r.b2_docs})` : ''), String(Math.round(r.b6_qty)) + (r.b6_docs ? ` (${r.b6_docs})` : ''),
    r.b8_rate === null ? '' : n1(perMonth(r.b8_rate)) + (r.b8_flag ? ' !' : ''), String(r.sold_months12), r.last_sold ?? '',
  ]
  const stamp = () => new Date().toISOString().slice(0, 10)

  function exportExcel() {
    const rows: string[][] = [head()]
    for (const s of suppliers) for (const r of s.rows.filter(x => !x.hidden)) rows.push(line(r))
    downloadWorkbook([{ name: 'Import stock cover', rows }], `import_stock_cover_${company}_${stamp()}.xlsx`)
  }
  function exportSupplier(name: string, visible: ImportRow[]) {
    downloadWorkbook([{ name: name.slice(0, 28) || 'Supplier', rows: [head(), ...visible.map(line)] }], `import_${name.replace(/[^\w-]+/g, '_')}_${company}_${stamp()}.xlsx`)
  }

  if (!company) return <p className="status-msg">{t('oc.noData')}</p>

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{t('oc.importTitle')}</h2>
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
        <button type="button" className="btn" onClick={() => setOpenAll(o => ({ n: o.n + 1, open: true }))}>{t('oc.expandAll')}</button>
        <button type="button" className="btn" onClick={() => setOpenAll(o => ({ n: o.n + 1, open: false }))}>{t('oc.collapseAll')}</button>
        <button type="button" className={`btn${editing ? ' active' : ''}`} onClick={() => setEditing(v => !v)} aria-pressed={editing}>{t('oc.edit')}</button>
        <button type="button" className={`btn${showHidden ? ' active' : ''}`} onClick={() => setShowHidden(v => !v)} aria-pressed={showHidden}>
          {t('oc.showHidden')}
          {showHidden && hiddenTotal ? ` (${hiddenTotal})` : ''}
        </button>
        <button type="button" className="btn" onClick={exportExcel} disabled={!suppliers.length}>{t('oc.export')}</button>
      </div>
      <p style={{ opacity: 0.8, maxWidth: 900 }}>{t('oc.importIntro')}</p>
      {cover.isLoading ? <p className="status-msg">{t('oc.loading')}</p> : null}
      {cover.error ? <p className="status-msg error">{(cover.error as Error).message}</p> : null}
      {error ? <p className="status-msg error">{error}</p> : null}
      {cover.data === null ? <p className="status-msg">{t('oc.noData')}</p> : null}
      {suppliers.length ? (
        <PlanTable
          rows={suppliers}
          cols={supCols}
          rowKey={s => s.supplier}
          initialSort={{ key: 'supplier', dir: 'asc' }}
          filterPlaceholder={t('oc.filter')}
          openAll={openAll}
          rowStyle={s => (s.hiddenSupplier ? { opacity: 0.5 } : undefined)}
          lead={
            editing
              ? {
                  header: t('oc.hideCol'),
                  title: t('oc.hideSupplier'),
                  cell: s => (
                    <input
                      type="checkbox"
                      checked={s.hiddenSupplier}
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
              initialSort={{ key: 'left', dir: 'asc' }}
              filterPlaceholder={t('oc.filter')}
              exportLabel={t('oc.exportShort')}
              onExport={visible => exportSupplier(s.supplier, visible)}
              rowStyle={r => (r.hidden ? { opacity: 0.5 } : r.stock <= 0 ? { background: 'rgba(127, 127, 127, 0.12)' } : undefined)}
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
                          onChange={() => void toggleHidden(r)}
                        />
                      ),
                    }
                  : undefined
              }
            />
          )}
        />
      ) : null}
      {card ? <ItemCardModal company={company} sku={card} closeLabel={t('oc.close')} onClose={() => setCard(null)} /> : null}
    </div>
  )
}
