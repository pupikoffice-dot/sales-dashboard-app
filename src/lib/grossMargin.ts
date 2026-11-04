/**
 * Gross margin for the R&D reports (pure calculation).
 *
 * The database returns, per group (a year, a month, a brand, an item, a client), two sums over the net sales of items that HAVE a cost:
 *   cost    = net qty x unit cost
 *   covered = the net sales of those same items
 * Items without a cost are left out of both (never treated as zero), so
 *   margin   = covered - cost
 *   margin % = margin / covered           (share of the net sales that had a cost)
 *   coverage = covered / net sales        (how much of the group's net sales the margin speaks for)
 * Users who may not see item costs get null from the database; every function here turns null into null.
 */

export interface CostCover {
  cost: number | null | undefined
  covered: number | null | undefined
}

export interface MarginFigures {
  /** covered - cost, rounded to 2 decimals; null when no sale of the group had a cost */
  margin: number | null
  /** margin / covered as a fraction (0.25 = 25%), rounded to 4 decimals; null when covered is not positive */
  pct: number | null
  /** covered / net as a fraction, null when net is not positive or unknown */
  coverage: number | null
}

export const EMPTY_MARGIN: MarginFigures = { margin: null, pct: null, coverage: null }

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const round = (v: number, digits: number) => {
  const f = 10 ** digits
  return Math.round((v + Number.EPSILON) * f) / f
}

/** Margin, margin % and coverage of one group. `net` is the group's net sales (for coverage). */
export function marginOf(c: CostCover | null | undefined, net?: number | null): MarginFigures {
  if (!c) return EMPTY_MARGIN
  const cost = toNum(c.cost)
  const covered = toNum(c.covered)
  if (cost == null || covered == null) return EMPTY_MARGIN
  const margin = round(covered - cost, 2)
  const n = toNum(net)
  return {
    margin,
    pct: covered > 0 ? round(margin / covered, 4) : null,
    coverage: n != null && n > 0 ? round(covered / n, 4) : null,
  }
}

/** Add up groups. Groups with no cost data (null) are skipped; null when none had any. */
export function sumCover(list: ReadonlyArray<CostCover | null | undefined>): { cost: number; covered: number } | null {
  let cost = 0
  let covered = 0
  let any = false
  for (const c of list) {
    if (!c) continue
    const k = toNum(c.cost)
    const v = toNum(c.covered)
    if (k == null || v == null) continue
    cost += k
    covered += v
    any = true
  }
  return any ? { cost, covered } : null
}

/** Margin of one invoice line: net sales minus qty x unit cost. Null when the line has no unit cost (or no right to see it). */
export function lineMargin(cash: number, qty: number, unitCost: number | null | undefined): number | null {
  const u = toNum(unitCost)
  if (u == null) return null
  return round(cash - qty * u, 2)
}

/** Total margin of invoice lines, only over lines that have a unit cost; returns the covered sales too. */
export function linesMargin(
  rows: ReadonlyArray<{ cash: number; qty: number; unitCost?: number | null; isReturn?: boolean }>,
  opts: { skipReturns?: boolean } = {},
): { cost: number; covered: number } | null {
  const parts: CostCover[] = []
  for (const r of rows) {
    if (opts.skipReturns && r.isReturn) continue
    const u = toNum(r.unitCost)
    if (u == null) continue
    parts.push({ cost: r.qty * u, covered: r.cash })
  }
  return sumCover(parts)
}

/** True when the payload carries cost data at all (the user may see costs and at least one group has a cost). */
export function hasMarginData(list: ReadonlyArray<CostCover | null | undefined>): boolean {
  return list.some(c => c && toNum(c.cost) != null && toNum(c.covered) != null)
}

/** 0.2534 -> "25.3%"; null -> "—". */
export function fmtPct(v: number | null | undefined): string {
  return finite(v) ? `${(v * 100).toFixed(1)}%` : '—'
}

/** Coverage as a whole percent for the note: 0.934 -> 93; never rounds up to 100 while something is left out. */
export function coveragePercent(coverage: number | null | undefined): number | null {
  if (!finite(coverage)) return null
  const p = Math.round(coverage * 100)
  return p >= 100 && coverage < 1 ? 99 : p
}

/** Index rows by a key (later rows replace earlier ones). */
export function indexBy<T, K>(rows: readonly T[] | null | undefined, key: (r: T) => K): Map<K, T> {
  const m = new Map<K, T>()
  for (const r of rows ?? []) m.set(key(r), r)
  return m
}

export type WithMargin<T> = T & { margin: number | null; marginPct: number | null; coverage: number | null }

/**
 * Add margin, margin % and coverage to rows that have a net-sales figure, by key. Several margin entries with the same key
 * (for example one brand over many months) are added up first. Rows without a margin entry get nulls.
 */
export function attachMargin<T, E extends CostCover>(
  rows: readonly T[],
  entries: ReadonlyArray<E> | null | undefined,
  keyOfRow: (r: T) => string | number,
  keyOfEntry: (e: E) => string | number,
  netOfRow: (r: T) => number,
): Array<WithMargin<T>> {
  const groups = new Map<string | number, CostCover[]>()
  for (const e of entries ?? []) {
    const k = keyOfEntry(e)
    const g = groups.get(k)
    if (g) g.push(e)
    else groups.set(k, [e])
  }
  return rows.map(r => {
    const g = groups.get(keyOfRow(r))
    const f = marginOf(g ? sumCover(g) : null, netOfRow(r))
    return { ...r, margin: f.margin, marginPct: f.pct, coverage: f.coverage }
  })
}

/** Overall figures for a list of groups whose net sales are known: margin, margin % and the share of net sales that had a cost. */
export function overallMargin(
  entries: ReadonlyArray<CostCover> | null | undefined,
  netTotal: number | null | undefined,
): MarginFigures {
  return marginOf(sumCover(entries ?? []), netTotal)
}
