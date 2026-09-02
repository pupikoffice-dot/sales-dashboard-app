import type { LogicalCompany, SalesRow } from '../types/dashboard'
import { preferItemName } from './itemNames'
import type { WmsNamesMap, WmsStockMap } from './wmsData'

const MIN_STOCK = 10
const SLOW_DAYS = 30
const DROP_THRESH = 0.5
const INT_MULT = 1.5
const DAY_MS = 86400000

export interface SlowMoverAlert {
  sku: string
  name: string
  qty: number
  lastDate: string
  daysGap: number
}

export interface NeverSoldAlert {
  sku: string
  name: string
  qty: number
}

export interface ClientAlert {
  clientName: string
  agent: string
  sku: string
  skuName: string
  lastDate: string
  lastBuyQty: number
  avgInt: number
  daysOverdue: number
}

export interface VelocityDropAlert {
  sku: string
  name: string
  qty: number
  baseAvg: number
  recent: number
  dropPct: number
  cat: string
}

export interface StockAlertsResult {
  slowMovers: SlowMoverAlert[]
  neverSold: NeverSoldAlert[]
  clientAlerts: ClientAlert[]
  velocityDrops: VelocityDropAlert[]
}

export function extractGroupCategories(rows: SalesRow[], co: LogicalCompany): string[] {
  const retCo = co === 'pupik' ? 'returns-pupik' : 'returns-mt'
  const cats = new Set<string>()
  for (const r of rows) {
    if (r.company !== co && r.company !== retCo) continue
    cats.add(String(r.groupCat || '(No Category)'))
  }
  return [...cats].sort((a, b) => a.localeCompare(b))
}

export function computeStockAlerts(
  rows: SalesRow[],
  co: LogicalCompany,
  wmsStock: WmsStockMap,
  wmsNames: WmsNamesMap,
  now = new Date(),
  allowedGroupCats?: Set<string>,
): StockAlertsResult {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const retCo = co === 'pupik' ? 'returns-pupik' : 'returns-mt'
  const cut30 = new Date(today.getTime() - SLOW_DAYS * DAY_MS).toISOString().slice(0, 10)
  const cut6m = new Date(today.getFullYear(), today.getMonth() - 7, 1).toISOString().slice(0, 10)
  const baseYMs: string[] = []
  for (let i = 2; i <= 7; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    baseYMs.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const skuGroupCat: Record<string, string> = {}

  const sm: Record<
    string,
    {
      netTotal: number
      lastSaleDate: string | null
      netByDate: Record<string, number>
      netByYM: Record<string, number>
      cat: string
      groupCat: string
      supplier: string
    }
  > = {}

  const skuAllowed = (sku: string) => {
    if (!allowedGroupCats) return true
    if (allowedGroupCats.size === 0) return false
    const cat = skuGroupCat[sku] || '(No Category)'
    return allowedGroupCats.has(cat)
  }

  const pm: Record<
    string,
    {
      clientName: string
      agent: string
      sku: string
      skuName: string
      netByDate: Record<string, number>
    }
  > = {}

  rows.forEach(r => {
    const isSale = r.company === co
    const isReturn = r.company === retCo
    if (!isSale && !isReturn) return
    if (!r.itemSKU || !r.date) return
    const sku = String(r.itemSKU)
    const rawQty = Number(r.qty) || 0
    const netQty = isSale ? rawQty : -Math.abs(rawQty)
    const groupCat = String(r.groupCat || '(No Category)')
    if (r.groupCat) skuGroupCat[sku] = String(r.groupCat)

    if (!sm[sku]) {
      sm[sku] = {
        netTotal: 0,
        lastSaleDate: null,
        netByDate: {},
        netByYM: {},
        cat: '',
        groupCat,
        supplier: '',
      }
    }
    sm[sku].netByDate[r.date] = (sm[sku].netByDate[r.date] || 0) + netQty
    sm[sku].netByYM[r.date.slice(0, 7)] = (sm[sku].netByYM[r.date.slice(0, 7)] || 0) + netQty
    sm[sku].netTotal += netQty
    if (isSale && rawQty > 0) {
      if (!sm[sku].lastSaleDate || r.date > sm[sku].lastSaleDate) sm[sku].lastSaleDate = r.date
      if (r.tabletCat && !sm[sku].cat) sm[sku].cat = String(r.tabletCat)
      if (r.supplier && !sm[sku].supplier) sm[sku].supplier = String(r.supplier)
    }
    if (!r.clientID || r.date < cut6m) return
    const pkey = `${r.clientID}|${sku}`
    if (!pm[pkey]) {
      pm[pkey] = {
        clientName: String(r.clientName || r.clientID),
        agent: String(r.agent || ''),
        sku,
        skuName: wmsNames[co]?.[sku] || String(r.itemName || sku),
        netByDate: {},
      }
    }
    pm[pkey].skuName = preferItemName(
      pm[pkey].skuName,
      wmsNames[co]?.[sku] || r.itemName,
    )
    pm[pkey].netByDate[r.date] = (pm[pkey].netByDate[r.date] || 0) + netQty
    if (isSale && rawQty > 0 && !pm[pkey].agent && r.agent) pm[pkey].agent = String(r.agent)
  })

  const wco = wmsStock[co] || {}
  const neverSold: NeverSoldAlert[] = []
  const slowMovers: (SlowMoverAlert & { score: number })[] = []

  Object.entries(wco).forEach(([sku, qty]) => {
    if (qty < MIN_STOCK) return
    if (!skuAllowed(sku)) return
    const name = wmsNames[co]?.[sku] || sku
    const s = sm[sku]
    if (!s || s.netTotal <= 0) {
      neverSold.push({ sku, name, qty })
    } else {
      const recent = Object.entries(s.netByDate)
        .filter(([d]) => d >= cut30)
        .reduce((a, [, v]) => a + v, 0)
      if (recent <= 0) {
        const lastDate = s.lastSaleDate || ''
        const daysGap = lastDate ? Math.round((today.getTime() - new Date(lastDate).getTime()) / DAY_MS) : 9999
        slowMovers.push({ sku, name, qty, lastDate, daysGap, score: qty * daysGap })
      }
    }
  })

  slowMovers.sort((a, b) => b.score - a.score)
  neverSold.sort((a, b) => b.qty - a.qty)

  const clientAlerts: ClientAlert[] = []
  Object.values(pm).forEach(p => {
    if (!(wco[p.sku] > 0)) return
    if (!skuAllowed(p.sku)) return
    const pDates = Object.entries(p.netByDate)
      .filter(([, v]) => v > 0)
      .map(([d]) => d)
      .sort()
    if (pDates.length < 2) return
    let totalInt = 0
    for (let i = 1; i < pDates.length; i++) {
      totalInt += (new Date(pDates[i]).getTime() - new Date(pDates[i - 1]).getTime()) / DAY_MS
    }
    const avgInt = totalInt / (pDates.length - 1)
    const lastDate = pDates[pDates.length - 1]
    const daysSince = Math.round((today.getTime() - new Date(lastDate).getTime()) / DAY_MS)
    if (daysSince > INT_MULT * avgInt) {
      clientAlerts.push({
        clientName: p.clientName,
        agent: p.agent,
        sku: p.sku,
        skuName: p.skuName,
        lastDate,
        lastBuyQty: Math.round(p.netByDate[lastDate] || 0),
        avgInt: Math.round(avgInt),
        daysOverdue: Math.round(daysSince - INT_MULT * avgInt),
      })
    }
  })
  clientAlerts.sort((a, b) => b.daysOverdue - a.daysOverdue)

  const velocityDrops: VelocityDropAlert[] = []
  Object.entries(wco).forEach(([sku, qty]) => {
    if (qty < MIN_STOCK) return
    if (!skuAllowed(sku)) return
    const s = sm[sku]
    if (!s) return
    const baseAvg = baseYMs.reduce((a, ym) => a + (s.netByYM[ym] || 0), 0) / baseYMs.length
    if (baseAvg <= 0) return
    const recent = Object.entries(s.netByDate)
      .filter(([d]) => d >= cut30)
      .reduce((a, [, v]) => a + v, 0)
    if (recent < baseAvg * DROP_THRESH) {
      velocityDrops.push({
        sku,
        name: wmsNames[co]?.[sku] || sku,
        qty,
        baseAvg: Math.round(baseAvg * 10) / 10,
        recent: Math.round(recent * 10) / 10,
        dropPct: Math.round(((baseAvg - recent) / baseAvg) * 100),
        cat: s.cat,
      })
    }
  })
  velocityDrops.sort((a, b) => b.dropPct - a.dropPct)

  return {
    slowMovers: slowMovers.slice(0, 10).map(({ sku, name, qty, lastDate, daysGap }) => ({
      sku,
      name,
      qty,
      lastDate,
      daysGap,
    })),
    neverSold: neverSold.slice(0, 10),
    clientAlerts: clientAlerts.slice(0, 20),
    velocityDrops: velocityDrops.slice(0, 10),
  }
}
