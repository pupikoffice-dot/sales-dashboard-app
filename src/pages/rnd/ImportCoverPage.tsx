import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PlanTable, type PlanCol } from '../../components/rnd/PlanTable'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { usePreview } from '../../context/PreviewContext'
import { fmtDate } from '../../lib/dates'
import { fmt0 } from '../../lib/format'
import { fetchImportCover, groupBySupplier, perMonth, setItemHidden, type ImportRow } from '../../lib/orderPlanning'
import { downloadWorkbook } from '../../lib/spreadsheetExport'
import type { LogicalCompany } from '../../types/dashboard'

const COMPANY_ORDER: LogicalCompany[] = ['pupik', 'mt', 'grow', 'gold']

const n1 = (v: number | null | undefined) => (v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toLocaleString('en-US'))
const dt = (v: string | null) => (v ? fmtDate(v) : '—')

interface SupplierRow {
  supplier: string
  internal: boolean
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

  const key = ['import-cover', company, showHidden, asUser]
  const cover = useQuery({
    queryKey: key,
    queryFn: () => fetchImportCover(company as string, showHidden, asUser),
    enabled: !!company,
    staleTime: 5 * 60 * 1000,
  })
  const suppliers = useMemo(() => summarize(cover.data ?? []), [cover.data])
  const hiddenTotal = useMemo(() => (cover.data ?? []).filter(r => r.hidden).length, [cover.data])

  async function toggleHidden(r: ImportRow) {
    if (!company) return
    setBusy(r.sku)
    setError(null)
    try {
      const ok = await setItemHidden(company, r.sku, !r.hidden)
      if (!ok) setError(t('oc.saveFailed'))
      await qc.invalidateQueries({ queryKey: ['import-cover', company] })
      await qc.invalidateQueries({ queryKey: ['order-reco', company] })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const itemCols: Array<PlanCol<ImportRow>> = useMemo(
    () => [
      { key: 'sku', label: t('oc.sku'), get: r => r.sku, text: true, show: r => (<>{r.sku}{r.hidden ? <small style={{ opacity: 0.7 }}> · {t('oc.hiddenTag')}</small> : null}</>) },
      { key: 'name', label: t('oc.name'), get: r => r.item_name, text: true },
      { key: 'stock', label: t('oc.stock'), get: r => r.stock, show: r => fmt0(r.stock) },
      { key: 'perMonth', label: t('oc.perMonth'), get: r => Math.round(perMonth(r.rate12) * 10) / 10, show: r => n1(perMonth(r.rate12)), title: t('oc.perDay') },
      { key: 'left', label: t('oc.monthsLeft'), get: r => (r.stock > 0 ? r.months_left : 0), show: r => (r.stock > 0 ? n1(r.months_left) : '0') },
      { key: 'b2', label: t('oc.b2'), get: r => r.b2_qty, show: r => fmt0(r.b2_qty), title: t('oc.b2Title') },
      { key: 'b6', label: t('oc.onTheWay'), get: r => r.b6_qty, show: r => (r.b6_qty ? `${fmt0(r.b6_qty)} · ${dt(r.b6_arrival)}` : '0'), title: t('oc.b6Title') },
      { key: 'b8', label: t('oc.b8'), get: r => (r.b8_rate === null ? null : Math.round(perMonth(r.b8_rate) * 10) / 10), show: r => (r.b8_rate === null ? '—' : `${n1(perMonth(r.b8_rate))}${r.b8_flag ? ' ⚠' : ''}`), title: t('oc.b8Title') },
      { key: 'soldMonths', label: t('oc.soldMonths'), get: r => r.sold_months12 },
      { key: 'last', label: t('oc.lastSold'), get: r => r.last_sold, show: r => dt(r.last_sold), text: true },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  const supCols: Array<PlanCol<SupplierRow>> = useMemo(
    () => [
      { key: 'supplier', label: t('oc.supplier'), get: r => r.supplier, text: true, show: r => (<>{r.supplier} {r.internal ? <small>({t('oc.internalTag')})</small> : null}</>) },
      { key: 'items', label: t('oc.items'), get: r => r.items },
      { key: 'inStock', label: t('oc.inStock'), get: r => r.inStock },
      { key: 'notInStock', label: t('oc.notInStock'), get: r => r.notInStock },
      { key: 'minMonths', label: t('oc.monthsLeft'), get: r => r.minMonths, show: r => n1(r.minMonths) },
      { key: 'hidden', label: t('oc.hiddenTag'), get: r => r.hidden },
    ],
    [t],
  )

  function exportExcel() {
    const rows: string[][] = [[t('oc.supplier'), t('oc.sku'), t('oc.name'), t('oc.stock'), t('oc.perMonth'), t('oc.monthsLeft'), t('oc.soldMonths'), t('oc.lastSold')]]
    for (const s of suppliers) {
      for (const r of s.rows.filter(x => !x.hidden)) {
        rows.push([r.supplier, r.sku, r.item_name, String(Math.round(r.stock)), n1(perMonth(r.rate12)), r.stock > 0 ? n1(r.months_left) : '0', String(r.sold_months12), r.last_sold ?? ''])
      }
    }
    downloadWorkbook([{ name: 'Import stock cover', rows }], `import_stock_cover_${company}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (!company) return <p className="status-msg">{t('oc.noData')}</p>

  return (
    <div className="panel" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{t('oc.importTitle')}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
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
        <label>
          <input type="checkbox" checked={editing} onChange={e => setEditing(e.target.checked)} /> {t('oc.edit')}
        </label>
        <label>
          <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} /> {t('oc.showHidden')}
          {showHidden && hiddenTotal ? <small> ({t('oc.hiddenCount', { n: hiddenTotal })})</small> : null}
        </label>
        <button type="button" onClick={() => setOpenAll(o => ({ n: o.n + 1, open: true }))}>{t('oc.expandAll')}</button>
        <button type="button" onClick={() => setOpenAll(o => ({ n: o.n + 1, open: false }))}>{t('oc.collapseAll')}</button>
        <button type="button" onClick={exportExcel} disabled={!suppliers.length}>{t('oc.export')}</button>
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
          expand={s => (
            <PlanTable
              rows={s.rows}
              cols={itemCols}
              rowKey={r => r.sku}
              initialSort={{ key: 'left', dir: 'asc' }}
              filterPlaceholder={t('oc.filter')}
              rowStyle={r => (r.hidden ? { opacity: 0.5 } : r.stock <= 0 ? { background: 'rgba(127, 127, 127, 0.12)' } : undefined)}
              lead={
                editing
                  ? {
                      header: t('oc.hide'),
                      cell: r => (
                        <input
                          type="checkbox"
                          checked={r.hidden}
                          disabled={busy === r.sku}
                          aria-label={`${t('oc.hide')} ${r.sku}`}
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
    </div>
  )
}
