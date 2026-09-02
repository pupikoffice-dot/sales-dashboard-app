import type { DashboardFiltersState } from '../context/DashboardFiltersContext'
import { fmt, fmt0, fmt2, MONTH_NAMES } from './format'
import { escapeHtml } from './escapeHtml'
import { getWmsQty } from './salesMetrics'
import { getDualMonthCols } from './salesDateFilter'
import {
  buildMonthTotalsIndex,
  getMonthTotal,
  type MonthTotalsIndex,
} from './salesMonthAggregate'
import { groupSalesRowsBySkuWithNames } from './itemNames'
import type { LogicalCompany, SalesRow, SkuValueMap } from '../types/dashboard'
import type { WmsStockMap } from './wmsData'

function groupBySku(rows: SalesRow[], nameSourceRows: SalesRow[] = []) {
  return groupSalesRowsBySkuWithNames(rows, nameSourceRows)
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
  historyMonthIndexBySku: Map<string, MonthTotalsIndex>,
  filters: DashboardFiltersState,
  company: LogicalCompany,
  wmsStock: WmsStockMap,
  dualMonthCols?: ReturnType<typeof getDualMonthCols>,
  itemPrice?: SkuValueMap,
  showClientProfit = false,
  /** Translated "cash (units)" micro-label for the month headers. */
  monthMicroLabel = '',
  nameSourceRows: SalesRow[] = [],
): string {
  const items = groupBySku(rows, nameSourceRows)
  const entries = Object.entries(items).sort((a, b) => a[1].name.localeCompare(b[1].name))
  if (!entries.length) return ''

  const priceData = itemPrice?.[company] ?? {}
  const isSimple = filters.dateMode === 'range' || filters.dateMode === 'openorders'

  if (isSimple) {
    let h =
      '<div class="tw"><table><thead><tr>' +
      '<th class="sortable">SKU<span class="si"> ↕</span></th>' +
      '<th class="sortable">Item Name<span class="si"> ↕</span></th>' +
      '<th class="sortable" data-pie-qty>Qty<span class="si"> ↕</span></th>' +
      '<th class="sortable" data-pie-cash>Cash<span class="si"> ↕</span></th>' +
      '<th class="sortable">Stock<span class="si"> ↕</span></th>'
    if (showClientProfit) h += '<th class="sortable">Price<span class="si"> ↕</span></th>'
    h += '</tr></thead><tbody>'
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
      const price = priceData[sku]
      h +=
        `<tr><td>${escapeHtml(sku)}</td>` +
        `<td title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</td>` +
        `<td data-sv="${qty}">${fmt(qty)}</td>` +
        `<td data-sv="${cash}">${fmt(cash)}</td>` +
        `<td data-sv="${sq ?? -1}" class="accent2">${sq != null ? fmt0(sq) : '—'}</td>`
      if (showClientProfit) {
        h += `<td data-sv="${price ?? ''}">${price != null ? fmt2(price) : '—'}</td>`
      }
      h += '</tr>'
    }
    h += `</tbody><tfoot><tr><td>—</td><td>Total</td><td>${fmt(tq)}</td><td>${fmt(tc)}</td><td>—</td>`
    if (showClientProfit) h += '<td>—</td>'
    h += '</tr></tfoot></table></div>'
    return h
  }

  const cols = dualMonthCols ?? getDualMonthCols(filters.selectedMonths)
  let h =
    '<div class="tw tw-months"><table class="tw-dual-months"><thead><tr>' +
    '<th class="sortable">SKU<span class="si"> ↕</span></th>' +
    '<th class="sortable">Item Name<span class="si"> ↕</span></th>'
  for (const dc of cols) {
    h +=
      `<th class="sortable">${MONTH_NAMES[dc.m - 1]}` +
      `<br/><small class="dual-year-label">${dc.cur}/${String(dc.prev).slice(2)}</small>` +
      (monthMicroLabel ? `<br/><small class="col-micro">${escapeHtml(monthMicroLabel)}</small>` : '') +
      `<span class="si"> ↕</span></th>`
  }
  h +=
    '<th class="sortable" data-pie-cash>Total Cash<span class="si"> ↕</span></th>' +
    '<th class="sortable" data-pie-qty>Total Qty<span class="si"> ↕</span></th>' +
    '<th class="sortable accent2">Stock<span class="si"> ↕</span></th>'
  if (showClientProfit) h += '<th class="sortable">Price<span class="si"> ↕</span></th>'
  h += '</tr></thead><tbody>'

  let gc = 0
  let gq = 0
  const gmc1: Record<number, number> = {}
  const gmq1: Record<number, number> = {}
  const gmc2: Record<number, number> = {}
  const gmq2: Record<number, number> = {}

  for (const [sku, it] of entries) {
    const curIndex = buildMonthTotalsIndex(it.rows)
    const cmpIndex = historyMonthIndexBySku.get(sku) ?? new Map()
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
    const price = priceData[sku]
    h +=
      `<td data-sv="${rc}" style="font-weight:700">${fmt(rc)}</td>` +
      `<td data-sv="${rq}" class="cm">${fmt(rq)}</td>` +
      `<td data-sv="${sq ?? -1}" class="accent2">${sq != null ? fmt0(sq) : '—'}</td>`
    if (showClientProfit) {
      h += `<td data-sv="${price ?? ''}">${price != null ? fmt2(price) : '—'}</td>`
    }
    h += '</tr>'
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
  h += `<td data-sv="${gc}">${fmt(gc)}</td><td data-sv="${gq}" class="cm">${fmt(gq)}</td><td>—</td>`
  if (showClientProfit) h += '<td>—</td>'
  h += '</tr></tfoot></table></div>'
  return h
}

export function buildClientSectionHtml(
  cid: string,
  name: string,
  rows: SalesRow[],
  historyMonthIndexBySku: Map<string, MonthTotalsIndex>,
  filters: DashboardFiltersState,
  company: LogicalCompany,
  wmsStock: WmsStockMap,
  cash: number,
  qty: number,
  collapsed: boolean,
  dualMonthCols?: ReturnType<typeof getDualMonthCols>,
  itemPrice?: SkuValueMap,
  showClientProfit = false,
  monthMicroLabel = '',
  nameSourceRows: SalesRow[] = [],
): string {
  const body = buildItemsUnderClientHtml(
    rows,
    historyMonthIndexBySku,
    filters,
    company,
    wmsStock,
    dualMonthCols,
    itemPrice,
    showClientProfit,
    monthMicroLabel,
    nameSourceRows,
  )
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

export interface ClientHistoryIndexes {
  rowsByClient: Map<string, SalesRow[]>
  monthIndexBySkuByClient: Map<string, Map<string, MonthTotalsIndex>>
}

export function buildClientHistoryIndexes(
  companyRows: SalesRow[],
  clientIds?: Set<string>,
): ClientHistoryIndexes {
  const rowsByClient = new Map<string, SalesRow[]>()
  const skuRowsByClient = new Map<string, Map<string, SalesRow[]>>()

  for (const r of companyRows) {
    if (!r.clientID) continue
    if (clientIds && !clientIds.has(r.clientID)) continue
    let clientRows = rowsByClient.get(r.clientID)
    if (!clientRows) {
      clientRows = []
      rowsByClient.set(r.clientID, clientRows)
    }
    clientRows.push(r)

    if (!r.itemSKU) continue
    let skuMap = skuRowsByClient.get(r.clientID)
    if (!skuMap) {
      skuMap = new Map()
      skuRowsByClient.set(r.clientID, skuMap)
    }
    let skuRows = skuMap.get(r.itemSKU)
    if (!skuRows) {
      skuRows = []
      skuMap.set(r.itemSKU, skuRows)
    }
    skuRows.push(r)
  }

  const monthIndexBySkuByClient = new Map<string, Map<string, MonthTotalsIndex>>()
  for (const [cid, skuMap] of skuRowsByClient) {
    const indexMap = new Map<string, MonthTotalsIndex>()
    for (const [sku, skuRows] of skuMap) {
      indexMap.set(sku, buildMonthTotalsIndex(skuRows))
    }
    monthIndexBySkuByClient.set(cid, indexMap)
  }

  return { rowsByClient, monthIndexBySkuByClient }
}

/** @deprecated Use buildClientHistoryIndexes */
export function buildClientHistoryBySku(companyRows: SalesRow[]) {
  const { rowsByClient, monthIndexBySkuByClient } = buildClientHistoryIndexes(companyRows)
  const bySkuByClient = new Map<string, Map<string, SalesRow[]>>()
  for (const [cid, clientRows] of rowsByClient) {
    const skuMap = new Map<string, SalesRow[]>()
    for (const r of clientRows) {
      if (!r.itemSKU) continue
      let arr = skuMap.get(r.itemSKU)
      if (!arr) {
        arr = []
        skuMap.set(r.itemSKU, arr)
      }
      arr.push(r)
    }
    bySkuByClient.set(cid, skuMap)
  }
  return { rowsByClient, bySkuByClient, monthIndexBySkuByClient }
}

export function buildAllClientSectionsHtml(
  clientEntries: [string, { name: string; rows: SalesRow[] }][],
  historyIndexes: ClientHistoryIndexes,
  filters: DashboardFiltersState,
  company: LogicalCompany,
  wmsStock: WmsStockMap,
  collapsed: boolean,
  itemPrice?: SkuValueMap,
  showClientProfit = false,
  monthMicroLabel = '',
): string {
  const dualMonthCols =
    filters.dateMode === 'months' ? getDualMonthCols(filters.selectedMonths) : undefined
  const parts: string[] = new Array(clientEntries.length)
  for (let i = 0; i < clientEntries.length; i++) {
    const [cid, cl] = clientEntries[i]
    let cash = 0
    let qty = 0
    for (const r of cl.rows) {
      cash += r.cash || 0
      qty += r.qty || 0
    }
    const historyMonthIndexBySku =
      historyIndexes.monthIndexBySkuByClient.get(cid) ?? new Map<string, MonthTotalsIndex>()
    const nameSourceRows = historyIndexes.rowsByClient.get(cid) ?? []
    parts[i] = buildClientSectionHtml(
      cid,
      cl.name,
      cl.rows,
      historyMonthIndexBySku,
      filters,
      company,
      wmsStock,
      cash,
      qty,
      collapsed,
      dualMonthCols,
      itemPrice,
      showClientProfit,
      monthMicroLabel,
      nameSourceRows,
    )
  }
  return parts.join('')
}
