import { fmt0, fmt2 } from './format'

const COLUMN_PATTERNS: { pattern: RegExp; key: string }[] = [
  { pattern: /^sku\b/i, key: 'sku' },
  { pattern: /^item\s*name/i, key: 'name' },
  { pattern: /^price\b/i, key: 'price' },
]

function headerText(th: Element): string {
  const clone = th.cloneNode(true) as Element
  clone.querySelectorAll('.si, .col-filter-wrap').forEach(el => el.remove())
  return clone.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function findColumnIndex(ths: Element[], pattern: RegExp): number {
  return ths.findIndex(th => pattern.test(headerText(th)))
}

export function applyTableColumnFilters(table: HTMLTableElement) {
  const tbody = table.querySelector('tbody')
  if (!tbody) return

  const filters = [...table.querySelectorAll<HTMLInputElement>('thead .col-filter')]
    .map(inp => {
      const q = inp.value.trim().toLowerCase()
      const modeBtn = inp.parentElement?.querySelector<HTMLButtonElement>('.col-filter-mode')
      const mode = modeBtn?.dataset.mode ?? 'in'
      return { ci: Number(inp.dataset.colIdx), q, mode }
    })
    .filter(f => f.q !== '' && !Number.isNaN(f.ci))

  tbody.querySelectorAll<HTMLTableRowElement>('tr').forEach(tr => {
    const cells = [...tr.querySelectorAll('td')]
    let vis = true
    for (const f of filters) {
      const txt = (cells[f.ci]?.textContent ?? '').toLowerCase()
      const terms = f.q.split('&').map(t => t.trim()).filter(Boolean)
      if (f.mode === 'in' && !terms.some(t => txt.includes(t))) {
        vis = false
        break
      }
      if (f.mode === 'out' && terms.some(t => txt.includes(t))) {
        vis = false
        break
      }
    }
    tr.style.display = vis ? '' : 'none'
  })

  const footRow = table.querySelector('tfoot tr')
  if (!footRow) return

  const footCells = [...footRow.querySelectorAll('td')]
  const visRows = [...tbody.querySelectorAll<HTMLTableRowElement>('tr')].filter(
    r => r.style.display !== 'none',
  )

  footCells.forEach((fc, ci) => {
    if (ci <= 1) return
    const vals = visRows
      .map(tr => {
        const td = tr.querySelectorAll('td')[ci] as HTMLTableCellElement | undefined
        const sv = td?.dataset?.sv
        if (sv == null || sv === '') return null
        const n = Number(sv)
        return Number.isFinite(n) && sv !== '-99999' && sv !== '-1' ? n : null
      })
      .filter((v): v is number => v !== null)
    if (!vals.length) return
    const sum = vals.reduce((a, b) => a + b, 0)
    fc.textContent = Number.isInteger(sum) ? fmt0(sum) : fmt2(sum)
  })
}

function attachColumnFilter(table: HTMLTableElement, th: HTMLTableCellElement, colIdx: number) {
  if (th.querySelector('.col-filter-wrap')) return

  const wrap = document.createElement('div')
  wrap.className = 'col-filter-wrap'

  const inp = document.createElement('input')
  inp.type = 'text'
  inp.className = 'col-filter'
  inp.placeholder = '▾ filter…'
  inp.dataset.colIdx = String(colIdx)
  inp.addEventListener('click', e => e.stopPropagation())
  inp.addEventListener('input', () => applyTableColumnFilters(table))

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'col-filter-mode'
  btn.textContent = 'IN'
  btn.dataset.mode = 'in'
  btn.title = 'Toggle: show matching / hide matching'
  btn.addEventListener('click', e => {
    e.stopPropagation()
    const nowIn = btn.dataset.mode === 'in'
    btn.dataset.mode = nowIn ? 'out' : 'in'
    btn.textContent = nowIn ? 'OUT' : 'IN'
    btn.classList.toggle('col-filter-mode-out', nowIn)
    applyTableColumnFilters(table)
  })

  wrap.appendChild(inp)
  wrap.appendChild(btn)
  th.appendChild(wrap)
}

export function attachTableColumnFilters(table: HTMLTableElement): boolean {
  const ths = [...table.querySelectorAll<HTMLTableCellElement>('thead th')]
  if (!ths.length) return false

  let attached = false
  for (const { pattern } of COLUMN_PATTERNS) {
    const idx = findColumnIndex(ths, pattern)
    if (idx !== -1) {
      attachColumnFilter(table, ths[idx], idx)
      attached = true
    }
  }
  return attached
}

export function attachAllTableColumnFilters(root: HTMLElement): number {
  let count = 0
  root.querySelectorAll<HTMLTableElement>('table').forEach(table => {
    if (attachTableColumnFilters(table)) count += 1
  })
  return count
}
