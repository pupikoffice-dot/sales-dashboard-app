// R&D > Expenses: pure calculations over the rows of get_expense_data (no React, no network).
// Amounts: cash ILS; positive = expense, negative = credit to the card (lowers the expense).

export type ExpenseCategory = { code: string; label: string }
export type ExpenseCard = { co: string; card: string; name: string; cat: string; src: 'auto' | 'owner' }
export type ExpenseLine = { co: string; y: number; card: string; m: Record<string, number> }
export type ExpenseLoad = { co: string; y: number; at: string }
export type ExpenseRevenue = { co: string; y: number; m: Record<string, number> }
export type ExpenseData = { categories: ExpenseCategory[]; loads: ExpenseLoad[]; cards: ExpenseCard[]; lines: ExpenseLine[]; revenue?: ExpenseRevenue[] }

export const EXPENSE_COMPANIES = ['pupik', 'mt', 'gold', 'baloo'] as const
export type ExpenseCompany = (typeof EXPENSE_COMPANIES)[number]
export const INTERCOMPANY = 'intercompany'
export const UNCLASSIFIED = 'unclassified'

export function expenseCompanyLabel(co: string): string {
  return { pupik: 'Pupik', mt: 'Monkeytime', gold: 'Goldbug', baloo: 'Baloo' }[co] ?? co
}

export type Scope = { kind: 'group' } | { kind: 'company'; co: string }

export type CardRow = {
  co: string; card: string; name: string; cat: string; src: 'auto' | 'owner'
  months: number[]            // 12 values, Jan..Dec
  ytd: number                 // months 1..through
  excluded: boolean           // group view: intercompany card, left out of the totals
}
export type CategoryRow = { code: string; label: string; months: number[]; ytd: number; cards: number }
export type Summary = {
  year: number
  through: number
  categories: CategoryRow[]   // only categories that have activity; intercompany last, flagged by code
  total: number[]             // 12 months, without the excluded intercompany cards in group view
  totalYtd: number
  intercompany: { months: number[]; ytd: number }  // net of ALL intercompany cards in scope (in group view: should be about 0)
  cards: CardRow[]
  revenue: number[]           // 12 months of revenue in scope (sales lines, intercompany clients out)
  revenueYtd: number
}

const zeros = () => Array.from({ length: 12 }, () => 0)

export function yearsAvailable(data: ExpenseData): number[] {
  return [...new Set(data.lines.map(l => l.y))].sort((a, b) => b - a)
}

export function companiesWithData(data: ExpenseData): string[] {
  const have = new Set(data.lines.map(l => l.co))
  return EXPENSE_COMPANIES.filter(c => have.has(c))
}

/** Last month (1..12) a file has numbers in for that company-year, 0 when none. */
export function lastMonthWithData(data: ExpenseData, year: number, co?: string): number {
  let last = 0
  for (const l of data.lines) {
    if (l.y !== year || (co && l.co !== co)) continue
    for (const k of Object.keys(l.m)) if (l.m[k] !== 0) last = Math.max(last, Number(k))
  }
  return last
}

/** Default "through month": a past year is complete (12); the current year stops at the last month that is over. */
export function defaultThrough(data: ExpenseData, year: number, today = new Date()): number {
  const last = lastMonthWithData(data, year) || 12
  if (year < today.getFullYear()) return 12
  if (year > today.getFullYear()) return last
  const previousMonth = today.getMonth() // 0-based current month == number of finished months
  return Math.max(1, Math.min(last, previousMonth || last))
}

export function summarize(data: ExpenseData, scope: Scope, year: number, through: number): Summary {
  const catLabel = new Map(data.categories.map(c => [c.code, c.label]))
  const cardInfo = new Map(data.cards.map(c => [`${c.co}|${c.card}`, c]))
  const inScope = (co: string) => (scope.kind === 'group' ? true : co === scope.co)

  const cards: CardRow[] = []
  for (const l of data.lines) {
    if (l.y !== year || !inScope(l.co)) continue
    const info = cardInfo.get(`${l.co}|${l.card}`)
    const months = zeros()
    for (const k of Object.keys(l.m)) months[Number(k) - 1] = l.m[k]
    const cat = info?.cat ?? UNCLASSIFIED
    cards.push({
      co: l.co, card: l.card, name: info?.name ?? '', cat, src: info?.src ?? 'auto',
      months, ytd: months.slice(0, through).reduce((a, b) => a + b, 0),
      excluded: scope.kind === 'group' && cat === INTERCOMPANY,
    })
  }

  const byCat = new Map<string, CategoryRow>()
  const total = zeros()
  const inter = zeros()
  for (const c of cards) {
    if (c.cat === INTERCOMPANY) c.months.forEach((v, i) => { inter[i] += v })
    let row = byCat.get(c.cat)
    if (!row) { row = { code: c.cat, label: catLabel.get(c.cat) ?? c.cat, months: zeros(), ytd: 0, cards: 0 }; byCat.set(c.cat, row) }
    row.cards += 1
    c.months.forEach((v, i) => { row!.months[i] += v })
    if (!c.excluded) c.months.forEach((v, i) => { total[i] += v })
  }
  for (const r of byCat.values()) r.ytd = r.months.slice(0, through).reduce((a, b) => a + b, 0)

  const order = new Map(data.categories.map((c, i) => [c.code, i]))
  const categories = [...byCat.values()].sort((a, b) => (order.get(a.code) ?? 999) - (order.get(b.code) ?? 999))
  const sumTo = (a: number[]) => a.slice(0, through).reduce((x, y) => x + y, 0)
  const revenue = zeros()
  for (const r of data.revenue ?? []) {
    if (r.y !== year || !inScope(r.co)) continue
    for (const k of Object.keys(r.m)) revenue[Number(k) - 1] += r.m[k]
  }
  return { year, through, categories, total, totalYtd: sumTo(total), intercompany: { months: inter, ytd: sumTo(inter) }, cards, revenue, revenueYtd: sumTo(revenue) }
}

/** Companies that have expenses in the year but no revenue loaded (their expenses have nothing to be compared with). */
export function companiesWithoutRevenue(data: ExpenseData, year: number): string[] {
  const withRev = new Set((data.revenue ?? []).filter(r => r.y === year && Object.values(r.m).some(v => v !== 0)).map(r => r.co))
  const withExp = new Set(data.lines.filter(l => l.y === year).map(l => l.co))
  return [...withExp].filter(c => !withRev.has(c))
}

/** Expense as a percentage of revenue; null when there is no revenue to divide by. */
export function pctOfRevenue(amount: number, revenue: number): number | null {
  return revenue > 0 ? (amount / revenue) * 100 : null
}

/** Percentage change from previous to current, null when there is no base to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function fmtIls(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const r = Math.round(n)
  return (r === 0 ? 0 : r).toLocaleString('en-US')
}
