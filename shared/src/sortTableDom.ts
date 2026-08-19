/** Legacy-compatible DOM table sort (dashboardsalesgroup.html sortTable). */
export function sortTableDom(th: HTMLTableCellElement) {
  const table = th.closest('table')
  const tbody = table?.querySelector('tbody')
  if (!tbody) return

  const idx = th.cellIndex
  const asc = th.dataset.sd !== 'asc'

  table!.querySelectorAll<HTMLTableCellElement>('th.sortable').forEach(h => {
    h.dataset.sd = ''
    const si = h.querySelector('.si')
    if (si) si.textContent = ' ↕'
  })

  th.dataset.sd = asc ? 'asc' : 'desc'
  const si = th.querySelector('.si')
  if (si) si.textContent = asc ? ' ↑' : ' ↓'

  const rows = [...tbody.querySelectorAll('tr')]
  rows.sort((a, b) => {
    const ac = a.cells[idx]
    const bc = b.cells[idx]
    if (!ac || !bc) return 0

    const av =
      ac.dataset.sv !== undefined && ac.dataset.sv !== ''
        ? Number(ac.dataset.sv)
        : Number.NaN
    const bv =
      bc.dataset.sv !== undefined && bc.dataset.sv !== ''
        ? Number(bc.dataset.sv)
        : Number.NaN
    if (!Number.isNaN(av) && !Number.isNaN(bv)) return asc ? av - bv : bv - av

    const at = ac.textContent?.trim() ?? ''
    const bt = bc.textContent?.trim() ?? ''
    const an = parseFloat(at.replace(/,/g, ''))
    const bn = parseFloat(bt.replace(/,/g, ''))
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return asc ? an - bn : bn - an
    return asc ? at.localeCompare(bt) : bt.localeCompare(at)
  })

  rows.forEach(r => tbody.appendChild(r))
}
