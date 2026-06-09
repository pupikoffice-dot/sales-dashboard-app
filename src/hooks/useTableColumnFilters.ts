import { useLayoutEffect } from 'react'
import { attachAllTableColumnFilters } from '../lib/tableColumnFilters'

function countReportTables(root: HTMLElement): number {
  return root.querySelectorAll('.tw-months table, .tw-sticky table, .tw table').length
}

interface TableColumnFiltersOptions {
  deferAboveTableCount?: number
}

export function useTableColumnFilters(
  rootId = 'sales-report',
  options?: TableColumnFiltersOptions,
) {
  const deferAbove = options?.deferAboveTableCount
  useLayoutEffect(() => {
    const root = document.getElementById(rootId)
    if (!root) return

    let pending = 0

    const mount = () => {
      if (deferAbove != null && countReportTables(root) > deferAbove) return
      attachAllTableColumnFilters(root)
    }

    const scheduleMount = () => {
      if (pending) cancelAnimationFrame(pending)
      pending = requestAnimationFrame(() => {
        pending = requestAnimationFrame(mount)
      })
    }

    let tableCount = countReportTables(root)
    scheduleMount()
    const lateMount = window.setTimeout(scheduleMount, 300)

    const mo = new MutationObserver(() => {
      const n = countReportTables(root)
      if (n !== tableCount) {
        tableCount = n
        scheduleMount()
      }
    })
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      window.clearTimeout(lateMount)
      mo.disconnect()
      if (pending) cancelAnimationFrame(pending)
    }
  }, [rootId, deferAbove])
}
