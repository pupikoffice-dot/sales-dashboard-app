import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setExpenseCardCategory, useExpenseData } from '../../lib/expenses/api'
import {
  companiesWithData, expenseCompanyLabel, fmtIls, INTERCOMPANY, UNCLASSIFIED, yearsAvailable, type ExpenseData,
} from '../../lib/expenses/calc'
import { downloadWorkbook } from '../../lib/spreadsheetExport'
import { deleteExpenseCategory, moveExpenseCategory, saveExpenseCategory } from '../../lib/expenses/api'

/** Add, rename, reorder and delete categories. Built-in ones can be renamed but not deleted; "Unclassified" stays last. */
function CategoryManager({ data }: { data: ExpenseData }) {
  const qc = useQueryClient()
  const [openList, setOpenList] = useState(false)
  const [newName, setNewName] = useState('')
  const [edits, setEdits] = useState<Record<string, string>>({})
  const refresh = () => qc.invalidateQueries({ queryKey: ['expenses'] })
  const run = useMutation({ mutationFn: (fn: () => Promise<void>) => fn(), onSuccess: refresh })
  const used = (code: string) => data.cards.filter(c => c.cat === code).length
  const movable = data.categories.filter(c => c.code !== UNCLASSIFIED)
  return (
    <div className="text-sm">
      <button type="button" aria-expanded={openList} onClick={() => setOpenList(o => !o)} className="underline">
        {openList ? '▾' : '▸'} Manage categories ({data.categories.length})
      </button>
      {openList && (
        <div className="mt-2 space-y-2">
          <table className="text-sm">
            <tbody>
              {data.categories.map(k => {
                const idx = movable.findIndex(m => m.code === k.code)
                const fixed = k.code === UNCLASSIFIED
                const value = edits[k.code] ?? k.label
                const deletable = k.code.startsWith('x_')
                return (
                  <tr key={k.code} className="border-t">
                    <td className="pr-2 py-1">
                      <input aria-label={`Name of ${k.label}`} value={value} onChange={e => setEdits(s => ({ ...s, [k.code]: e.target.value }))}
                        className="border rounded px-2 py-0.5" style={{ minWidth: '14em' }} />
                    </td>
                    <td className="pr-2 text-gray-500">{used(k.code)} cards{k.code === INTERCOMPANY ? ' · removed from group totals' : ''}</td>
                    <td className="pr-1">
                      <button type="button" disabled={run.isPending || value.trim() === k.label || !value.trim()}
                        onClick={() => run.mutate(async () => { await saveExpenseCategory(k.code, value); setEdits(s => { const n = { ...s }; delete n[k.code]; return n }) })}
                        className="border rounded px-2 py-0.5">Save</button>
                    </td>
                    <td className="pr-1">
                      {!fixed && <>
                        <button type="button" aria-label={`Move ${k.label} up`} disabled={run.isPending || idx <= 0} onClick={() => run.mutate(() => moveExpenseCategory(k.code, -1))} className="border rounded px-2 py-0.5">↑</button>{' '}
                        <button type="button" aria-label={`Move ${k.label} down`} disabled={run.isPending || idx >= movable.length - 1} onClick={() => run.mutate(() => moveExpenseCategory(k.code, 1))} className="border rounded px-2 py-0.5">↓</button>
                      </>}
                    </td>
                    <td>
                      {deletable && <button type="button" disabled={run.isPending || used(k.code) > 0}
                        title={used(k.code) > 0 ? 'Move its cards to another category first' : 'Delete this category'}
                        onClick={() => { if (window.confirm(`Delete the category "${k.label}"?`)) run.mutate(() => deleteExpenseCategory(k.code)) }}
                        className="border rounded px-2 py-0.5">Delete</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <form className="flex flex-wrap items-center gap-2"
            onSubmit={e => { e.preventDefault(); if (newName.trim()) run.mutate(async () => { await saveExpenseCategory(null, newName); setNewName('') }) }}>
            <input aria-label="New category name" placeholder="New category name" value={newName} onChange={e => setNewName(e.target.value)} className="border rounded px-2 py-0.5" style={{ minWidth: '14em' }} />
            <button type="submit" disabled={run.isPending || !newName.trim()} className="border rounded px-2 py-0.5">Add category</button>
            {run.error && <span style={{ color: '#c62828' }}>{String((run.error as Error).message ?? run.error)}</span>}
          </form>
          <p className="text-gray-500">Built-in categories can be renamed but not deleted. A category you add can be deleted once no card uses it. Cards are assigned in the table below.</p>
        </div>
      )}
    </div>
  )
}

/** R&D > Expenses > Cards: every card with its category; the owner corrects the first guess here. Super admin only. */
export function ExpenseCardsPage() {
  const q = useExpenseData()
  const qc = useQueryClient()
  const [co, setCo] = useState<string>('all')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const save = useMutation({
    mutationFn: (v: { co: string; card: string; category: string }) => setExpenseCardCategory(v.co, v.card, v.category),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })

  const data = q.data
  const rows = useMemo(() => {
    if (!data) return []
    const years = yearsAvailable(data)
    const sum = new Map<string, number>()
    for (const l of data.lines) {
      if (l.y !== years[0]) continue
      sum.set(`${l.co}|${l.card}`, (sum.get(`${l.co}|${l.card}`) ?? 0) + Object.values(l.m).reduce((a, b) => a + b, 0))
    }
    return data.cards
      .filter(c => sum.has(`${c.co}|${c.card}`)) // a card with no activity in the latest year is not shown
      .filter(c => (co === 'all' || c.co === co) && (!onlyOpen || c.cat === UNCLASSIFIED))
      .map(c => ({ ...c, total: sum.get(`${c.co}|${c.card}`) ?? 0 }))
      .sort((a, b) => Number(b.cat === UNCLASSIFIED) - Number(a.cat === UNCLASSIFIED) || a.co.localeCompare(b.co) || a.card.localeCompare(b.card))
  }, [data, co, onlyOpen])

  if (q.isLoading) return <p className="status-msg p-6">Loading…</p>
  if (q.error) return <p className="status-msg error p-6">Failed to load: {String(q.error)}</p>
  if (!data) return <p className="status-msg p-6">Expenses are available to the super admin only.</p>
  const latest = yearsAvailable(data)[0]
  const open = data.cards.filter(c => c.cat === UNCLASSIFIED).length

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Expense cards</h1>
        <p className="text-sm text-gray-500">
          Each card is sorted into a category by its name; correct any that are wrong. A card you set here is never changed by a later load.
          Totals are for {latest}. {open} unclassified.
        </p>
      </div>
      <CategoryManager data={data} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select aria-label="Company" value={co} onChange={e => setCo(e.target.value)} className="border rounded px-2 py-1">
          <option value="all">All companies</option>
          {companiesWithData(data).map(c => <option key={c} value={c}>{expenseCompanyLabel(c)}</option>)}
        </select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} /> only unclassified</label>
        <button type="button" className="border rounded px-2 py-0.5" onClick={() => {
          const label = new Map(data.categories.map(k => [k.code, k.label]))
          downloadWorkbook([{
            name: 'Cards', headerFilter: true, widths: [12, 14, 34, 24, 8, 14],
            rows: [['Company', 'Card', 'Name', 'Category', 'Set by', `${latest} total`],
              ...rows.map(c => [expenseCompanyLabel(c.co), c.card, c.name, label.get(c.cat) ?? c.cat, c.src === 'owner' ? 'you' : 'auto', Math.round(c.total * 100) / 100])],
          }], `Expense-cards-${latest}.xlsx`)
        }}>Export to Excel</button>
        {save.isPending && <span className="text-gray-500">Saving…</span>}
        {save.error && <span style={{ color: '#c62828' }}>Save failed: {String(save.error)}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr className="text-left text-gray-500"><th>Company</th><th>Card</th><th>Name</th><th>Category</th><th>Set by</th><th style={{ textAlign: 'right' }}>{latest} total</th></tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <tr key={`${c.co}|${c.card}`} className="border-t" style={c.cat === UNCLASSIFIED ? { background: 'rgba(237,140,0,0.10)' } : undefined}>
                <td className="pr-3">{expenseCompanyLabel(c.co)}</td>
                <td className="pr-3">{c.card}</td>
                <td className="pr-3">{c.name}</td>
                <td className="pr-3">
                  <select aria-label={`Category of ${c.name}`} value={c.cat} disabled={save.isPending}
                    onChange={e => save.mutate({ co: c.co, card: c.card, category: e.target.value })} className="border rounded px-1 py-0.5">
                    {data.categories.map(k => <option key={k.code} value={k.code}>{k.label}</option>)}
                  </select>
                </td>
                <td className="pr-3 text-gray-500">{c.src === 'owner' ? 'you' : 'auto'}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtIls(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
