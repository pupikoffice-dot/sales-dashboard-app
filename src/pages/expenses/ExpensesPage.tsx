import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChartConfiguration } from 'chart.js'
import { HubChart, cssVar } from '../../components/oversite/hub/HubChart'
import { useExpenseData } from '../../lib/expenses/api'
import {
  companiesWithData, companiesWithoutRevenue, defaultThrough, expenseCompanyLabel, fmtIls, INTERCOMPANY, pctChange, pctOfRevenue, summarize, UNCLASSIFIED,
  yearsAvailable, type ExpenseData, type Scope,
} from '../../lib/expenses/calc'
import { fmtDateTime } from '../../lib/dates'
import { downloadWorkbook, type WorkbookCell } from '../../lib/spreadsheetExport'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

const r2 = (n: number) => Math.round(n * 100) / 100
const rp = (v: number | null): number | null => (v === null ? null : r2(v))

function ExportBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="border rounded px-2 py-0.5 text-sm">Export to Excel</button>
}

const fmtPct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`)

const avgOf = (ytd: number, months: number) => (months > 0 ? ytd / months : 0)

function Pct({ v, neutral }: { v: number | null; neutral?: boolean }) {
  if (v === null) return <span style={{ opacity: 0.5 }}>—</span>
  // an expense that went up is the bad direction (revenue is shown without colour)
  return <span style={{ color: neutral ? undefined : v > 0.5 ? '#c62828' : v < -0.5 ? '#2e7d32' : undefined }}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>
}

/** R&D > Expenses: the whole group (intercompany removed) or one company (intercompany as booked). Super admin only. */
export function ExpensesPage({ mode }: { mode: 'group' | 'company' }) {
  const q = useExpenseData()
  if (q.isLoading) return <p className="status-msg p-6">Loading…</p>
  if (q.error) return <p className="status-msg error p-6">Failed to load: {String(q.error)}</p>
  if (!q.data) return <p className="status-msg p-6">Expenses are available to the super admin only.</p>
  if (!q.data.lines.length) return <p className="status-msg p-6">No expense files have been loaded yet.</p>
  return <ExpensesView data={q.data} mode={mode} />
}

function ExpensesView({ data, mode }: { data: ExpenseData; mode: 'group' | 'company' }) {
  const years = yearsAvailable(data)
  const companies = companiesWithData(data)
  const [year, setYear] = useState(years[0])
  const [co, setCo] = useState(companies[0])
  const [throughPick, setThroughPick] = useState<number | null>(null)
  const through = throughPick ?? defaultThrough(data, year)
  const scope: Scope = mode === 'group' ? { kind: 'group' } : { kind: 'company', co }

  const cur = useMemo(() => summarize(data, scope, year, through), [data, mode, co, year, through]) // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => summarize(data, scope, year - 1, through), [data, mode, co, year, through]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasPrev = years.includes(year - 1)
  const noRevenue = companiesWithoutRevenue(data, year)
  const prevCards = useMemo(() => new Map(prev.cards.map(k => [`${k.co}|${k.card}`, k])), [prev])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (code: string) => setOpen(s => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n })
  const prevByCat = new Map(prev.categories.map(c => [c.code, c]))
  const prevByCat2 = new Map(prev.categories2.map(c => [c.code, c]))
  const [open2, setOpen2] = useState<Set<string>>(new Set())
  const toggle2 = (code: string) => setOpen2(s => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n })
  const cat2Label = new Map((data.categories2 ?? []).map(k => [k.code, k.label]))
  const hasCat2 = (data.categories2 ?? []).length > 0

  const loadedAt = data.loads
    .filter(l => l.y === year && (mode === 'group' || l.co === co))
    .map(l => l.at).sort().slice(-1)[0]
  const unclassified = cur.cards.filter(c => c.cat === UNCLASSIFIED)
  const topCards = [...cur.cards].filter(c => !c.excluded && c.ytd > 0).sort((a, b) => b.ytd - a.ytd).slice(0, 10)
  const biggest = [...cur.categories].filter(c => c.code !== INTERCOMPANY || mode === 'company').sort((a, b) => b.ytd - a.ytd)[0]

  const chart = useMemo<ChartConfiguration>(() => {
    const acc = cssVar('--acc', '#2563eb')
    const muted = cssVar('--muted', '#9ca3af')
    return {
      type: 'bar',
      data: {
        labels: MONTHS,
        datasets: [
          { label: String(year), data: cur.total.map((v, i) => (i < through ? Math.round(v) : null)), backgroundColor: acc, borderRadius: 3 },
          ...(hasPrev ? [{ label: String(year - 1), data: prev.total.map(v => Math.round(v)), backgroundColor: muted, borderRadius: 3 }] : []),
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: hasPrev } },
        scales: { y: { ticks: { callback: v => fmtIls(Number(v)) } } },
      },
    } as ChartConfiguration
  }, [cur, prev, year, through, hasPrev])

  const stamp = `${mode === 'group' ? 'group' : co}-${year}-Jan-${MONTHS[through - 1]}`
  const exportCategories = () => {
    const head: WorkbookCell[] = ['Category', 'Card', 'Name', 'Company', ...MONTHS, `YTD Jan-${MONTHS[through - 1]}`, `Avg per month (${through} mo)`,
      ...(hasPrev ? [`${year - 1} YTD`, 'Change %'] : []), 'Share %', '% of revenue']
    const rows: WorkbookCell[][] = [head]
    for (const c of cur.categories) {
      const removed = c.code === INTERCOMPANY && mode === 'group'
      const p = prevByCat.get(c.code)
      const share = removed || !cur.totalYtd ? null : r2((c.ytd / cur.totalYtd) * 100)
      const chg = pctChange(c.ytd, p?.ytd ?? 0)
      rows.push([c.label + (removed ? ' (removed from totals)' : ''), '', '', '', ...c.months.map(r2), r2(c.ytd), r2(avgOf(c.ytd, through)),
        ...(hasPrev ? [r2(p?.ytd ?? 0), chg === null ? null : r2(chg)] : []), share, rp(pctOfRevenue(c.ytd, cur.revenueYtd))])
      for (const k of cur.cards.filter(x => x.cat === c.code).sort((a, b) => b.ytd - a.ytd)) {
        const pk = prevCards.get(`${k.co}|${k.card}`)
        const kc = pctChange(k.ytd, pk?.ytd ?? 0)
        rows.push([c.label, k.card, k.name, expenseCompanyLabel(k.co), ...k.months.map(r2), r2(k.ytd), r2(avgOf(k.ytd, through)),
          ...(hasPrev ? [r2(pk?.ytd ?? 0), kc === null ? null : r2(kc)] : []), removed || !cur.totalYtd ? null : r2((k.ytd / cur.totalYtd) * 100), rp(pctOfRevenue(k.ytd, cur.revenueYtd))])
      }
    }
    const tc = pctChange(cur.totalYtd, prev.totalYtd)
    rows.push(['Total', '', '', '', ...cur.total.map(r2), r2(cur.totalYtd), r2(avgOf(cur.totalYtd, through)),
      ...(hasPrev ? [r2(prev.totalYtd), tc === null ? null : r2(tc)] : []), 100, rp(pctOfRevenue(cur.totalYtd, cur.revenueYtd))])
    rows.push(['Revenue', '', '', '', ...cur.revenue.map(r2), r2(cur.revenueYtd), r2(avgOf(cur.revenueYtd, through)),
      ...(hasPrev ? [r2(prev.revenueYtd), null] : []), null, null])
    rows.push(['% of revenue', '', '', '', ...cur.total.map((v, i) => rp(pctOfRevenue(v, cur.revenue[i]))), rp(pctOfRevenue(cur.totalYtd, cur.revenueYtd)), null,
      ...(hasPrev ? [rp(pctOfRevenue(prev.totalYtd, prev.revenueYtd)), null] : []), null, null])
    downloadWorkbook([{ name: 'By category', rows, headerFilter: true, widths: [28, 12, 30, 12, ...Array(12).fill(11), 14, 14, 14, 10, 9, 12] }], `Expenses-by-category-${stamp}.xlsx`)
  }
  const exportCategories2 = () => {
    const head: WorkbookCell[] = ['Category 2', 'Card', 'Name', 'Company', 'Category', ...MONTHS, `YTD Jan-${MONTHS[through - 1]}`, `Avg per month (${through} mo)`,
      ...(hasPrev ? [`${year - 1} YTD`, 'Change %'] : []), 'Share %', '% of revenue']
    const rows: WorkbookCell[][] = [head]
    for (const c of cur.categories2) {
      const p = prevByCat2.get(c.code)
      const chg = pctChange(c.ytd, p?.ytd ?? 0)
      rows.push([c.label, '', '', '', '', ...c.months.map(r2), r2(c.ytd), r2(avgOf(c.ytd, through)),
        ...(hasPrev ? [r2(p?.ytd ?? 0), chg === null ? null : r2(chg)] : []), cur.totalYtd ? r2((c.ytd / cur.totalYtd) * 100) : null, rp(pctOfRevenue(c.ytd, cur.revenueYtd))])
      for (const k of cur.cards.filter(x => !x.excluded && x.cat2 === c.code).sort((a, b) => b.ytd - a.ytd)) {
        const pk = prevCards.get(`${k.co}|${k.card}`)
        const kc = pctChange(k.ytd, pk?.ytd ?? 0)
        rows.push([c.label, k.card, k.name, expenseCompanyLabel(k.co), data.categories.find(x => x.code === k.cat)?.label ?? k.cat, ...k.months.map(r2), r2(k.ytd), r2(avgOf(k.ytd, through)),
          ...(hasPrev ? [r2(pk?.ytd ?? 0), kc === null ? null : r2(kc)] : []), cur.totalYtd ? r2((k.ytd / cur.totalYtd) * 100) : null, rp(pctOfRevenue(k.ytd, cur.revenueYtd))])
      }
    }
    const tc = pctChange(cur.totalYtd, prev.totalYtd)
    rows.push(['Total', '', '', '', '', ...cur.total.map(r2), r2(cur.totalYtd), r2(avgOf(cur.totalYtd, through)),
      ...(hasPrev ? [r2(prev.totalYtd), tc === null ? null : r2(tc)] : []), 100, rp(pctOfRevenue(cur.totalYtd, cur.revenueYtd))])
    downloadWorkbook([{ name: 'By Category 2', rows, headerFilter: true, widths: [28, 12, 30, 12, 22, ...Array(12).fill(11), 14, 14, 14, 10, 9, 12] }], `Expenses-by-category2-${stamp}.xlsx`)
  }
  const exportTopCards = () => {
    const rows: WorkbookCell[][] = [['Card', 'Company', 'Name', 'Category', 'Category 2', `YTD Jan-${MONTHS[through - 1]}`, `Avg per month (${through} mo)`, '% of revenue']]
    for (const c of topCards) rows.push([c.card, expenseCompanyLabel(c.co), c.name, data.categories.find(k => k.code === c.cat)?.label ?? c.cat, c.cat2 ? (cat2Label.get(c.cat2) ?? c.cat2) : 'Not assigned', r2(c.ytd), r2(avgOf(c.ytd, through)), rp(pctOfRevenue(c.ytd, cur.revenueYtd))])
    downloadWorkbook([{ name: 'Largest cards', rows, widths: [12, 12, 32, 22, 22, 14, 16] }], `Expenses-largest-cards-${stamp}.xlsx`)
  }
  const exportCompanies = () => {
    const rows: WorkbookCell[][] = [['Company', `${year} YTD`, `Avg per month (${through} mo)`, ...(hasPrev ? [`${year - 1} YTD`, 'Change %'] : [])]]
    for (const c of companies) {
      const a = summarize(data, { kind: 'company', co: c }, year, through)
      const b = summarize(data, { kind: 'company', co: c }, year - 1, through)
      const own = (x: typeof a) => x.categories.filter(k => k.code !== INTERCOMPANY).reduce((t, k) => t + k.ytd, 0)
      const chg = pctChange(own(a), own(b))
      rows.push([expenseCompanyLabel(c), r2(own(a)), r2(avgOf(own(a), through)), ...(hasPrev ? [r2(own(b)), chg === null ? null : r2(chg)] : [])])
    }
    downloadWorkbook([{ name: 'By company', rows, widths: [16, 14, 18, 14, 10] }], `Expenses-by-company-${stamp}.xlsx`)
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {mode === 'group' ? 'Expenses — whole group' : `Expenses — ${expenseCompanyLabel(co)}`}
          </h1>
          <p className="text-sm text-gray-500">
            Cash, ILS. {mode === 'group'
              ? 'Intercompany charges are removed so the same money is not counted twice.'
              : 'Intercompany charges are shown as booked in this company.'}
            {loadedAt ? ` Data loaded ${fmtDateTime(loadedAt)}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {mode === 'company' && (
            <select aria-label="Company" value={co} onChange={e => setCo(e.target.value)} className="border rounded px-2 py-1">
              {companies.map(c => <option key={c} value={c}>{expenseCompanyLabel(c)}</option>)}
            </select>
          )}
          <select aria-label="Year" value={year} onChange={e => { setYear(Number(e.target.value)); setThroughPick(null) }} className="border rounded px-2 py-1">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="flex items-center gap-1">through
            <select aria-label="Through month" value={through} onChange={e => setThroughPick(Number(e.target.value))} className="border rounded px-2 py-1">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <Kpi label={`${year} Jan–${MONTHS[through - 1]}`} value={fmtIls(cur.totalYtd)} />
        {hasPrev && <Kpi label={`${year - 1} same months`} value={fmtIls(prev.totalYtd)} sub={<Pct v={pctChange(cur.totalYtd, prev.totalYtd)} />} />}
        {biggest && <Kpi label="Largest category" value={biggest.label} sub={fmtIls(biggest.ytd)} />}
        <Kpi label="Cards with activity" value={String(cur.cards.length)} />
      </div>

      {unclassified.length > 0 && (
        <p className="text-sm" style={{ color: '#ed8c00' }}>
          {unclassified.length} card{unclassified.length === 1 ? '' : 's'} not classified yet ({fmtIls(unclassified.reduce((a, c) => a + c.ytd, 0))}). {' '}
          <Link to="/expenses/cards" className="underline">Classify them</Link>
        </p>
      )}

      <section>
        <h2 className="font-semibold mb-2">Total by month{hasPrev ? ` — ${year} vs ${year - 1}` : ''}</h2>
        <HubChart config={chart} height={240} label="Expenses by month" />
        {!hasPrev && <p className="text-sm text-gray-500">No earlier year loaded yet, so there is nothing to compare with.</p>}
      </section>

      <section>
        <h2 className="font-semibold mb-2 flex items-center gap-3">By category <ExportBtn onClick={exportCategories} /></h2>
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-gray-500">
                <th style={{ textAlign: 'left' }}>Category</th>
                {MONTHS.map((m, i) => <th key={m} style={{ ...num, opacity: i < through ? 1 : 0.4 }}>{m}</th>)}
                <th style={num}>YTD</th>
                <th style={num} title={`YTD divided by the ${through} counted month${through === 1 ? '' : 's'}`}>Avg / month</th>
                {hasPrev && <th style={num}>{year - 1} YTD</th>}
                {hasPrev && <th style={num}>Change</th>}
                <th style={num}>Share</th>
                <th style={num} title="YTD expense divided by YTD revenue">% of revenue</th>
              </tr>
            </thead>
            <tbody>
              {cur.categories.map(c => {
                const isInter = c.code === INTERCOMPANY
                const removed = isInter && mode === 'group'
                const p = prevByCat.get(c.code)
                const isOpen = open.has(c.code)
                const cardRows = isOpen
                  ? cur.cards.filter(k => k.cat === c.code).sort((a, b) => b.ytd - a.ytd || a.card.localeCompare(b.card))
                  : []
                return (
                  <Fragment key={c.code}>
                    <tr className="border-t" style={removed ? { opacity: 0.55, fontStyle: 'italic' } : undefined}>
                      <td>
                        <button type="button" aria-expanded={isOpen} onClick={() => toggle(c.code)}
                          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}>
                          <span aria-hidden style={{ display: 'inline-block', width: '1.1em' }}>{isOpen ? '▾' : '▸'}</span>
                          {c.label}{removed ? ' (removed from totals)' : ''}
                        </button>
                      </td>
                      {c.months.map((v, i) => <td key={i} style={{ ...num, opacity: i < through ? 1 : 0.4 }}>{fmtIls(v)}</td>)}
                      <td style={{ ...num, fontWeight: 600 }}>{fmtIls(c.ytd)}</td>
                      <td style={num}>{fmtIls(avgOf(c.ytd, through))}</td>
                      {hasPrev && <td style={num}>{p ? fmtIls(p.ytd) : '—'}</td>}
                      {hasPrev && <td style={num}><Pct v={pctChange(c.ytd, p?.ytd ?? 0)} /></td>}
                      <td style={num}>{removed || !cur.totalYtd ? '—' : `${((c.ytd / cur.totalYtd) * 100).toFixed(1)}%`}</td>
                      <td style={num}>{fmtPct(pctOfRevenue(c.ytd, cur.revenueYtd))}</td>
                    </tr>
                    {cardRows.map(k => {
                      const pk = prevCards.get(`${k.co}|${k.card}`)
                      return (
                        <tr key={`${k.co}|${k.card}`} style={{ background: 'rgba(127,127,127,0.07)', fontSize: '0.92em' }}>
                          <td style={{ paddingLeft: '1.6em' }}>
                            {k.name || k.card}
                            <span style={{ opacity: 0.55 }}> · {k.card}{mode === 'group' ? ` · ${expenseCompanyLabel(k.co)}` : ''}</span>
                          </td>
                          {k.months.map((v, i) => <td key={i} style={{ ...num, opacity: i < through ? 1 : 0.4 }}>{fmtIls(v)}</td>)}
                          <td style={{ ...num, fontWeight: 600 }}>{fmtIls(k.ytd)}</td>
                          <td style={num}>{fmtIls(avgOf(k.ytd, through))}</td>
                          {hasPrev && <td style={num}>{pk ? fmtIls(pk.ytd) : '—'}</td>}
                          {hasPrev && <td style={num}><Pct v={pctChange(k.ytd, pk?.ytd ?? 0)} /></td>}
                          <td style={num}>{removed || !cur.totalYtd ? '—' : `${((k.ytd / cur.totalYtd) * 100).toFixed(1)}%`}</td>
                          <td style={num}>{fmtPct(pctOfRevenue(k.ytd, cur.revenueYtd))}</td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
              <tr className="border-t font-semibold">
                <td>Total</td>
                {cur.total.map((v, i) => <td key={i} style={{ ...num, opacity: i < through ? 1 : 0.4 }}>{fmtIls(v)}</td>)}
                <td style={num}>{fmtIls(cur.totalYtd)}</td>
                <td style={num}>{fmtIls(avgOf(cur.totalYtd, through))}</td>
                {hasPrev && <td style={num}>{fmtIls(prev.totalYtd)}</td>}
                {hasPrev && <td style={num}><Pct v={pctChange(cur.totalYtd, prev.totalYtd)} /></td>}
                <td style={num}>100%</td>
                <td style={num}>{fmtPct(pctOfRevenue(cur.totalYtd, cur.revenueYtd))}</td>
              </tr>
              <tr className="border-t" style={{ opacity: 0.85 }}>
                <td>Revenue</td>
                {cur.revenue.map((v, i) => <td key={i} style={{ ...num, opacity: i < through ? 1 : 0.4 }}>{fmtIls(v)}</td>)}
                <td style={{ ...num, fontWeight: 600 }}>{fmtIls(cur.revenueYtd)}</td>
                <td style={num}>{fmtIls(avgOf(cur.revenueYtd, through))}</td>
                {hasPrev && <td style={num}>{fmtIls(prev.revenueYtd)}</td>}
                {hasPrev && <td style={num}><Pct v={pctChange(cur.revenueYtd, prev.revenueYtd)} neutral /></td>}
                <td style={num} />
                <td style={num} />
              </tr>
              <tr className="border-t font-semibold">
                <td>% of revenue</td>
                {cur.total.map((v, i) => <td key={i} style={{ ...num, opacity: i < through ? 1 : 0.4 }}>{fmtPct(pctOfRevenue(v, cur.revenue[i]))}</td>)}
                <td style={num}>{fmtPct(pctOfRevenue(cur.totalYtd, cur.revenueYtd))}</td>
                <td style={num} />
                {hasPrev && <td style={num}>{fmtPct(pctOfRevenue(prev.totalYtd, prev.revenueYtd))}</td>}
                {hasPrev && <td style={num} />}
                <td style={num} />
                <td style={num} />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Revenue is the sales shown on the sales pages (returns taken off), {mode === 'group' ? 'for the companies that have it' : 'for this company'}.
          {noRevenue.length > 0 && (mode === 'group' || noRevenue.includes(co)) &&
            ` No revenue is loaded for ${noRevenue.map(expenseCompanyLabel).join(', ')}, so ${mode === 'group' ? 'its expenses are counted in the % of revenue above against revenue that leaves it out' : '% of revenue cannot be calculated'}.`}
        </p>
        {mode === 'group' && (
          <p className="text-sm text-gray-500 mt-2">
            Intercompany check: the charges between the companies net to {fmtIls(cur.intercompany.ytd)} this year to date
            (it should be close to zero; a difference means the two sides are booked at different amounts or months).
          </p>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2 flex items-center gap-3">
          By Category 2 {hasCat2 && <ExportBtn onClick={exportCategories2} />}
        </h2>
        {!hasCat2 ? (
          <p className="text-sm text-gray-500">
            No Category 2 yet. <Link to="/expenses/cards" className="underline">Create them and assign the cards</Link>; this table then sums the expenses by Category 2 only.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead>
                  <tr className="text-gray-500">
                    <th style={{ textAlign: 'left' }}>Category 2</th>
                    {MONTHS.map((m, i) => <th key={m} style={{ ...num, opacity: i < through ? 1 : 0.4 }}>{m}</th>)}
                    <th style={num}>YTD</th>
                    <th style={num} title={`YTD divided by the ${through} counted month${through === 1 ? '' : 's'}`}>Avg / month</th>
                    {hasPrev && <th style={num}>{year - 1} YTD</th>}
                    {hasPrev && <th style={num}>Change</th>}
                    <th style={num}>Share</th>
                    <th style={num} title="YTD expense divided by YTD revenue">% of revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {cur.categories2.map(c => {
                    const p = prevByCat2.get(c.code)
                    const isOpen = open2.has(c.code)
                    const cardRows = isOpen
                      ? cur.cards.filter(k => !k.excluded && k.cat2 === c.code).sort((a, b) => b.ytd - a.ytd || a.card.localeCompare(b.card))
                      : []
                    return (
                      <Fragment key={c.code || 'none'}>
                        <tr className="border-t" style={c.code === '' ? { opacity: 0.8, fontStyle: 'italic' } : undefined}>
                          <td>
                            <button type="button" aria-expanded={isOpen} onClick={() => toggle2(c.code)}
                              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left' }}>
                              <span aria-hidden style={{ display: 'inline-block', width: '1.1em' }}>{isOpen ? '▾' : '▸'}</span>
                              {c.label}
                            </button>
                          </td>
                          {c.months.map((v, i) => <td key={i} style={{ ...num, opacity: i < through ? 1 : 0.4 }}>{fmtIls(v)}</td>)}
                          <td style={{ ...num, fontWeight: 600 }}>{fmtIls(c.ytd)}</td>
                          <td style={num}>{fmtIls(avgOf(c.ytd, through))}</td>
                          {hasPrev && <td style={num}>{p ? fmtIls(p.ytd) : '—'}</td>}
                          {hasPrev && <td style={num}><Pct v={pctChange(c.ytd, p?.ytd ?? 0)} /></td>}
                          <td style={num}>{cur.totalYtd ? `${((c.ytd / cur.totalYtd) * 100).toFixed(1)}%` : '—'}</td>
                          <td style={num}>{fmtPct(pctOfRevenue(c.ytd, cur.revenueYtd))}</td>
                        </tr>
                        {cardRows.map(k => {
                          const pk = prevCards.get(`${k.co}|${k.card}`)
                          return (
                            <tr key={`${k.co}|${k.card}`} style={{ background: 'rgba(127,127,127,0.07)', fontSize: '0.92em' }}>
                              <td style={{ paddingLeft: '1.6em' }}>
                                {k.name || k.card}
                                <span style={{ opacity: 0.55 }}> · {k.card}{mode === 'group' ? ` · ${expenseCompanyLabel(k.co)}` : ''}</span>
                              </td>
                              {k.months.map((v, i) => <td key={i} style={{ ...num, opacity: i < through ? 1 : 0.4 }}>{fmtIls(v)}</td>)}
                              <td style={{ ...num, fontWeight: 600 }}>{fmtIls(k.ytd)}</td>
                              <td style={num}>{fmtIls(avgOf(k.ytd, through))}</td>
                              {hasPrev && <td style={num}>{pk ? fmtIls(pk.ytd) : '—'}</td>}
                              {hasPrev && <td style={num}><Pct v={pctChange(k.ytd, pk?.ytd ?? 0)} /></td>}
                              <td style={num}>{cur.totalYtd ? `${((k.ytd / cur.totalYtd) * 100).toFixed(1)}%` : '—'}</td>
                              <td style={num}>{fmtPct(pctOfRevenue(k.ytd, cur.revenueYtd))}</td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                  <tr className="border-t font-semibold">
                    <td>Total</td>
                    {cur.total.map((v, i) => <td key={i} style={{ ...num, opacity: i < through ? 1 : 0.4 }}>{fmtIls(v)}</td>)}
                    <td style={num}>{fmtIls(cur.totalYtd)}</td>
                    <td style={num}>{fmtIls(avgOf(cur.totalYtd, through))}</td>
                    {hasPrev && <td style={num}>{fmtIls(prev.totalYtd)}</td>}
                    {hasPrev && <td style={num}><Pct v={pctChange(cur.totalYtd, prev.totalYtd)} /></td>}
                    <td style={num}>100%</td>
                    <td style={num}>{fmtPct(pctOfRevenue(cur.totalYtd, cur.revenueYtd))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              The same expenses as the table above, grouped by Category 2 instead. The total is the same{mode === 'group' ? ' (intercompany charges are left out here too)' : ''}.
              Cards with no Category 2 are shown as "Not assigned".
            </p>
          </>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2 flex items-center gap-3">Ten largest cards (year to date) <ExportBtn onClick={exportTopCards} /></h2>
        <table className="text-sm">
          <thead><tr className="text-gray-500"><th style={{ textAlign: 'left' }}>Card</th>{mode === 'group' && <th style={{ textAlign: 'left' }}>Company</th>}<th style={{ textAlign: 'left' }}>Name</th><th style={{ textAlign: 'left' }}>Category</th><th style={{ textAlign: 'left' }}>Category 2</th><th style={num}>YTD</th><th style={num}>Avg / month</th><th style={num}>% of revenue</th></tr></thead>
          <tbody>
            {topCards.map(c => (
              <tr key={`${c.co}|${c.card}`} className="border-t">
                <td className="pr-4">{c.card}</td>
                {mode === 'group' && <td className="pr-4">{expenseCompanyLabel(c.co)}</td>}
                <td className="pr-4">{c.name}</td>
                <td className="pr-4">{data.categories.find(k => k.code === c.cat)?.label ?? c.cat}</td>
                <td className="pr-4">{c.cat2 ? (cat2Label.get(c.cat2) ?? c.cat2) : <span style={{ opacity: 0.5 }}>Not assigned</span>}</td>
                <td style={num}>{fmtIls(c.ytd)}</td>
                <td style={num}>{fmtIls(avgOf(c.ytd, through))}</td>
                <td style={num}>{fmtPct(pctOfRevenue(c.ytd, cur.revenueYtd))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {mode === 'group' && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-3">By company (year to date, intercompany removed) <ExportBtn onClick={exportCompanies} /></h2>
          <table className="text-sm">
            <thead><tr className="text-gray-500"><th style={{ textAlign: 'left' }}>Company</th><th style={num}>{year} YTD</th><th style={num}>Avg / month</th>{hasPrev && <th style={num}>{year - 1} YTD</th>}{hasPrev && <th style={num}>Change</th>}</tr></thead>
            <tbody>
              {companies.map(c => {
                const a = summarize(data, { kind: 'company', co: c }, year, through)
                const b = summarize(data, { kind: 'company', co: c }, year - 1, through)
                const own = (s: typeof a) => s.categories.filter(x => x.code !== INTERCOMPANY).reduce((t, x) => t + x.ytd, 0)
                return (
                  <tr key={c} className="border-t">
                    <td className="pr-4">{expenseCompanyLabel(c)}</td>
                    <td style={num}>{fmtIls(own(a))}</td>
                    <td style={num}>{fmtIls(avgOf(own(a), through))}</td>
                    {hasPrev && <td style={num}>{fmtIls(own(b))}</td>}
                    {hasPrev && <td style={num}><Pct v={pctChange(own(a), own(b))} /></td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {sub !== undefined && <div className="text-sm">{sub}</div>}
    </div>
  )
}
