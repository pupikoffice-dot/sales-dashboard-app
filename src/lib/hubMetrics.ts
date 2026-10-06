/**
 * Data for the Oversight "Hub" layout (chart-first). Pure functions over the rows the dashboard already
 * loaded (access-scoped by useDashboardData), combined across the companies on screen.
 * Tags: sales rows carry company = 'pupik' | 'mt' | …; orders / open orders / delivery notes carry the
 * per-company tags from OVERSITE_COMPANIES (resolved with resolveOrdersTag / resolveOpenOrdersTag).
 */
import { normalizeSalesDate } from './salesDate'
import type { OversiteDateContext } from './oversiteMetrics'
import type { LogicalCompany, SalesRow } from '../types/dashboard'

export interface HubCompany {
  id: LogicalCompany
  /** Short label for charts, e.g. "Pupik". */
  short: string
  ordersTag: string
  openOrdersTag: string
}

export interface DayPoint { date: string; cash: number; qty: number; orders: number; clients: number }
export interface AgentRow { company: LogicalCompany; agent: string; clients: number; qty: number; cash: number }
export interface MonthPoint { ym: string; year: number; month: number; cash: number }
export interface TreeItem { label: string; sku: string; company: LogicalCompany; cash: number }
export interface Heatmap { rows: { label: string; company: LogicalCompany; values: number[] }[]; months: MonthPoint[]; max: number }
export interface CategorySeries { months: MonthPoint[]; series: { label: string; values: number[] }[] }

const n = (v: unknown) => Number(v) || 0

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The last `count` calendar months ending with the current one (oldest first). */
export function lastMonths(ctx: Pick<OversiteDateContext, 'curYear' | 'curMonth'>, count: number): MonthPoint[] {
  const out: MonthPoint[] = []
  for (let i = count - 1; i >= 0; i--) {
    const k = ctx.curYear * 12 + (ctx.curMonth - 1) - i
    const year = Math.floor(k / 12)
    const month = (k % 12) + 1
    out.push({ ym: `${year}-${String(month).padStart(2, '0')}`, year, month, cash: 0 })
  }
  return out
}

/** Per-day totals for rows whose company tag is in `tags`, from `fromIso` to `toIso` inclusive (every day present). */
export function dailySeries(rows: SalesRow[], tags: Set<string>, fromIso: string, toIso: string): DayPoint[] {
  const days = new Map<string, { cash: number; qty: number; docs: Set<string>; clients: Set<string> }>()
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) days.set(d, { cash: 0, qty: 0, docs: new Set(), clients: new Set() })
  for (const r of rows) {
    if (!tags.has(r.company)) continue
    const d = normalizeSalesDate(r.date)
    if (!d) continue
    const b = days.get(d)
    if (!b) continue
    b.cash += n(r.cash)
    b.qty += n(r.qty)
    if (r.docNum) b.docs.add(`${r.company}|${r.docNum}`)
    if (r.clientID) b.clients.add(`${r.company}|${r.clientID}`)
  }
  return [...days.entries()].map(([date, b]) => ({ date, cash: b.cash, qty: b.qty, orders: b.docs.size, clients: b.clients.size }))
}

/** Orders (or any tagged rows) in a date range, grouped by company + agent, biggest cash first. */
export function agentLeaderboard(
  rows: SalesRow[], tagToCompany: Map<string, LogicalCompany>, fromIso: string, toIso: string, limit = 10,
): AgentRow[] {
  const m = new Map<string, { company: LogicalCompany; agent: string; clients: Set<string>; qty: number; cash: number }>()
  for (const r of rows) {
    const co = tagToCompany.get(r.company)
    if (!co) continue
    const d = normalizeSalesDate(r.date)
    if (!d || d < fromIso || d > toIso) continue
    const agent = String(r.agent ?? '').trim() || '—'
    const key = `${co}|${agent}`
    let a = m.get(key)
    if (!a) m.set(key, (a = { company: co, agent, clients: new Set(), qty: 0, cash: 0 }))
    a.qty += n(r.qty)
    a.cash += n(r.cash)
    if (r.clientID) a.clients.add(String(r.clientID))
  }
  return [...m.values()]
    .map(a => ({ company: a.company, agent: a.agent, clients: a.clients.size, qty: a.qty, cash: a.cash }))
    .sort((x, y) => y.cash - x.cash)
    .slice(0, limit)
}

/** Sales cash per month (combined companies) for the given months. */
export function monthlySales(rows: SalesRow[], companies: Set<string>, months: MonthPoint[]): MonthPoint[] {
  const idx = new Map(months.map((p, i) => [p.year * 12 + p.month, i]))
  const out = months.map(p => ({ ...p, cash: 0 }))
  for (const r of rows) {
    if (!companies.has(r.company)) continue
    const i = idx.get(n(r.year) * 12 + n(r.month))
    if (i === undefined) continue
    out[i].cash += n(r.cash)
  }
  return out
}

/** Agent x month sales cash for the top `limit` agents (by total over the months). */
export function agentMonthHeatmap(
  rows: SalesRow[], companies: Set<string>, months: MonthPoint[], shortLabel: (co: LogicalCompany) => string, limit = 12,
): Heatmap {
  const idx = new Map(months.map((p, i) => [p.year * 12 + p.month, i]))
  const m = new Map<string, { company: LogicalCompany; agent: string; values: number[] }>()
  for (const r of rows) {
    if (!companies.has(r.company)) continue
    const i = idx.get(n(r.year) * 12 + n(r.month))
    if (i === undefined) continue
    const agent = String(r.agent ?? '').trim()
    if (!agent) continue
    const key = `${r.company}|${agent}`
    let a = m.get(key)
    if (!a) m.set(key, (a = { company: r.company as LogicalCompany, agent, values: months.map(() => 0) }))
    a.values[i] += n(r.cash)
  }
  const top = [...m.values()]
    .sort((x, y) => y.values.reduce((s, v) => s + v, 0) - x.values.reduce((s, v) => s + v, 0))
    .slice(0, limit)
  const max = Math.max(0, ...top.flatMap(a => a.values))
  return {
    months,
    max,
    rows: top.map(a => ({ label: `${shortLabel(a.company)} · ${a.agent}`, company: a.company, values: a.values })),
  }
}

/** Top items by sales cash in one month (combined companies). */
export function topItems(rows: SalesRow[], companies: Set<string>, year: number, month: number, limit = 16): TreeItem[] {
  const m = new Map<string, TreeItem>()
  for (const r of rows) {
    if (!companies.has(r.company) || n(r.year) !== year || n(r.month) !== month) continue
    const sku = String(r.itemSKU ?? '').trim()
    if (!sku) continue
    const key = `${r.company}|${sku}`
    let t = m.get(key)
    if (!t) m.set(key, (t = { label: String(r.itemName ?? '').trim() || sku, sku, company: r.company as LogicalCompany, cash: 0 }))
    t.cash += n(r.cash)
  }
  return [...m.values()].filter(t => t.cash > 0).sort((a, b) => b.cash - a.cash).slice(0, limit)
}

/** Sales cash per category (tablet category) per month; the top `limit` categories, the rest as "Other". */
export function categoryByMonth(rows: SalesRow[], companies: Set<string>, months: MonthPoint[], otherLabel: string, limit = 6): CategorySeries {
  const idx = new Map(months.map((p, i) => [p.year * 12 + p.month, i]))
  const m = new Map<string, number[]>()
  for (const r of rows) {
    if (!companies.has(r.company)) continue
    const i = idx.get(n(r.year) * 12 + n(r.month))
    if (i === undefined) continue
    const cat = String(r.tabletCat ?? '').trim() || otherLabel
    let v = m.get(cat)
    if (!v) m.set(cat, (v = months.map(() => 0)))
    v[i] += n(r.cash)
  }
  const ranked = [...m.entries()].sort((a, b) => b[1].reduce((s, x) => s + x, 0) - a[1].reduce((s, x) => s + x, 0))
  const keep = ranked.filter(([k]) => k !== otherLabel).slice(0, limit)
  const rest = months.map((_, i) => ranked.filter(([k]) => !keep.some(([kk]) => kk === k)).reduce((s, [, v]) => s + v[i], 0))
  const series = keep.map(([label, values]) => ({ label, values }))
  if (rest.some(v => v !== 0)) series.push({ label: otherLabel, values: rest })
  return { months, series }
}

/** Squarified treemap layout (Bruls et al.): returns rectangles in [0,1]x[0,1] for positive values, same order. */
export function squarify(values: number[]): { x: number; y: number; w: number; h: number }[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0)
  const out: { x: number; y: number; w: number; h: number }[] = values.map(() => ({ x: 0, y: 0, w: 0, h: 0 }))
  if (total <= 0) return out
  const items = values.map((v, i) => ({ i, a: Math.max(0, v) / total })).filter(t => t.a > 0)
  let x = 0, y = 0, w = 1, h = 1
  let row: typeof items = []
  const worst = (r: typeof items, side: number) => {
    const s = r.reduce((t, it) => t + it.a, 0)
    const mx = Math.max(...r.map(it => it.a)), mn = Math.min(...r.map(it => it.a))
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn))
  }
  const layout = (r: typeof items) => {
    const s = r.reduce((t, it) => t + it.a, 0)
    if (w >= h) {
      const cw = s / h
      let cy = y
      for (const it of r) { const ch = it.a / cw; out[it.i] = { x, y: cy, w: cw, h: ch }; cy += ch }
      x += cw; w -= cw
    } else {
      const ch = s / w
      let cx = x
      for (const it of r) { const cw = it.a / ch; out[it.i] = { x: cx, y, w: cw, h: ch }; cx += cw }
      y += ch; h -= ch
    }
  }
  for (const it of items) {
    const side = Math.min(w, h)
    if (!row.length || worst([...row, it], side) <= worst(row, side)) row.push(it)
    else { layout(row); row = [it] }
  }
  if (row.length) layout(row)
  return out
}

export { addDays }
