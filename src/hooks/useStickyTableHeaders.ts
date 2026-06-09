import { useLayoutEffect } from 'react'

interface StickyEntry {
  table: HTMLTableElement
  thead: HTMLTableSectionElement
  ths: HTMLTableCellElement[]
  wrap: HTMLDivElement
  ct: HTMLTableElement
  twDiv: HTMLElement | null
  scrollCleanup: (() => void) | null
}

function getTopOffset(): number {
  const headerEl = document.querySelector('.dashboard-header') as HTMLElement | null
  const sbarEl = document.querySelector('#sales-report .sbar') as HTMLElement | null
  const headerH = headerEl?.offsetHeight ?? 60
  if (!sbarEl) return headerH

  const sbarRect = sbarEl.getBoundingClientRect()
  if (sbarRect.bottom > headerH) return Math.round(sbarRect.bottom)
  return headerH
}

function countStickyTables(root: HTMLElement): number {
  return root.querySelectorAll('.tw-months table, .tw-sticky table').length
}

function initStickyHeaders(rootId: string): () => void {
  const root = document.getElementById(rootId)
  if (!root) return () => {}

  document.querySelectorAll('.sticky-thead-clone').forEach(el => el.remove())

  const tables = [...root.querySelectorAll<HTMLTableElement>('.tw-months table, .tw-sticky table')]
  if (!tables.length) return () => {}

  const entries: StickyEntry[] = []

  for (const table of tables) {
    const thead = table.querySelector('thead')
    if (!thead) continue

    const ths = [...thead.querySelectorAll<HTMLTableCellElement>('th')]
    const wrap = document.createElement('div')
    wrap.className = 'sticky-thead-clone'
    const ct = document.createElement('table')
    ct.className = 'sticky-thead-clone-table'
    const cloneThead = thead.cloneNode(true) as HTMLTableSectionElement

    ;[...cloneThead.querySelectorAll('th')].forEach((cth, j) => {
      if (ths[j]?.classList.contains('sortable')) {
        cth.style.cursor = 'pointer'
        cth.onclick = () => ths[j].click()
      }
    })

    ct.appendChild(cloneThead)
    wrap.appendChild(ct)
    document.body.appendChild(wrap)

    const twDiv = table.closest('.tw-months') as HTMLElement | null
    let scrollCleanup: (() => void) | null = null
    if (twDiv) {
      const syncH = () => {
        ct.style.marginLeft = `${-twDiv.scrollLeft}px`
      }
      twDiv.addEventListener('scroll', syncH, { passive: true })
      scrollCleanup = () => twDiv.removeEventListener('scroll', syncH)
    }

    entries.push({ table, thead, ths, wrap, ct, twDiv, scrollCleanup })
  }

  if (!entries.length) return () => {}

  const update = () => {
    const topOffset = getTopOffset()
    for (const { table, thead, ths, wrap, ct, twDiv } of entries) {
      const theadRect = thead.getBoundingClientRect()
      const tbody = table.querySelector('tbody') || table
      const tbodyBottom = tbody.getBoundingClientRect().bottom
      const twRect = (twDiv || table).getBoundingClientRect()
      const show = theadRect.top < topOffset && tbodyBottom > topOffset + 10

      if (show) {
        const cThs = [...ct.querySelectorAll<HTMLTableCellElement>('th')]
        ths.forEach((th, j) => {
          if (cThs[j]) cThs[j].style.width = `${th.offsetWidth}px`
        })
        ct.style.width = `${ths.reduce((s, th) => s + th.offsetWidth, 0)}px`
        if (twDiv) ct.style.marginLeft = `${-twDiv.scrollLeft}px`
        wrap.style.top = `${topOffset}px`
        wrap.style.left = `${twRect.left}px`
        wrap.style.width = `${twRect.width}px`
        wrap.style.display = 'block'
      } else {
        wrap.style.display = 'none'
      }
    }
  }

  const onScroll = () => requestAnimationFrame(update)

  document.addEventListener('scroll', onScroll, { passive: true, capture: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })

  const io = new IntersectionObserver(() => onScroll(), { threshold: [0, 0.01, 0.5, 1] })
  for (const { thead } of entries) io.observe(thead)

  requestAnimationFrame(update)
  requestAnimationFrame(update)

  return () => {
    document.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
    io.disconnect()
    for (const entry of entries) {
      entry.scrollCleanup?.()
      entry.wrap.remove()
    }
  }
}

interface StickyTableHeadersOptions {
  deferAboveTableCount?: number
}

export function useStickyTableHeaders(
  rootId = 'sales-report',
  options?: StickyTableHeadersOptions,
) {
  const deferAbove = options?.deferAboveTableCount
  useLayoutEffect(() => {
    let disposed = false
    let cleanup = () => {}
    let pending = 0
    let tableCount = -1

    const mount = () => {
      cleanup()
      if (disposed) return
      const root = document.getElementById(rootId)
      if (!root) return
      if (deferAbove != null && countStickyTables(root) > deferAbove) return
      cleanup = initStickyHeaders(rootId)
    }

    const scheduleMount = () => {
      if (pending) cancelAnimationFrame(pending)
      pending = requestAnimationFrame(() => {
        pending = requestAnimationFrame(mount)
      })
    }

    const root = document.getElementById(rootId)
    if (!root) return () => {}

    tableCount = countStickyTables(root)
    scheduleMount()
    const lateMount = window.setTimeout(scheduleMount, 300)

    const mo = new MutationObserver(() => {
      const n = countStickyTables(root)
      if (n !== tableCount) {
        tableCount = n
        scheduleMount()
      }
    })
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      disposed = true
      window.clearTimeout(lateMount)
      mo.disconnect()
      if (pending) cancelAnimationFrame(pending)
      cleanup()
    }
  }, [rootId, deferAbove])
}
