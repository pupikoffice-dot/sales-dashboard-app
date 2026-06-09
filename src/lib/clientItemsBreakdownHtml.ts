import type { DashboardFiltersState } from '../context/DashboardFiltersContext'
import { fmt, fmt0, MONTH_NAMES } from './format'
import { escapeHtml } from './escapeHtml'
import { getWmsQty } from './salesMetrics'
import { getDualMonthCols } from './salesDateFilter'
import { buildMonthTotalsIndex, getMonthTotal } from './salesMonthAggregate'
import type { LogicalCompany, SalesRow } from '../types/dashboard'
import type { WmsStockMap } from './wmsData'

function groupBySku(rows: SalesRow[]) {
  const items: Record<string, { name: string; rows: SalesRow[] }> = {}
  for (const r of rows) {
    if (!r.itemSKU) continue
    const sku = r.itemSKU
    if (!items[sku]) items[sku] = { name: r.itemName || sku, rows: [] }
    items[sku].rows.push(r)
  }
  return items
}

function dualMonthCellHtml(
  curCash: number,
  curQty: number,
  prevCash: number,
  prevQty: number,
): string {
  const s1 = curCash < prevCash ? 'color:var(--red)' : ''
  const s2 = prevCash < curCash ? 'color:var(--red)' : ''
  return (
    `<td data-sv="${curCash}" data-qty="${curQty}" data-pv="${prevCash}" data-pqty="${prevQty}">` +
    `<div style="${s1}">${fmt0(curCash)}<br/><span class="cm" style="font-size:.72rem">(${fmt0(curQty)})</span></div>` +
    `<div class="mo-prev" style="${s2}">${fmt0(prevCash)}<br/><span class="cm" style="font-size:.65rem">(${fmt0(prevQty)})</span></div>` +
    `</td>`
  )
}

export function buildItemsUnderClientHtml(
  rows: SalesRow[],
  historyBySku: Map<string, SalesRow[]>,
  filters: DashboardFiltersState,
  company: LogicalCompany,
  wmsStock: WmsStockMap,
): string {
  const items = groupBySku(rows)
  const entries = Object.entries(items).sort((a, b) => a[1].name.localeCompare(b[1].name))
  if (!entries.length) return ''

  const isSimple = filters.dateMode === 'range' || filters.dateMode === 'openorders'

  if (isSimple) {
    let h =
      '<div class="tw"><table><thead><tr>' +
      '<th class="sortable">SKU<span class="si"> ↕</span></th>' +
      '<th class="sortable">Item Name<span class="si"> ↕</span></th>' +
      '<th class="sortable" data-pie-qty>Qty<span class="si"> ↕</span></th>' +
      '<th class="sortable" data-pie-cash>Cash<span class="si"> ↕</span></th>' +
      '<th class="sortable">Stock<span class="si"> ↕</span></th>' +
      '</tr></thead><tbody>'
    let tq = 0
    let tc = 0
    for (const [sku, it] of entries) {
      let cash = 0
      let qty = 0
      for (const r of it.rows) {
        cash += r.cash || 0
        qty += r.qty || 0
      }
      tq += qty
      tc += cash
      const sq = getWmsQty(sku, company, wmsStock)
      h +=
        `<tr><td>${escapeHtml(sku)}</td>` +
        `<td title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</td>` +
        `<td data-sv="${qty}">${fmt(qty)}</td>` +
        `<td data-sv="${cash}">${fmt(cash)}</td>` +
        `<td data-sv="${sq ?? -1}" class="accent2">${sq != null ? fmt0(sq) : '—'}</td></tr>`
    }
    h += `</tbody><tfoot><tr><td>—</td><td>Total</td><td>${fmt(tq)}</td><td>${fmt(tc)}</td><td>—</td></tr></tfoot></table></div>`
    return h
  }

  const cols = getDualMonthCols(filters.selectedMonths)
  let h =
    '<div class="tw tw-months"><table class="tw-dual-months"><thead><tr>' +
    '<th class="sortable">SKU<span class="si"> ↕</span></th>' +
    '<th class="sortable">Item Name<span class="si"> ↕</span></th>'
  for (const dc of cols) {
    h +=
      `<th class="sortable">${MONTH_NAMES[dc.m - 1]}` +
      `<br/><small class="dual-year-label">${dc.cur}/${String(dc.prev).slice(2)}</small>` +
      `<span class="si"> ↕</span></th>`
  }
  h +=
    '<th class="sortable" data-pie-cash>Total Cash<span class="si"> ↕</span></th>' +
    '<th class="sortable" data-pie-qty>Total Qty<span class="si"> ↕</span></th>' +
    '<th class="sortable accent2">Stock<span class="si"> ↕</span></th></tr></thead><tbody>'

  let gc = 0
  let gq = 0
  const gmc1: Record<number, number> = {}
  const gmq1: Record<number, number> = {}
  const gmc2: Record<number, number> = {}
  const gmq2: Record<number, number> = {}

  for (const [sku, it] of entries) {
    const curIndex = buildMonthTotalsIndex(it.rows)
    const compareRows = historyBySku.get(sku) ?? []
    const cmpIndex = buildMonthTotalsIndex(compareRows)
    let rc = 0
    let rq = 0
    h += `<tr><td>${escapeHtml(sku)}</td><td title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</td>`
    for (const dc of cols) {
      const cur = getMonthTotal(curIndex, dc.cur, dc.m)
      const prev = getMonthTotal(cmpIndex, dc.prev, dc.m)
      h += dualMonthCellHtml(cur.cash, cur.qty, prev.cash, prev.qty)
      rc += cur.cash
      rq += cur.qty
      gmc1[dc.m] = (gmc1[dc.m] || 0) + cur.cash
      gmq1[dc.m] = (gmq1[dc.m] || 0) + cur.qty
      gmc2[dc.m] = (gmc2[dc.m] || 0) + prev.cash
      gmq2[dc.m] = (gmq2[dc.m] || 0) + prev.qty
    }
    const sq = getWmsQty(sku, company, wmsStock)
    h +=
      `<td data-sv="${rc}" style="font-weight:700">${fmt(rc)}</td>` +
      `<td data-sv="${rq}" class="cm">${fmt(rq)}</td>` +
      `<td data-sv="${sq ?? -1}" class="accent2">${sq != null ? fmt0(sq) : '—'}</td></tr>`
    gc += rc
    gq += rq
  }

  h += '</tbody><tfoot><tr><td>—</td><td>Total</td>'
  for (const dc of cols) {
    const c1 = gmc1[dc.m] || 0
    const q1 = gmq1[dc.m] || 0
    const c2 = gmc2[dc.m] || 0
    const q2 = gmq2[dc.m] || 0
    h += dualMonthCellHtml(c1, q1, c2, q2)
  }
  h += `<td data-sv="${gc}">${fmt(gc)}</td><td data-sv="${gq}" class="cm">${fmt(gq)}</td><td>—</td></tr></tfoot></table></div>`
  return h
}

export function buildClientSectionHtml(
  cid: string,
  name: string,
  rows: SalesRow[],
  historyBySku: Map<string, SalesRow[]>,
  filters: DashboardFiltersState,
  company: LogicalCompany,
  wmsStock: WmsStockMap,
  cash: number,
  qty: number,
  collapsed: boolean,
): string {
  const body = buildItemsUnderClientHtml(rows, historyBySku, filters, company, wmsStock)
  const collapsedClass = collapsed ? ' collapsed' : ''
  return (
    `<div class="section${collapsedClass}" data-export-name="${escapeHtml(name)}" data-export-id="${escapeHtml(cid)}">` +
    `<div class="section-title" role="button" tabindex="0">` +
    `👤 ${escapeHtml(name)} <span class="section-meta">${escapeHtml(cid)}</span>` +
    `<span class="collapse-icon">▾</span></div>` +
    `<div class="section-sum"><span>Cash: <b>${fmt(cash)}</b></span><span>Qty: <b>${fmt(qty)}</b></span></div>` +
    `<div class="section-body">${body}</div></div>`
  )
}

export function buildClientHistoryBySku(companyRows: SalesRow[]) {
  const rowsByClient = new Map<string, SalesRow[]>()
  const bySkuByClient = new Map<string, Map<string, SalesRow[]>>()

  for (const r of companyRows) {
    if (!r.clientID) continue
    let clientRows = rowsByClient.get(r.clientID)
    if (!clientRows) {
      clientRows = []
      rowsByClient.set(r.clientID, clientRows)
    }
    clientRows.push(r)

    if (!r.itemSKU) continue
    let skuMap = bySkuByClient.get(r.clientID)
    if (!skuMap) {
      skuMap = new Map()
      bySkuByClient.set(r.clientID, skuMap)
    }
    let skuRows = skuMap.get(r.itemSKU)
    if (!skuRows) {
      skuRows = []
      skuMap.set(r.itemSKU, skuRows)
    }
    skuRows.push(r)
  }

  return { rowsByClient, bySkuByClient }
}
